/**
 * Universal Database Connector Utilities
 *
 * Detects database provider type from connection string.
 * Used by database-manager.ts to pick the right connection settings.
 *
 * Supported providers:
 *   - Neon (*.neon.tech)         → pg.Pool with SSL forced on
 *   - Supabase (*.supabase.co)   → pg.Pool with SSL
 *   - Any other PostgreSQL       → pg.Pool with configurable SSL
 */

/**
 * Returns true if the URL points to a Neon database.
 * Neon uses their pooler (ends in .neon.tech or .aws.neon.tech)
 */
export function isNeonUrl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return url.hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

/**
 * Returns true if the URL points to a Supabase database.
 */
export function isSupabaseUrl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/**
 * Returns true if SSL should be enforced for the given connection string.
 * Neon, Supabase, and any hosted provider in production needs SSL.
 */
export function requiresSsl(connectionString: string): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (isNeonUrl(connectionString)) return true;
  if (isSupabaseUrl(connectionString)) return true;
  // Any non-localhost URL in production should use SSL
  try {
    const url = new URL(connectionString);
    return !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Returns the optimal pool size for the given provider.
 * Neon pooler has its own connection limits, so we use fewer connections.
 */
export function getPoolSize(connectionString: string): number {
  if (isNeonUrl(connectionString)) return 3;   // Neon pooler handles the rest
  return 5;                                      // Standard PostgreSQL
}
