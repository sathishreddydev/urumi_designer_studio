/**
 * POST /api/public/studios/branding
 *
 * Updates branding for a studio during the setup wizard.
 * Public endpoint — called from the setup page with the studio ID.
 * (The studio admin user doesn't exist yet in the auth system
 *  during setup, so we can't use the normal auth guard.)
 *
 * In production, add a one-time setup token for security.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { masterDb, studios } from "@/lib/db/master";
import { invalidateDomainCache } from "@/lib/multi-tenant/domain-resolver";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studioId, brandName, primaryColor, logoUrl, faviconUrl } = body;

    if (!studioId) {
      return NextResponse.json(
        { error: "Studio ID is required" },
        { status: 400 }
      );
    }

    // Verify studio exists
    const [studio] = await masterDb
      .select()
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (!studio) {
      return NextResponse.json(
        { error: "Studio not found" },
        { status: 404 }
      );
    }

    // Build update object (only update provided fields)
    const update: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (brandName) update.brandName = brandName;
    if (primaryColor) update.primaryColor = primaryColor;
    if (logoUrl) update.logoUrl = logoUrl;
    if (faviconUrl) update.faviconUrl = faviconUrl;

    await masterDb
      .update(studios)
      .set(update)
      .where(eq(studios.id, studioId));

    // Invalidate domain cache so changes appear immediately
    invalidateDomainCache(studio.domain);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Branding update error:", error);
    return NextResponse.json(
      { error: "Failed to update branding" },
      { status: 500 }
    );
  }
}
