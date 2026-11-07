/**
 * Master Database Connection.
 *
 * Stores metadata about ALL studios (tenants).
 * Uses the universal connector — works with Neon (Vercel) and any PostgreSQL.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { requiresSsl } from "../connect";

if (!process.env.MASTER_DATABASE_URL) {
  throw new Error("MASTER_DATABASE_URL environment variable is required");
}

const globalForMasterDb = globalThis as unknown as { masterPool: Pool | undefined };

if (!globalForMasterDb.masterPool) {
  globalForMasterDb.masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: requiresSsl(process.env.MASTER_DATABASE_URL) ? { rejectUnauthorized: false } : false,
  });
  globalForMasterDb.masterPool.on("error", (err) => console.error("[Master DB] Pool error:", err));
}

export const masterDb = drizzle(globalForMasterDb.masterPool, { schema });

export * from "./schema";
