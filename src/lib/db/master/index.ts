/**
 * Master Database Connection
 * This connects to the master database that holds all studio (tenant) metadata.
 * It is separate from individual studio databases.
 *
 * Env variable: MASTER_DATABASE_URL
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.MASTER_DATABASE_URL) {
  throw new Error("MASTER_DATABASE_URL environment variable is required");
}

// Use a global pool to avoid creating new connections on every request (Next.js hot reload)
const globalForMasterDb = globalThis as unknown as {
  masterPool: Pool | undefined;
};

if (!globalForMasterDb.masterPool) {
  globalForMasterDb.masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL,
    max: 10, // Master DB needs fewer connections
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 3000,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  globalForMasterDb.masterPool.on("error", (err) => {
    console.error("[Master DB] Unexpected pool error:", err);
  });
}

export const masterDb = drizzle(globalForMasterDb.masterPool, { schema });

export * from "./schema";
