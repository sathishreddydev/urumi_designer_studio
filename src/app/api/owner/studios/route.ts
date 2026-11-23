import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { normalizeCloudinaryUrl, normalizeDomain, normalizePostgresUrl } from "@/lib/tenant-registry/domain";
import { queryMaster } from "@/lib/tenant-registry/db";
import { getStudioFaviconUrl, getStudioLogoUrl } from "@/lib/tenant-registry/logo-data";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { decryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { Pool } from "pg";

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
  created_at: Date;
}

export async function GET(request: Request) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status") ?? "all";
    const health = searchParams.get("health") ?? "all";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "10", 10) || 10));
    const offset = (page - 1) * limit;

    const statusCondition =
      status === "active"
        ? `AND active = true AND (deactivate_at IS NULL OR deactivate_at > NOW())`
        : status === "inactive"
          ? `AND active = false AND (deactivate_at IS NULL OR deactivate_at > NOW())`
          : status === "expired"
            ? `AND deactivate_at IS NOT NULL AND deactivate_at <= NOW()`
            : "";
    const searchParam = search ? `%${search}%` : "";

    const baseWhere = `WHERE (
      $1 = '' OR name ILIKE $1 OR domain ILIKE $1 OR COALESCE(notes, '') ILIKE $1
    ) ${statusCondition}`;

    if (health === "healthy" || health === "unhealthy") {
      const { rows: matchingRows } = await queryMaster<StudioRow & { database_url_encrypted: string }>(
        `SELECT id, name, domain, logo_url, logo_data, active, deactivate_at, notes, created_at,
                database_url_encrypted
         FROM tenant_registry_studios
         ${baseWhere}
         ORDER BY created_at DESC`,
        [searchParam]
      );

      const healthResults = await Promise.all(
        matchingRows.map(async (row) => {
          try {
            const dbUrl = normalizePostgresUrl(decryptTenantSecret(row.database_url_encrypted));
            const pool = new Pool({
              connectionString: dbUrl,
              max: 1,
              connectionTimeoutMillis: 5_000,
              idleTimeoutMillis: 1_000,
              ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
            });
            try {
              await pool.query("SELECT 1");
              return { row, healthy: true };
            } catch {
              return { row, healthy: false };
            } finally {
              await pool.end().catch(() => {});
            }
          } catch {
            return { row, healthy: false };
          }
        })
      );

      const filteredRows = healthResults
        .filter(({ healthy }) => health === "healthy" ? healthy : !healthy)
        .map(({ row }) => row);
      const paginatedRows = filteredRows.slice(offset, offset + limit);

      return NextResponse.json({
        studios: paginatedRows.map((row) => ({
          id: row.id,
          name: row.name,
          domain: row.domain,
          logoUrl: getStudioLogoUrl(row.logo_url, row.logo_data),
          active: row.active,
          deactivateAt: row.deactivate_at?.toISOString() ?? null,
          notes: row.notes,
          createdAt: row.created_at,
          healthStatus: health,
        })),
        total: filteredRows.length,
      });
    }

    const countResult = await queryMaster<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM tenant_registry_studios
       ${baseWhere}`,
      [searchParam]
    );

    const { rows } = await queryMaster<StudioRow>(
      `SELECT id, name, domain, logo_url, logo_data, active, deactivate_at, notes, created_at
       FROM tenant_registry_studios
       ${baseWhere}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [searchParam, limit, offset]
    );

    const total = Number.parseInt(countResult.rows[0]?.total ?? "0", 10);

    return NextResponse.json({
      studios: rows.map((row) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        logoUrl: getStudioLogoUrl(row.logo_url, row.logo_data),
        active: row.active,
        deactivateAt: row.deactivate_at?.toISOString() ?? null,
        notes: row.notes,
        createdAt: row.created_at,
      })),
      total,
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
    const notesValue = formData.get("notes");
    if (
      typeof nameValue !== "string" ||
      typeof domainValue !== "string" ||
      typeof databaseUrlValue !== "string" ||
      typeof cloudinaryUrlValue !== "string" ||
      (deactivateAtValue !== null && typeof deactivateAtValue !== "string") ||
      (notesValue !== null && typeof notesValue !== "string")
    ) {
      return NextResponse.json({ error: "All studio fields are required" }, { status: 400 });
    }

    const name = nameValue.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Studio name must be 2 to 120 characters" }, { status: 400 });
    }
    const notes = typeof notesValue === "string" ? notesValue.trim() : "";
    if (notes.length > 5000) {
      return NextResponse.json({ error: "Studio notes must be 5000 characters or fewer" }, { status: 400 });
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
         (id, name, domain, logo_url, logo_data, favicon_data, database_url_encrypted, cloudinary_url_encrypted, deactivate_at, notes)
       VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8, $9)
       RETURNING id, name, domain, logo_url, logo_data, favicon_data, active, deactivate_at, notes, created_at`,
      [randomUUID(), name, domain, logoData, faviconData, databaseUrlEncrypted, cloudinaryUrlEncrypted, deactivateAt, notes]
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
        notes: studio.notes,
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
