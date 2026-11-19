import { NextResponse } from "next/server";
import { isOwnerAuthenticated } from "@/lib/tenant-registry/owner-auth";
import { queryMaster } from "@/lib/tenant-registry/db";
import { decryptTenantSecret } from "@/lib/tenant-registry/crypto";
import { normalizePostgresUrl } from "@/lib/tenant-registry/domain";
import { Pool } from "pg";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    if (!(await isOwnerAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { rows } = await queryMaster<{
      database_url_encrypted: string;
    }>(
      `SELECT database_url_encrypted FROM tenant_registry_studios WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    let dbUrl: string;
    try {
      dbUrl = normalizePostgresUrl(decryptTenantSecret(rows[0].database_url_encrypted));
    } catch {
      return NextResponse.json({ healthy: false, error: "Could not decrypt database URL" });
    }

    // Quick connection test — open a pool, run SELECT 1, close immediately
    const pool = new Pool({
      connectionString: dbUrl,
      max: 1,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 1_000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
    });

    const start = Date.now();
    try {
      await pool.query("SELECT 1");
      const latencyMs = Date.now() - start;
      return NextResponse.json({ healthy: true, latencyMs });
    } catch (err) {
      return NextResponse.json({
        healthy: false,
        error: err instanceof Error ? err.message : "Connection failed",
      });
    } finally {
      await pool.end().catch(() => {});
    }
  } catch (error) {
    console.error("Studio health check failed:", error);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
