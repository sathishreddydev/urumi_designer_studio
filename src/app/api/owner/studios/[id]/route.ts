import { NextResponse } from "next/server";
import { encryptTenantSecret } from "@/lib/tenant-registry/crypto";
import {
  normalizeCloudinaryUrl,
  normalizeDomain,
  normalizePostgresUrl,
} from "@/lib/tenant-registry/domain";
import { getStudioFaviconUrl, getStudioLogoUrl } from "@/lib/tenant-registry/logo-data";
import { queryMaster } from "@/lib/tenant-registry/db";
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
  notes: string;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { rows } = await queryMaster<StudioRow>(
      `SELECT id, name, domain, logo_url, logo_data, favicon_data, active, deactivate_at, notes
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
        logoUrl: getStudioLogoUrl(studio.logo_url, studio.logo_data),
        faviconUrl: getStudioFaviconUrl(studio.favicon_data),
        active: studio.active,
        deactivateAt: studio.deactivate_at?.toISOString() ?? null,
        notes: studio.notes,
      },
    });
  } catch (error) {
    console.error("Could not load studio details:", error);
    return NextResponse.json({ error: "Could not load studio details" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const nameValue = formData.get("name");
    const domainValue = formData.get("domain");
    const activeValue = formData.get("active");
    const clearFaviconValue = formData.get("clearFavicon");
    const databaseUrlValue = formData.get("databaseUrl");
    const cloudinaryUrlValue = formData.get("cloudinaryUrl");
    // deactivateAt: ISO date string, "clear" to remove, or absent to leave unchanged
    const deactivateAtValue = formData.get("deactivateAt");
    const notesValue = formData.get("notes");

    if (
      typeof nameValue !== "string" ||
      typeof domainValue !== "string" ||
      (activeValue !== "true" && activeValue !== "false") ||
      (clearFaviconValue !== null && clearFaviconValue !== "true" && clearFaviconValue !== "false") ||
      (databaseUrlValue !== null && typeof databaseUrlValue !== "string") ||
      (cloudinaryUrlValue !== null && typeof cloudinaryUrlValue !== "string") ||
      (deactivateAtValue !== null && typeof deactivateAtValue !== "string") ||
      (notesValue !== null && typeof notesValue !== "string")
    ) {
      return NextResponse.json({ error: "Invalid studio details" }, { status: 400 });
    }

    const name = nameValue.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Studio name must be 2 to 120 characters" }, { status: 400 });
    }
    const notes = typeof notesValue === "string" ? notesValue.trim() : null;
    if (notes !== null && notes.length > 5000) {
      return NextResponse.json({ error: "Studio notes must be 5000 characters or fewer" }, { status: 400 });
    }

    // Parse and validate deactivateAt
    // "clear" → set to NULL, ISO string → parse as date, null/absent → leave unchanged
    let deactivateAt: Date | null | undefined = undefined; // undefined = don't update column
    if (deactivateAtValue !== null) {
      if (deactivateAtValue.trim() === "" || deactivateAtValue === "clear") {
        deactivateAt = null; // clear the scheduled date
      } else {
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
    }

    let domain: string;
    let logoData: Buffer | null;
    let faviconData: Buffer | null;
    let databaseUrlEncrypted: string | null = null;
    let cloudinaryUrlEncrypted: string | null = null;
    const { validateLogoUpload, validateFaviconUpload } = await import("@/lib/tenant-registry/logo");
    try {
      domain = normalizeDomain(domainValue);
      logoData = await validateLogoUpload(formData.get("logo"), false);
      faviconData = await validateFaviconUpload(formData.get("favicon"), false);

      const databaseUrl = typeof databaseUrlValue === "string" ? databaseUrlValue.trim() : "";
      if (databaseUrl) {
        databaseUrlEncrypted = encryptTenantSecret(normalizePostgresUrl(databaseUrl));
      }

      const cloudinaryUrl = typeof cloudinaryUrlValue === "string" ? cloudinaryUrlValue.trim() : "";
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
           logo_url = CASE WHEN $4::bytea IS NOT NULL THEN '' ELSE logo_url END,
           logo_data = COALESCE($4::bytea, logo_data),
           favicon_data = CASE WHEN $6 THEN NULL ELSE COALESCE($5::bytea, favicon_data) END,
           database_url_encrypted = COALESCE($7, database_url_encrypted),
           cloudinary_url_encrypted = COALESCE($8, cloudinary_url_encrypted),
           active = $9,
           deactivate_at = CASE WHEN $10::boolean THEN $11::timestamptz ELSE deactivate_at END,
           notes = COALESCE($12, notes),
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, domain, logo_url, logo_data, favicon_data, active, deactivate_at, notes`,
      [
        id,
        name,
        domain,
        logoData,
        faviconData,
        clearFaviconValue === "true",
        databaseUrlEncrypted,
        cloudinaryUrlEncrypted,
        activeValue === "true",
        deactivateAt !== undefined,  // $10: whether to update deactivate_at
        deactivateAt ?? null,        // $11: the new value (null clears it)
        notes,
      ]
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
        logoUrl: getStudioLogoUrl(studio.logo_url, studio.logo_data),
        faviconUrl: getStudioFaviconUrl(studio.favicon_data),
        active: studio.active,
        deactivateAt: studio.deactivate_at?.toISOString() ?? null,
        notes: studio.notes,
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
    const diagnosticCode =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined;
    return NextResponse.json(
      { error: "Could not update studio", diagnosticCode },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { rowCount } = await queryMaster(
      `DELETE FROM tenant_registry_studios WHERE id = $1`,
      [id]
    );

    if (!rowCount) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Could not delete studio:", error);
    return NextResponse.json({ error: "Could not delete studio" }, { status: 500 });
  }
}
