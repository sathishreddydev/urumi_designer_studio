/**
 * PATCH /api/admin/studios/[studioId]
 *
 * Updates a studio's status, branding, or features.
 * Requires admin auth.
 *
 * Actions:
 *   - status: suspend / activate / cancel
 *   - branding: brandName, logoUrl, primaryColor, etc.
 *   - features: toggle feature flags
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { masterDb, studios } from "@/lib/db/master";
import { getAdminSession } from "@/lib/admin-auth";
import { invalidateDomainCache } from "@/lib/multi-tenant/domain-resolver";

export async function PATCH(
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

    // Verify studio exists
    const [studio] = await masterDb
      .select()
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // ── Status change ──────────────────────────────────────────────────────
    if (body.action === "suspend") {
      update.status = "suspended";
      update.suspendedAt = new Date();
      update.suspendReason = body.reason || "Suspended by admin";
    } else if (body.action === "activate") {
      update.status = "active";
      update.suspendedAt = null;
      update.suspendReason = null;
    } else if (body.action === "cancel") {
      update.status = "cancelled";
      update.suspendedAt = new Date();
      update.suspendReason = "Subscription cancelled";
    }

    // ── Branding update ─────────────────────────────────────────────────────
    if (body.brandName) update.brandName = body.brandName;
    if (body.logoUrl !== undefined) update.logoUrl = body.logoUrl || null;
    if (body.faviconUrl !== undefined) update.faviconUrl = body.faviconUrl || null;
    if (body.primaryColor !== undefined) update.primaryColor = body.primaryColor || null;
    if (body.secondaryColor !== undefined) update.secondaryColor = body.secondaryColor || null;
    if (body.customCss !== undefined) update.customCss = body.customCss || null;
    if (body.businessEmail !== undefined) update.businessEmail = body.businessEmail || null;
    if (body.businessPhone !== undefined) update.businessPhone = body.businessPhone || null;
    if (body.businessAddress !== undefined) update.businessAddress = body.businessAddress || null;

    // ── Features update ─────────────────────────────────────────────────────
    if (body.features) {
      update.features = { ...studio.features, ...body.features };
    }

    // ── Plan update ─────────────────────────────────────────────────────────
    if (body.planType) {
      update.planType = body.planType;
    }

    await masterDb.update(studios).set(update).where(eq(studios.id, studioId));

    // Invalidate domain cache so changes take effect immediately
    invalidateDomainCache(studio.domain);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin studio update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/**
 * GET /api/admin/studios/[studioId]
 * Returns full studio details for the admin detail page.
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
      .select()
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    return NextResponse.json(studio);
  } catch (error) {
    console.error("Admin studio get error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
