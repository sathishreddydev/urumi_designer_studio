/**
 * Server-side utilities for reading studio context.
 *
 * These run in Server Components and API routes.
 * They read from the request headers populated by middleware —
 * no extra database query needed per request.
 */

import { headers } from "next/headers";
import { type StudioBranding, DEFAULT_STUDIO } from "@/contexts/studio-context";
import { getTenantDb, resolveTenantDb } from "./database-manager";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as tenantSchema from "@/lib/db/schema";

/**
 * Get the Drizzle database instance for the current request's studio.
 *
 * Two modes (same as Cloudinary):
 *   - "shared": Uses platform's DATABASE_BASE_URL + databaseName
 *   - "own":    Uses studio's own encrypted connection string (BYODB)
 *
 * In single-tenant mode (no MASTER_DATABASE_URL):
 *   Returns the default `db` from @/lib/db.
 */
export async function getStudioDb(): Promise<
  NodePgDatabase<typeof tenantSchema>
> {
  // Single-tenant mode: use default db
  if (!process.env.MASTER_DATABASE_URL) {
    const { db } = await import("@/lib/db");
    return db as unknown as NodePgDatabase<typeof tenantSchema>;
  }

  // Multi-tenant: read studio info from headers
  const headersList = await headers();
  const studioId = headersList.get("x-studio-id");
  const databaseName = headersList.get("x-studio-db");

  if (!studioId || !databaseName) {
    // On platform domain (no studio) → use default db
    const { db } = await import("@/lib/db");
    return db as unknown as NodePgDatabase<typeof tenantSchema>;
  }

  // Check if studio has own database (BYODB) or shared
  return resolveTenantDb(studioId, databaseName);
}

/**
 * Read the current studio branding from middleware-populated headers.
 * Use this in Server Components and API route handlers.
 *
 * Returns DEFAULT_STUDIO when running in single-tenant mode
 * (MASTER_DATABASE_URL not set).
 */
export async function getStudio(): Promise<StudioBranding> {
  // Single-tenant mode: skip header lookup
  if (!process.env.MASTER_DATABASE_URL) {
    return DEFAULT_STUDIO;
  }

  const headersList = await headers();
  const raw = headersList.get("x-studio-data");

  if (!raw) return DEFAULT_STUDIO;

  try {
    return JSON.parse(raw) as StudioBranding;
  } catch {
    return DEFAULT_STUDIO;
  }
}

/**
 * Read the studio database name from headers.
 * Use this in API routes to get the right tenant DB connection.
 *
 * Returns the default DATABASE_URL database when in single-tenant mode.
 */
export async function getStudioDatabaseName(): Promise<string> {
  if (!process.env.MASTER_DATABASE_URL) {
    // Single-tenant: extract DB name from DATABASE_URL
    try {
      const url = new URL(process.env.DATABASE_URL!);
      return url.pathname.replace("/", "");
    } catch {
      return "default";
    }
  }

  const headersList = await headers();
  return headersList.get("x-studio-db") || DEFAULT_STUDIO.databaseName;
}

/**
 * Read the studio ID from headers.
 */
export async function getStudioId(): Promise<string> {
  if (!process.env.MASTER_DATABASE_URL) {
    return DEFAULT_STUDIO.id;
  }

  const headersList = await headers();
  return headersList.get("x-studio-id") || DEFAULT_STUDIO.id;
}
