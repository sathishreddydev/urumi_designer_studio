import { NextResponse } from "next/server";
import { encryptTenantSecret } from "@/lib/tenant-registry/crypto";
import {
  normalizeCloudinaryUrl,
  normalizeDomain,
  normalizeLogoUrl,
  normalizePostgresUrl,
} from "@/lib/tenant-registry/domain";
import { queryMaster } from "@/lib/tenant-registry/db";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";

export const runtime = "nodejs";

interface StudioRow {
  id: string;
  name: string;
  domain: string;
  logo_url: string;
  active: boolean;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  if (!(await isOwnerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { rows } = await queryMaster<StudioRow>(
      `SELECT id, name, domain, logo_url, active
       FROM tenant_registry_studios
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const studio = rows[0];
    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    return NextResponse.json({
      studio: {
        id: studio.id,
        name: studio.name,
        domain: studio.domain,
        logoUrl: studio.logo_url,
        active: studio.active,
      },
    });
  } catch (error) {
    console.error("Could not load studio details:", error);
    return NextResponse.json({ error: "Could not load studio details" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await isOwnerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid studio details" }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    if (
      typeof input.name !== "string" ||
      typeof input.domain !== "string" ||
      typeof input.logoUrl !== "string" ||
      typeof input.active !== "boolean" ||
      (input.databaseUrl !== undefined && typeof input.databaseUrl !== "string") ||
      (input.cloudinaryUrl !== undefined && typeof input.cloudinaryUrl !== "string")
    ) {
      return NextResponse.json({ error: "Invalid studio details" }, { status: 400 });
    }

    const name = input.name.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Studio name must be 2 to 120 characters" }, { status: 400 });
    }

    let domain: string;
    let logoUrl: string;
    let databaseUrlEncrypted: string | null = null;
    let cloudinaryUrlEncrypted: string | null = null;
    try {
      domain = normalizeDomain(input.domain);
      logoUrl = normalizeLogoUrl(input.logoUrl);

      const databaseUrl = typeof input.databaseUrl === "string" ? input.databaseUrl.trim() : "";
      if (databaseUrl) {
        databaseUrlEncrypted = encryptTenantSecret(normalizePostgresUrl(databaseUrl));
      }

      const cloudinaryUrl = typeof input.cloudinaryUrl === "string" ? input.cloudinaryUrl.trim() : "";
      if (cloudinaryUrl) {
        cloudinaryUrlEncrypted = encryptTenantSecret(normalizeCloudinaryUrl(cloudinaryUrl));
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid studio details" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const { rows } = await queryMaster<StudioRow>(
      `UPDATE tenant_registry_studios
       SET name = $2,
           domain = $3,
           logo_url = $4,
           database_url_encrypted = COALESCE($5, database_url_encrypted),
           cloudinary_url_encrypted = COALESCE($6, cloudinary_url_encrypted),
           active = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, domain, logo_url, active`,
      [id, name, domain, logoUrl, databaseUrlEncrypted, cloudinaryUrlEncrypted, input.active]
    );
    const studio = rows[0];
    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    return NextResponse.json({
      studio: {
        id: studio.id,
        name: studio.name,
        domain: studio.domain,
        logoUrl: studio.logo_url,
        active: studio.active,
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json({ error: "That domain is already registered" }, { status: 409 });
    }
    console.error("Could not update registered studio:", error);
    return NextResponse.json({ error: "Could not update studio" }, { status: 500 });
  }
}
