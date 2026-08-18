import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

if (!globalForDb.pool) {
  globalForDb.pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 20,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 3000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  // Keep pool warm
  globalForDb.pool.on("error", (err) => {
    console.error("Unexpected pool error:", err);
  });
}

export const db = drizzle(globalForDb.pool);
