import { Pool } from "pg";
import { normalizePostgresUrl } from "@/lib/tenant-registry/domain";

const globalForMasterDb = globalThis as unknown as {
  masterPool?: Pool;
};

function getMasterPool(): Pool {
  if (!process.env.MASTER_DATABASE_URL) {
    throw new Error("MASTER_DATABASE_URL environment variable is required");
  }

  if (!globalForMasterDb.masterPool) {
    const connectionString = normalizePostgresUrl(process.env.MASTER_DATABASE_URL);
    const pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
    });
    pool.on("error", (error) => {
      console.error("Unexpected master database pool error:", error);
    });
    globalForMasterDb.masterPool = pool;
  }

  return globalForMasterDb.masterPool;
}

export async function queryMaster<T extends import("pg").QueryResultRow = import("pg").QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return getMasterPool().query<T>(text, values);
}
