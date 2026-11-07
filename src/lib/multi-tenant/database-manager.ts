/**
 * Tenant Database Manager — Universal (supports ANY PostgreSQL provider)
 *
 * Two modes:
 *   - "shared": Uses DATABASE_BASE_URL + databaseName (platform's DB)
 *   - "own":    Customer provides their own connection URL
 *               Works with: Neon, Supabase, AWS RDS, Railway, local Postgres...
 *
 * Auto-detects Neon vs standard PostgreSQL and picks the right driver:
 *   - Neon URL  (*.neon.tech) → Neon HTTP driver (works on Vercel serverless)
 *   - Everything else         → pg.Pool (works on any server)
 */

import { drizzle as drizzleNodePg, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as tenantSchema from "@/lib/db/schema";
import { masterDb, studios } from "@/lib/db/master";
import { decrypt } from "@/lib/encryption";
import { isNeonUrl, requiresSsl, getPoolSize } from "@/lib/db/connect";

// Cache: cacheKey → drizzle instance
const connectionCache = new Map<string, NodePgDatabase<typeof tenantSchema>>();
const poolCache = new Map<string, Pool>();

/**
 * Get a Drizzle database instance for a specific tenant.
 * Automatically picks Neon or pg driver based on the connection URL.
 *
 * @param databaseName   Database name (used in shared mode to build URL)
 * @param connectionUrl  Full connection URL (BYODB mode — any provider)
 */
export function getTenantDb(
  databaseName: string,
  connectionUrl?: string
): NodePgDatabase<typeof tenantSchema> {
  const cacheKey = connectionUrl ? `own_${databaseName}` : databaseName;

  if (connectionCache.has(cacheKey)) {
    return connectionCache.get(cacheKey)!;
  }

  const connectionString = connectionUrl
    ? connectionUrl
    : buildConnectionString(
        process.env.DATABASE_BASE_URL || process.env.DATABASE_URL!,
        databaseName
      );

  let db: NodePgDatabase<typeof tenantSchema>;

  // Use universal pg.Pool — works with Neon, Supabase, RDS, local, anything
  // The connection settings are tuned per provider via the helpers
  const pool = new Pool({
    connectionString,
    max: getPoolSize(connectionString),
    idleTimeoutMillis: isNeonUrl(connectionString) ? 10000 : 30000,
    connectionTimeoutMillis: 5000,
    ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : false,
  });

  pool.on("error", (err) => console.error(`[Tenant DB: ${cacheKey}] Pool error:`, err));
  db = drizzleNodePg(pool, { schema: tenantSchema });
  poolCache.set(cacheKey, pool);

  connectionCache.set(cacheKey, db);
  return db;
}

/**
 * Resolves the correct tenant database for the current request.
 *
 * Fast path: reads databaseAccountType from middleware header
 *   → shared mode: no master DB query needed
 *
 * Slow path (BYODB): queries master DB once, decrypts URL, caches result
 */
export async function resolveTenantDb(
  studioId: string,
  databaseName: string
): Promise<NodePgDatabase<typeof tenantSchema>> {
  // Fast path: check header set by middleware
  try {
    const { headers } = await import("next/headers");
    const headersList = await headers();
    const raw = headersList.get("x-studio-data");
    if (raw) {
      const studioData = JSON.parse(raw) as { databaseAccountType?: string };
      if (studioData.databaseAccountType !== "own") {
        // Shared mode — use platform DB, no master DB query
        return getTenantDb(databaseName);
      }
    }
  } catch {
    // headers() not available outside request context
  }

  // BYODB cache check — avoid decrypting on every request
  const ownCacheKey = `own_${studioId}`;
  if (connectionCache.has(ownCacheKey)) {
    return connectionCache.get(ownCacheKey)!;
  }

  // Slow path: query master DB for BYODB connection URL
  const [studio] = await masterDb
    .select({
      databaseAccountType: (studios as any).databaseAccountType,
      databaseUrl: (studios as any).databaseUrl,
    })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (
    studio &&
    (studio as any).databaseAccountType === "own" &&
    (studio as any).databaseUrl
  ) {
    try {
      const decryptedUrl = decrypt((studio as any).databaseUrl);
      // getTenantDb will cache this under own_${databaseName}
      return getTenantDb(databaseName, decryptedUrl);
    } catch (err) {
      console.error(`[DB Manager] Failed to decrypt DB URL for ${studioId}:`, err);
      // Fall through to shared mode
    }
  }

  // Default: shared mode
  return getTenantDb(databaseName);
}

/**
 * Closes a cached connection (call when studio is deleted/suspended).
 */
export async function closeTenantConnection(databaseName: string): Promise<void> {
  const pool = poolCache.get(databaseName);
  if (pool) {
    await pool.end();
    poolCache.delete(databaseName);
    connectionCache.delete(databaseName);
    console.log(`[DB Manager] Closed connection: ${databaseName}`);
  }
}

export function getActiveTenantConnectionCount(): number {
  return connectionCache.size;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildConnectionString(baseUrl: string, databaseName: string): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = `/${databaseName}`;
    return url.toString();
  } catch {
    return baseUrl.replace(/\/[^/]*$/, `/${databaseName}`);
  }
}

// Kept for migration scripts that may call it
export async function createTenantDatabase(_databaseName: string): Promise<void> {
  // In shared mode: not needed (all use platform DB)
  // In BYODB mode: customer sets up their own DB and provides the URL
  console.log(`[DB Manager] createTenantDatabase: no-op in shared/BYODB model`);
}

export async function runTenantMigrations(_databaseName: string): Promise<void> {
  // Run migrations at deploy time via: npm run db:migrate
  console.log(`[DB Manager] runTenantMigrations: no-op — run db:migrate at deploy time`);
}
