/**
 * Default platform database connection.
 *
 * Uses pg.Pool for local dev and non-Neon DBs.
 * For Neon on Vercel, the pooler URL (with ?sslmode=require) handles
 * connection limits automatically — pg.Pool works fine with Neon's pooler.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requiresSsl } from "./connect";

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

if (!globalForDb.pool) {
  globalForDb.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: requiresSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
  });
  globalForDb.pool.on("error", (err) => console.error("[DB] Pool error:", err));
}

export const db = drizzle(globalForDb.pool);
