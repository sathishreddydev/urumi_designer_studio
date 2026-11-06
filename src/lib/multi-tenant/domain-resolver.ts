/**
 * Domain Resolver
 *
 * Maps an incoming hostname (e.g. designer.elitestudio.com)
 * to a studio record in the master database.
 *
 * Results are cached in-memory for 60 seconds to avoid
 * hitting the master DB on every single request.
 */

import { eq } from "drizzle-orm";
import { masterDb, studios, type Studio } from "@/lib/db/master";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ResolvedStudio {
  id: string;
  domain: string;
  databaseName: string;
  status: Studio["status"];
  brandName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customCss: string | null;
  businessName: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  businessAddress: string | null;
  timezone: string;
  currency: string;
  planType: Studio["planType"];
  features: NonNullable<Studio["features"]>;
  cloudinaryAccountType: Studio["cloudinaryAccountType"];
  cloudinaryCloudName: string | null;
  cloudinaryApiKey: string | null;
  cloudinaryApiSecret: string | null; // Still encrypted at this stage
  // Database (BYODB)
  databaseAccountType: Studio["cloudinaryAccountType"]; // reuse enum type
  databaseUrl: string | null; // Still encrypted at this stage
}

// ─── CACHE ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  studio: ResolvedStudio | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCached(hostname: string): ResolvedStudio | null | undefined {
  const entry = cache.get(hostname);
  if (!entry) return undefined; // Not in cache
  if (Date.now() > entry.expiresAt) {
    cache.delete(hostname);
    return undefined; // Expired
  }
  return entry.studio; // null means "not found" (also cached)
}

function setCache(hostname: string, studio: ResolvedStudio | null): void {
  cache.set(hostname, {
    studio,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Invalidate cached entry for a domain.
 * Call this when studio branding/status is updated.
 */
export function invalidateDomainCache(hostname: string): void {
  cache.delete(hostname);
}

// ─── RESOLVER ────────────────────────────────────────────────────────────────

/**
 * Resolves a hostname to a studio.
 * Returns null if no studio is found.
 */
export async function resolveStudioByDomain(
  hostname: string
): Promise<ResolvedStudio | null> {
  // Strip port if present (e.g. localhost:3000)
  const cleanHostname = hostname.split(":")[0].toLowerCase();

  // Check cache first
  const cached = getCached(cleanHostname);
  if (cached !== undefined) return cached;

  // Query master database
  const [row] = await masterDb
    .select()
    .from(studios)
    .where(eq(studios.domain, cleanHostname))
    .limit(1);

  if (!row) {
    setCache(cleanHostname, null);
    return null;
  }

  const resolved: ResolvedStudio = {
    id: row.id,
    domain: row.domain,
    databaseName: row.databaseName,
    status: row.status,
    brandName: row.brandName,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    customCss: row.customCss,
    businessName: row.businessName,
    businessEmail: row.businessEmail,
    businessPhone: row.businessPhone,
    businessAddress: row.businessAddress,
    timezone: row.timezone,
    currency: row.currency,
    planType: row.planType,
    features: row.features ?? {
      whatsappIntegration: false,
      instagramFeed: false,
      customerPortal: true,
      aiMeasurements: false,
      customReports: false,
    },
    cloudinaryAccountType: row.cloudinaryAccountType,
    cloudinaryCloudName: row.cloudinaryCloudName,
    cloudinaryApiKey: row.cloudinaryApiKey,
    cloudinaryApiSecret: row.cloudinaryApiSecret,
    databaseAccountType: (row as any).databaseAccountType ?? "shared",
    databaseUrl: (row as any).databaseUrl ?? null,
  };

  setCache(cleanHostname, resolved);
  return resolved;
}

/**
 * Resolves a studio from the request headers set by middleware.
 * Use this in API routes and server components instead of
 * re-querying the master DB on every request.
 */
export function resolveStudioFromHeaders(
  headers: Headers | { get(name: string): string | null }
): ResolvedStudio | null {
  const raw = headers.get("x-studio-data");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ResolvedStudio;
  } catch {
    return null;
  }
}
