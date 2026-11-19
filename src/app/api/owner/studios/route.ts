import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { normalizeCloudinaryUrl, normalizeDomain, normalizePostgresUrl } from "@/lib/tenant-registry/domain";
import { queryMaster } from "@/lib/tenant-registry/db";
import {
  compressFaviconUpload,
  compressLogoUpload,
  LogoUploadError,
} from "@/lib/tenant-registry/logo";
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
  created_at: Date;
}

export async function GET() {
  if (!(await isOwnerAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = await queryMaster<StudioRow>(
      `SELECT id, name, domain, logo_url, logo_data, active, created_at
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
    const formData = await request.formData();
    const nameValue = formData.get("name");
    const domainValue = formData.get("domain");
    const databaseUrlValue = formData.get("databaseUrl");
    const cloudinaryUrlValue = formData.get("cloudinaryUrl");
    if (
      typeof nameValue !== "string" ||
      typeof domainValue !== "string" ||
      typeof databaseUrlValue !== "string" ||
      typeof cloudinaryUrlValue !== "string"
    ) {
      return NextResponse.json({ error: "All studio fields are required" }, { status: 400 });
    }

    const name = nameValue.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Studio name must be 2 to 120 characters" }, { status: 400 });
    }

    let domain: string;
    let logoData: Buffer | null;
    let faviconData: Buffer | null;
    let databaseUrl: string;
    let cloudinaryUrl: string;
    try {
      domain = normalizeDomain(domainValue);
      logoData = await compressLogoUpload(formData.get("logo"), true);
      faviconData = await compressFaviconUpload(formData.get("favicon"), false);
      if (!logoData) {
        return NextResponse.json({ error: "Choose a logo image to upload." }, { status: 400 });
      }
      databaseUrl = normalizePostgresUrl(databaseUrlValue);
      cloudinaryUrl = normalizeCloudinaryUrl(cloudinaryUrlValue);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof LogoUploadError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Invalid studio details",
        },
        { status: 400 }
      );
    }

    const databaseUrlEncrypted = encryptTenantSecret(databaseUrl);
    const cloudinaryUrlEncrypted = encryptTenantSecret(cloudinaryUrl);
    const { rows } = await queryMaster<StudioRow>(
      `INSERT INTO tenant_registry_studios (id, name, domain, logo_url, logo_data, favicon_data, database_url_encrypted, cloudinary_url_encrypted)
       VALUES ($1, $2, $3, '', $4, $5, $6, $7)
       RETURNING id, name, domain, logo_url, logo_data, favicon_data, active, created_at`,
      [randomUUID(), name, domain, logoData, faviconData, databaseUrlEncrypted, cloudinaryUrlEncrypted]
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
