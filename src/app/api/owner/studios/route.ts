import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { normalizeCloudinaryUrl, normalizeDomain, normalizePostgresUrl } from "@/lib/tenant-registry/domain";
import { queryMaster } from "@/lib/tenant-registry/db";
import { getStudioFaviconUrl, getStudioLogoUrl } from "@/lib/tenant-registry/logo-data";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";

export const runtime = "nodejs";

interface StudioRow {
  id: string;
  name: string;
  domain: string;
  logo_url: string;
  logo_data: Buffer | null;
  favicon_data: Buffer | null;
  active: boolean;
  deactivate_at: Date | null;
  created_at: Date;
}

export async function GET() {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows } = await queryMaster<StudioRow>(
      `SELECT id, name, domain, logo_url, logo_data, active, deactivate_at, created_at
       FROM tenant_registry_studios
       ORDER BY created_at DESC`
    );
    return NextResponse.json({
      studios: rows.map((row) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        logoUrl: getStudioLogoUrl(row.logo_url, row.logo_data),
        active: row.active,
        deactivateAt: row.deactivate_at?.toISOString() ?? null,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Could not list registered studios:", error);
    return NextResponse.json({ error: "Could not load studios" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const nameValue = formData.get("name");
    const domainValue = formData.get("domain");
    const databaseUrlValue = formData.get("databaseUrl");
    const cloudinaryUrlValue = formData.get("cloudinaryUrl");
    const deactivateAtValue = formData.get("deactivateAt");
    if (
      typeof nameValue !== "string" ||
      typeof domainValue !== "string" ||
      typeof databaseUrlValue !== "string" ||
      typeof cloudinaryUrlValue !== "string" ||
      (deactivateAtValue !== null && typeof deactivateAtValue !== "string")
    ) {
      return NextResponse.json({ error: "All studio fields are required" }, { status: 400 });
    }

    const name = nameValue.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Studio name must be 2 to 120 characters" }, { status: 400 });
    }

    // Parse deactivateAt if provided
    let deactivateAt: Date | null = null;
    if (deactivateAtValue && deactivateAtValue.trim() !== "") {
      const parsed = new Date(deactivateAtValue);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid deactivation date" }, { status: 400 });
      }
      if (parsed <= new Date()) {
        return NextResponse.json(
          { error: "Deactivation date must be in the future" },
          { status: 400 }
        );
      }
      deactivateAt = parsed;
    }

    let domain: string;
    let logoData: Buffer;
    let faviconData: Buffer | null;
    let databaseUrl: string;
    let cloudinaryUrl: string;
    const { validateLogoUpload, validateFaviconUpload } = await import("@/lib/tenant-registry/logo");
    try {
      domain = normalizeDomain(domainValue);
      logoData = (await validateLogoUpload(formData.get("logo"), true))!;
      faviconData = await validateFaviconUpload(formData.get("favicon"), false);
      databaseUrl = normalizePostgresUrl(databaseUrlValue);
      cloudinaryUrl = normalizeCloudinaryUrl(cloudinaryUrlValue);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid studio details",
        },
        { status: 400 }
      );
    }

    const databaseUrlEncrypted = encryptTenantSecret(databaseUrl);
    const cloudinaryUrlEncrypted = encryptTenantSecret(cloudinaryUrl);
    const { rows } = await queryMaster<StudioRow>(
      `INSERT INTO tenant_registry_studios
         (id, name, domain, logo_url, logo_data, favicon_data, database_url_encrypted, cloudinary_url_encrypted, deactivate_at)
       VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8)
       RETURNING id, name, domain, logo_url, logo_data, favicon_data, active, deactivate_at, created_at`,
      [randomUUID(), name, domain, logoData, faviconData, databaseUrlEncrypted, cloudinaryUrlEncrypted, deactivateAt]
    );

    const studio = rows[0];
    return NextResponse.json({
      studio: {
        id: studio.id,
        name: studio.name,
        domain: studio.domain,
        logoUrl: getStudioLogoUrl(studio.logo_url, studio.logo_data),
        faviconUrl: getStudioFaviconUrl(studio.favicon_data),
        active: studio.active,
        deactivateAt: studio.deactivate_at?.toISOString() ?? null,
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
