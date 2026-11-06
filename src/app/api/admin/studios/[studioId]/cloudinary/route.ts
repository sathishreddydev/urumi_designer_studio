/**
 * POST /api/admin/studios/[studioId]/cloudinary
 *
 * Saves per-studio Cloudinary credentials.
 * The API secret is encrypted before storage.
 *
 * Also validates the credentials before saving.
 *
 * Body:
 *   {
 *     cloudinaryCloudName: "elite-designer",
 *     cloudinaryApiKey: "123456789",
 *     cloudinaryApiSecret: "abc...xyz",
 *     accountType: "own" | "shared"
 *   }
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { masterDb, studios } from "@/lib/db/master";
import { getAdminSession } from "@/lib/admin-auth";
import { encrypt } from "@/lib/encryption";
import { validateCloudinaryCredentials } from "@/lib/cloudinary/config";
import { invalidateDomainCache } from "@/lib/multi-tenant/domain-resolver";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    // Check admin auth
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studioId } = await params;
    const body = await request.json();

    const { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret, accountType } = body;

    // Verify studio exists
    const [studio] = await masterDb
      .select()
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // If switching to shared account, just update the type
    if (accountType === "shared") {
      await masterDb
        .update(studios)
        .set({
          cloudinaryAccountType: "shared",
          cloudinaryCloudName: null,
          cloudinaryApiKey: null,
          cloudinaryApiSecret: null,
          updatedAt: new Date(),
        })
        .where(eq(studios.id, studioId));

      invalidateDomainCache(studio.domain);

      return NextResponse.json({
        success: true,
        message: "Switched to shared Cloudinary account",
      });
    }

    // If using own account, validate credentials first
    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      return NextResponse.json(
        { error: "Cloud name, API key, and API secret are all required" },
        { status: 400 }
      );
    }

    // Validate credentials by making a test API call
    const validation = await validateCloudinaryCredentials(
      cloudinaryCloudName,
      cloudinaryApiKey,
      cloudinaryApiSecret
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid Cloudinary credentials" },
        { status: 400 }
      );
    }

    // Encrypt the API secret before storing
    const encryptedSecret = encrypt(cloudinaryApiSecret);

    // Save credentials
    await masterDb
      .update(studios)
      .set({
        cloudinaryAccountType: "own",
        cloudinaryCloudName,
        cloudinaryApiKey,
        cloudinaryApiSecret: encryptedSecret,
        updatedAt: new Date(),
      })
      .where(eq(studios.id, studioId));

    // Invalidate domain cache so changes take effect immediately
    invalidateDomainCache(studio.domain);

    return NextResponse.json({
      success: true,
      message: "Cloudinary credentials saved and validated successfully",
    });
  } catch (error) {
    console.error("Save Cloudinary credentials error:", error);
    return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 });
  }
}

/**
 * GET /api/admin/studios/[studioId]/cloudinary
 * Returns the current Cloudinary config (without the secret).
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
        accountType: studios.cloudinaryAccountType,
        cloudName: studios.cloudinaryCloudName,
        apiKey: studios.cloudinaryApiKey,
      })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    return NextResponse.json({
      accountType: studio.accountType,
      cloudName: studio.cloudName,
      apiKey: studio.apiKey,
      hasSecret: !!(await masterDb
        .select({ apiSecret: studios.cloudinaryApiSecret })
        .from(studios)
        .where(eq(studios.id, studioId))
        .limit(1)
      )[0]?.apiSecret,
    });
  } catch (error) {
    console.error("Get Cloudinary config error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
