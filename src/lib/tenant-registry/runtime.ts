import { NextResponse } from "next/server";
import { getTenantDatabase } from "@/lib/db";
import { decryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { runWithTenantContext, type TenantContext } from "@/lib/tenant-registry/context";
import { normalizeCloudinaryUrl, normalizeDomain, normalizePostgresUrl } from "@/lib/tenant-registry/domain";
import { queryMaster } from "@/lib/tenant-registry/db";

interface TenantRow {
  id: string;
  name: string;
  domain: string;
  logo_url: string;
  active: boolean;
  database_url_encrypted: string;
  cloudinary_url_encrypted: string;
}

export class TenantResolutionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

export class InactiveStudioError extends TenantResolutionError {
  constructor() {
    super("This domain is inactive. Please contact the team for assistance.", 403);
    this.name = "InactiveStudioError";
  }
}

async function resolveTenantContext(host: string | null): Promise<TenantContext> {
  if (!host) {
    throw new TenantResolutionError("Request host is missing", 400);
  }

  let domain: string;
  try {
    domain = normalizeDomain(host);
  } catch {
    throw new TenantResolutionError("Unrecognized studio domain", 404);
  }

  const { rows } = await queryMaster<TenantRow>(
    `SELECT id, name, domain, logo_url, active, database_url_encrypted, cloudinary_url_encrypted
     FROM tenant_registry_studios
     WHERE domain = $1
     LIMIT 1`,
    [domain]
  );
  const studio = rows[0];
  if (!studio) {
    throw new TenantResolutionError("Unrecognized studio domain", 404);
  }
  if (!studio.active) {
    throw new InactiveStudioError();
  }

  const databaseUrl = normalizePostgresUrl(
    decryptTenantSecret(studio.database_url_encrypted)
  );
  const cloudinaryUrl = new URL(
    normalizeCloudinaryUrl(decryptTenantSecret(studio.cloudinary_url_encrypted))
  );

  return {
    id: studio.id,
    name: studio.name,
    domain: studio.domain,
    logoUrl: studio.logo_url,
    db: getTenantDatabase(studio.id, databaseUrl),
    cloudinary: {
      cloudName: cloudinaryUrl.hostname,
      apiKey: decodeURIComponent(cloudinaryUrl.username),
      apiSecret: decodeURIComponent(cloudinaryUrl.password),
    },
  };
}

export async function runWithTenantRequest<T>(
  request: Request,
  callback: () => T
): Promise<T> {
  return runWithTenantHost(request.headers.get("host"), callback);
}

export async function runWithTenantHost<T>(
  host: string | null,
  callback: () => T
): Promise<T> {
  const context = await resolveTenantContext(host);
  return runWithTenantContext(context, callback);
}

export function withTenant<Args extends [Request, ...unknown[]]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await runWithTenantRequest(args[0], () => handler(...args));
    } catch (error) {
      if (error instanceof TenantResolutionError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error("Tenant request failed:", error);
      return NextResponse.json({ error: "Studio service is unavailable" }, { status: 503 });
    }
  };
}
