// Re-export from the db directory so both "./db" and "@/lib/db" resolve correctly.
export { db, getTenantDatabase } from "./db/index";
export type { TenantDatabase } from "./db/index";
