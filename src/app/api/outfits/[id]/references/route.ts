import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { referenceImages } from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { withPermission, withAuth } from "@/lib/api-guard";

// GET — all authenticated users can read (Master sees only LOCKED)
export const GET = withAuth(async (_request, { params, session }) => {
  const { id } = await params;

  let refs = await db
    .select()
    .from(referenceImages)
    .where(eq(referenceImages.outfitId, id))
    .orderBy(referenceImages.createdAt);

  // Master can only see locked references
  if (session.role === "MASTER") {
    refs = refs.filter((r) => r.status === "LOCKED");
  }

  return NextResponse.json(refs);
});

// POST — upload new reference (Designer/Admin only)
export const POST = withPermission(
  { resource: "reference", action: "upload" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();

    const [reference] = await db
      .insert(referenceImages)
      .values({
        outfitId: id,
        type: body.type,
        url: body.url,
        filename: body.filename,
        uploadedBy: session.id,
        isCustomerUpload: false,
        notes: body.notes,
      })
      .returning();

    // Emit event
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({ type: "reference_updated", outfitId: id, userId: session.id, timestamp: Date.now() });

    return NextResponse.json(reference, { status: 201 });
  }
);

// PATCH — select or lock references (Designer/Admin only)
export const PATCH = withPermission(
  { resource: "reference", action: "select" },
  async (request, { params, session }) => {
    const body = await request.json();

    if (body.action === "select") {
      await db
        .update(referenceImages)
        .set({ status: "SELECTED", updatedAt: new Date() })
        .where(inArray(referenceImages.id, body.ids));
    }

    if (body.action === "lock") {
      const { id } = await params;
      await db
        .update(referenceImages)
        .set({ status: "LOCKED", updatedAt: new Date() })
        .where(
          and(
            eq(referenceImages.outfitId, id),
            eq(referenceImages.type, body.type),
            eq(referenceImages.status, "SELECTED")
          )
        );

      // Auto-trigger: refs locked → PRODUCTION_READY
      const { onReferencesLocked } = await import("@/lib/auto-triggers");
      await onReferencesLocked(id, session.id);
    }

    // Emit event for any reference change
    const { eventBus } = await import("@/lib/events");
    const { id: outfitId } = await params;
    eventBus.emit({ type: "reference_updated", outfitId, userId: session.id, timestamp: Date.now() });

    return NextResponse.json({ success: true });
  }
);
