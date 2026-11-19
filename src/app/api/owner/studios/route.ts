import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { normalizeCloudinaryUrl, normalizeDomain, normalizeLogoUrl, normalizePostgresUrl } from "@/lib/tenant-registry/domain";
import { queryMaster } from "@/lib/tenant-registry/db";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";

export const runtime = "nodejs";

interface StudioRow {
  id: string;
  name: string;
  domain: string;
  logo_url: string;
  active: boolean;
  created_at: Date;
}

export async function GET() {
  if (!(await isOwnerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = await queryMaster<StudioRow>(
      `SELECT id, name, domain, logo_url, active, created_at
       FROM tenant_registry_studios
       ORDER BY created_at DESC`
    );
    return NextResponse.json({
      studios: rows.map((row) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        logoUrl: row.logo_url,
        active: row.active,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Could not list registered studios:", error);
    return NextResponse.json({ error: "Could not load studios" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
      typeof input.databaseUrl !== "string" ||
      typeof input.cloudinaryUrl !== "string"
    ) {
      return NextResponse.json({ error: "All studio fields are required" }, { status: 400 });
    }

    const name = input.name.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Studio name must be 2 to 120 characters" }, { status: 400 });
    }

    let domain: string;
    let logoUrl: string;
    let databaseUrl: string;
    let cloudinaryUrl: string;
    try {
      domain = normalizeDomain(input.domain);
      logoUrl = normalizeLogoUrl(input.logoUrl);
      databaseUrl = normalizePostgresUrl(input.databaseUrl);
      cloudinaryUrl = normalizeCloudinaryUrl(input.cloudinaryUrl);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid studio details" },
        { status: 400 }
      );
    }

    const databaseUrlEncrypted = encryptTenantSecret(databaseUrl);
    const cloudinaryUrlEncrypted = encryptTenantSecret(cloudinaryUrl);
    const { rows } = await queryMaster<StudioRow>(
      `INSERT INTO tenant_registry_studios (id, name, domain, logo_url, database_url_encrypted, cloudinary_url_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, domain, logo_url, active, created_at`,
      [randomUUID(), name, domain, logoUrl, databaseUrlEncrypted, cloudinaryUrlEncrypted]
    );

    const studio = rows[0];
    return NextResponse.json({
      studio: {
        id: studio.id,
        name: studio.name,
        domain: studio.domain,
        logoUrl: studio.logo_url,
        active: studio.active,
        createdAt: studio.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json({ error: "That domain is already registered" }, { status: 409 });
    }
    console.error("Could not register studio:", error);
    return NextResponse.json({ error: "Could not register studio" }, { status: 500 });
  }
}
