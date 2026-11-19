import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { queryMaster } from "@/lib/tenant-registry/db";
import { decryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { normalizePostgresUrl } from "@/lib/tenant-registry/domain";
import { generatePrefixedId } from "@/lib/id";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface StudioRow {
  database_url_encrypted: string;
}

// ─── shared helper ────────────────────────────────────────────────────────────

async function getTenantPool(studioId: string): Promise<{ pool: Pool } | NextResponse> {
  const { rows } = await queryMaster<StudioRow>(
    `SELECT database_url_encrypted
     FROM tenant_registry_studios
     WHERE id = $1
     LIMIT 1`,
    [studioId]
  );
  if (!rows.length) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }

  let databaseUrl: string;
  try {
    databaseUrl = normalizePostgresUrl(decryptTenantSecret(rows[0].database_url_encrypted));
  } catch {
    return NextResponse.json(
      { error: "Could not decrypt studio database credentials" },
      { status: 500 }
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 8_000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  });

  return { pool };
}

function connectionErrorResponse(error: unknown): NextResponse | null {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "28P01", "28000"].includes(code)) {
      return NextResponse.json(
        { error: "Could not connect to the studio database. Check the credentials and try again." },
        { status: 502 }
      );
    }
  }
  return null;
}

// ─── POST — create or update admin ────────────────────────────────────────────

/**
 * POST /api/owner/studios/[id]/admin
 * Body (JSON): { email: string; password: string; name?: string }
 *
 * Upserts an ADMIN user in the studio's tenant DB.
 * If the email already exists the name, password and role are updated.
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const poolResult = await getTenantPool(id);
    if (poolResult instanceof NextResponse) return poolResult;
    const { pool } = poolResult;

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email, password, name } = body as Record<string, unknown>;

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const adminName = name.trim();

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const userId = generatePrefixedId("usr");

      const { rows: upserted } = await pool.query<{ id: string; email: string }>(
        `INSERT INTO users (id, name, email, password, role)
         VALUES ($1, $2, $3, $4, 'ADMIN')
         ON CONFLICT (email)
         DO UPDATE SET
           name       = EXCLUDED.name,
           password   = EXCLUDED.password,
           role       = 'ADMIN',
           active     = true,
           updated_at = now()
         RETURNING id, email`,
        [userId, adminName, normalizedEmail, passwordHash]
      );

      // Best-effort: record admin email in master DB for visibility
      await queryMaster(
        `UPDATE tenant_registry_studios SET admin_email = $2, updated_at = now() WHERE id = $1`,
        [id, normalizedEmail]
      ).catch(() => { /* column may not exist on older deployments */ });

      return NextResponse.json(
        { success: true, admin: { id: upserted[0].id, email: upserted[0].email } },
        { status: 200 }
      );
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Could not set studio admin credentials:", error);
    return connectionErrorResponse(error) ??
      NextResponse.json({ error: "Could not set admin credentials" }, { status: 500 });
  }
}

// ─── PATCH — update name and/or password for an existing admin ────────────────

/**
 * PATCH /api/owner/studios/[id]/admin
 * Body (JSON): { email: string; name?: string; password?: string }
 *
 * Updates the name and/or password of the admin identified by email.
 * At least one of name or password must be supplied.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const poolResult = await getTenantPool(id);
    if (poolResult instanceof NextResponse) return poolResult;
    const { pool } = poolResult;

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email, name, password } = body as Record<string, unknown>;

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!name && !password) {
      return NextResponse.json({ error: "Supply at least a new name or new password" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const setClauses: string[] = ["updated_at = now()"];
      const values: unknown[] = [normalizedEmail];

      if (typeof name === "string" && name.trim()) {
        values.push(name.trim());
        setClauses.push(`name = $${values.length}`);
      }
      if (typeof password === "string" && password.length >= 8) {
        const passwordHash = await bcrypt.hash(password, 12);
        values.push(passwordHash);
        setClauses.push(`password = $${values.length}`);
      }

      const { rows: updated, rowCount } = await pool.query<{ id: string; email: string }>(
        `UPDATE users
         SET ${setClauses.join(", ")}
         WHERE email = $1 AND role = 'ADMIN'
         RETURNING id, email`,
        values
      );

      if (!rowCount) {
        return NextResponse.json(
          { error: "No ADMIN user found with that email in this studio's database" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, admin: { id: updated[0].id, email: updated[0].email } });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Could not update studio admin credentials:", error);
    return connectionErrorResponse(error) ??
      NextResponse.json({ error: "Could not update admin credentials" }, { status: 500 });
  }
}

// ─── DELETE — remove admin user by email ──────────────────────────────────────

/**
 * DELETE /api/owner/studios/[id]/admin
 * Body (JSON): { email: string }
 *
 * Permanently removes the ADMIN user with the given email from the tenant DB.
 * Also clears admin_email in the master registry.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const poolResult = await getTenantPool(id);
    if (poolResult instanceof NextResponse) return poolResult;
    const { pool } = poolResult;

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email } = body as Record<string, unknown>;
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { rowCount } = await pool.query(
        `DELETE FROM users WHERE email = $1 AND role = 'ADMIN'`,
        [normalizedEmail]
      );

      if (!rowCount) {
        return NextResponse.json(
          { error: "No ADMIN user found with that email in this studio's database" },
          { status: 404 }
        );
      }

      // Clear admin_email in master DB
      await queryMaster(
        `UPDATE tenant_registry_studios SET admin_email = NULL, updated_at = now() WHERE id = $1`,
        [id]
      ).catch(() => { /* column may not exist on older deployments */ });

      return NextResponse.json({ success: true });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("Could not delete studio admin:", error);
    return connectionErrorResponse(error) ??
      NextResponse.json({ error: "Could not delete admin user" }, { status: 500 });
  }
}
