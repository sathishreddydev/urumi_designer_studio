/**
 * Tenant Database Manager
 *
 * Manages database connections for each studio (tenant).
 *
 * Two modes (same pattern as Cloudinary):
 *   - "shared": Uses DATABASE_BASE_URL + databaseName (platform's DB)
 *   - "own":    Uses the studio's own encrypted connection string (BYODB)
 *
 * Connections are pooled and cached globally to avoid creating
 * new connections on every request.
 */

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as tenantSchema from "@/lib/db/schema";
import { masterDb, studios } from "@/lib/db/master";
import { decrypt } from "@/lib/encryption";

// Cache: databaseName → drizzle instance
const connectionCache = new Map<string, NodePgDatabase<typeof tenantSchema>>();
const poolCache = new Map<string, Pool>();

/**
 * Get a Drizzle database instance for a specific tenant.
 *
 * Two modes:
 *   - Shared: databaseName is used with DATABASE_BASE_URL to build connection
 *   - Own:    full connection string is used directly (BYODB)
 *
 * Connections are cached so we reuse them across requests.
 *
 * @param databaseName  The database name (shared mode)
 * @param connectionUrl  Full connection string (own mode, overrides databaseName)
 */
export function getTenantDb(
  databaseName: string,
  connectionUrl?: string
): NodePgDatabase<typeof tenantSchema> {
  // Build cache key — use connectionUrl hash if provided, otherwise databaseName
  const cacheKey = connectionUrl ? `own_${databaseName}` : databaseName;

  // Return cached connection if available
  if (connectionCache.has(cacheKey)) {
    return connectionCache.get(cacheKey)!;
  }

  // Build connection string:
  // - If connectionUrl provided (own mode), use it directly
  // - Otherwise (shared mode), build from DATABASE_BASE_URL + databaseName
  const connectionString = connectionUrl
    ? connectionUrl
    : buildConnectionString(
        process.env.DATABASE_BASE_URL || process.env.DATABASE_URL!,
        databaseName
      );

  // Create new pool for this tenant
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  pool.on("error", (err) => {
    console.error(`[Tenant DB: ${cacheKey}] Pool error:`, err);
  });

  const db = drizzle(pool, { schema: tenantSchema });

  // Cache both pool and db instance
  poolCache.set(cacheKey, pool);
  connectionCache.set(cacheKey, db);

  return db;
}

/**
 * Resolves the correct tenant database for the current request.
 *
 * This is the main entry point used by `getStudioDb()` in studio.ts.
 * It checks if the studio has their own database (BYODB) or uses shared.
 *
 * @param studioId     The studio ID
 * @param databaseName The default database name (from studio record)
 */
export async function resolveTenantDb(
  studioId: string,
  databaseName: string
): Promise<NodePgDatabase<typeof tenantSchema>> {
  // Check if studio has their own database connection (BYODB)
  const [studio] = await masterDb
    .select({
      databaseAccountType: (studios as any).databaseAccountType,
      databaseUrl: (studios as any).databaseUrl,
    })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  // If studio has own database URL, decrypt and use it
  if (
    studio &&
    (studio as any).databaseAccountType === "own" &&
    (studio as any).databaseUrl
  ) {
    try {
      const decryptedUrl = decrypt((studio as any).databaseUrl);
      return getTenantDb(databaseName, decryptedUrl);
    } catch (err) {
      console.error(`[DB Manager] Failed to decrypt DB URL for ${studioId}:`, err);
      // Fall through to shared mode
    }
  }

  // Shared mode: use DATABASE_BASE_URL + databaseName
  return getTenantDb(databaseName);
}

/**
 * Creates a new PostgreSQL database for a studio.
 * Called when a new studio registers.
 */
export async function createTenantDatabase(databaseName: string): Promise<void> {
  // Connect to postgres (default DB) to create new database
  const adminPool = new Pool({
    connectionString: process.env.DATABASE_URL!, // Uses the default/admin DB
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    // Sanitize database name to prevent SQL injection
    const safeName = sanitizeDatabaseName(databaseName);

    await adminPool.query(`CREATE DATABASE "${safeName}"`);
    console.log(`[Database Manager] Created database: ${safeName}`);
  } catch (error: unknown) {
    // If database already exists, that's fine
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "42P04"
    ) {
      console.log(
        `[Database Manager] Database ${databaseName} already exists, skipping.`
      );
    } else {
      throw error;
    }
  } finally {
    await adminPool.end();
  }
}

/**
 * Runs all tenant migrations on a newly created database.
 * Called right after createTenantDatabase().
 */
export async function runTenantMigrations(databaseName: string): Promise<void> {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const db = getTenantDb(databaseName);

  await migrate(db, {
    migrationsFolder: "./migrations",
  });

  console.log(`[Database Manager] Migrations complete for: ${databaseName}`);
}

/**
 * Closes and removes a tenant database connection from cache.
 * Useful when a studio is suspended or deleted.
 */
export async function closeTenantConnection(
  databaseName: string
): Promise<void> {
  const pool = poolCache.get(databaseName);
  if (pool) {
    await pool.end();
    poolCache.delete(databaseName);
    connectionCache.delete(databaseName);
    console.log(
      `[Database Manager] Closed connection for: ${databaseName}`
    );
  }
}

/**
 * Returns count of active tenant connections (for monitoring).
 */
export function getActiveTenantConnectionCount(): number {
  return connectionCache.size;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Replaces the database name in a PostgreSQL connection string.
 *
 * Example:
 *   buildConnectionString("postgresql://user:pass@host:5432/master_db", "studio_abc_db")
 *   → "postgresql://user:pass@host:5432/studio_abc_db"
 */
function buildConnectionString(
  baseUrl: string,
  databaseName: string
): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = `/${databaseName}`;
    return url.toString();
  } catch {
    // Fallback: replace last path segment
    return baseUrl.replace(/\/[^/]*$/, `/${databaseName}`);
  }
}

/**
 * Ensures database name is safe for use in SQL.
 * Only allows alphanumeric characters and underscores.
 */
function sanitizeDatabaseName(name: string): string {
  const safe = name.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  if (!safe) throw new Error("Invalid database name");
  return safe;
}
