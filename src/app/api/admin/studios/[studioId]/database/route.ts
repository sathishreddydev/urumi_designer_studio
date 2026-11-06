/**
 * POST /api/admin/studios/[studioId]/database
 *
 * Saves per-studio database connection (BYODB — Bring Your Own Database).
 * Same pattern as Cloudinary credentials.
 *
 * The connection string is encrypted before storage.
 * Connection is validated before saving.
 *
 * Body:
 *   {
 *     accountType: "shared" | "own",
 *     databaseUrl: "postgresql://user:pass@host:5432/dbname"  (when "own")
 *   }
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { masterDb, studios } from "@/lib/db/master";
import { getAdminSession } from "@/lib/admin-auth";
import { encrypt } from "@/lib/encryption";
import { invalidateDomainCache } from "@/lib/multi-tenant/domain-resolver";
import { Pool } from "pg";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studioId } = await params;
    const body = await request.json();
    const { accountType, databaseUrl } = body;

    // Verify studio exists
    const [studio] = await masterDb
      .select()
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // If switching to shared, clear the custom URL
    if (accountType === "shared") {
      await masterDb
        .update(studios)
        .set({
          databaseAccountType: "shared" as any,
          databaseUrl: null,
          updatedAt: new Date(),
        } as any)
        .where(eq(studios.id, studioId));

      invalidateDomainCache(studio.domain);

      return NextResponse.json({
        success: true,
        message: "Switched to shared database",
      });
    }

    // If using own database, validate the connection first
    if (!databaseUrl) {
      return NextResponse.json(
        { error: "Database URL is required" },
        { status: 400 }
      );
    }

    // Test the connection before saving
    try {
      const testPool = new Pool({
        connectionString: databaseUrl,
        max: 1,
        connectionTimeoutMillis: 5000,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      });

      const client = await testPool.connect();
      await client.query("SELECT 1");
      client.release();
      await testPool.end();
    } catch (err) {
      return NextResponse.json(
        { error: "Database connection failed: " + (err as Error).message },
        { status: 400 }
      );
    }

    // Encrypt the connection string before storing
    const encryptedUrl = encrypt(databaseUrl);

    await masterDb
      .update(studios)
      .set({
        databaseAccountType: "own" as any,
        databaseUrl: encryptedUrl,
        updatedAt: new Date(),
      } as any)
      .where(eq(studios.id, studioId));

    invalidateDomainCache(studio.domain);

    return NextResponse.json({
      success: true,
      message: "Database connection saved and validated successfully",
    });
  } catch (error) {
    console.error("Save database credentials error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

/**
 * GET /api/admin/studios/[studioId]/database
 * Returns current database config (without the encrypted URL).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studioId } = await params;

    const [studio] = await masterDb
      .select({
        databaseAccountType: (studios as any).databaseAccountType,
      })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    return NextResponse.json({
      accountType: (studio as any).databaseAccountType ?? "shared",
      hasOwnUrl: !!(await masterDb
        .select({ url: (studios as any).databaseUrl })
        .from(studios)
        .where(eq(studios.id, studioId))
        .limit(1)
      )[0]?.url,
    });
  } catch (error) {
    console.error("Get database config error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
