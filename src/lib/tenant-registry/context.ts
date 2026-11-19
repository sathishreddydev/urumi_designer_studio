import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantDatabase } from "@/lib/db";

export interface TenantContext {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  db: TenantDatabase;
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
}

const tenantContext = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const context = tenantContext.getStore();
  if (!context) {
    throw new Error("Tenant context is not available for this request");
  }
  return context;
}

export function runWithTenantContext<T>(
  context: TenantContext,
  callback: () => T
): T {
  return tenantContext.run(context, callback);
}
