import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getTenantContext } from "@/lib/tenant-registry/context";

export type TenantDatabase = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  tenantDatabases?: Map<string, TenantDatabase>;
};

const tenantDatabases =
  globalForDb.tenantDatabases ?? (globalForDb.tenantDatabases = new Map());

export function getTenantDatabase(studioId: string, connectionString: string): TenantDatabase {
  const key = `${studioId}:${connectionString}`;
  const cached = tenantDatabases.get(key);
  if (cached) return cached;

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  });
  pool.on("error", (error) => {
    console.error("Unexpected tenant database pool error:", error);
  });

  const database = drizzle(pool, { schema });
  tenantDatabases.set(key, database);
  return database;
}

export const db = new Proxy({} as TenantDatabase, {
  get(_target, property) {
    const activeDatabase = getTenantContext().db;
    const value = Reflect.get(activeDatabase, property, activeDatabase);
    return typeof value === "function" ? value.bind(activeDatabase) : value;
  },
});
