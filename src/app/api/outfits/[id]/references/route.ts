import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { referenceImages, orders } from "@/lib/db/schema";
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
        isWorkPhoto: body.isWorkPhoto === true,
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

    if (body.action === "unlock") {
      const { id } = await params;
      await db
        .update(referenceImages)
        .set({ status: "DRAFT", notes: null, updatedAt: new Date() })
        .where(
          and(
            eq(referenceImages.outfitId, id),
            eq(referenceImages.type, body.type),
            eq(referenceImages.status, "LOCKED")
          )
        );

      // Move outfit back to WAITING_FOR_REFERENCES if it was at PRODUCTION_READY
      const { outfits: outfitsTable } = await import("@/lib/db/schema");
      const [outfit] = await db
        .select({ status: outfitsTable.status, orderId: outfitsTable.orderId })
        .from(outfitsTable)
        .where(eq(outfitsTable.id, id));

      if (outfit && outfit.status === "PRODUCTION_READY") {
        await db
          .update(outfitsTable)
          .set({ status: "WAITING_FOR_REFERENCES" as any, updatedAt: new Date() })
          .where(eq(outfitsTable.id, id));

        // Emit outfit_updated for status regression
        const { eventBus } = await import("@/lib/events");
        const [refOrder] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, outfit.orderId)).limit(1);
        eventBus.emit({ type: "outfit_updated", outfitId: id, orderId: outfit.orderId, customerId: refOrder?.customerId, userId: session.id, timestamp: Date.now() });
      }
    }

    if (body.action === "lock-single") {
      await db
        .update(referenceImages)
        .set({ status: "LOCKED", updatedAt: new Date() })
        .where(eq(referenceImages.id, body.id));
    }

    if (body.action === "unlock-single") {
      await db
        .update(referenceImages)
        .set({ status: "DRAFT", notes: null, updatedAt: new Date() })
        .where(eq(referenceImages.id, body.id));

      // If outfit has moved past WAITING_FOR_REFERENCES, move it back
      const { id: oid } = await params;
      const { outfits: outfitsTable } = await import("@/lib/db/schema");
      const [outfit] = await db
        .select({ status: outfitsTable.status, orderId: outfitsTable.orderId })
        .from(outfitsTable)
        .where(eq(outfitsTable.id, oid));

      if (outfit && outfit.status === "PRODUCTION_READY") {
        await db
          .update(outfitsTable)
          .set({ status: "WAITING_FOR_REFERENCES" as any, updatedAt: new Date() })
          .where(eq(outfitsTable.id, oid));

        // Emit outfit_updated for status regression
        const { eventBus } = await import("@/lib/events");
        const [refOrder2] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, outfit.orderId)).limit(1);
        eventBus.emit({ type: "outfit_updated", outfitId: oid, orderId: outfit.orderId, customerId: refOrder2?.customerId, userId: session.id, timestamp: Date.now() });
      }
    }

    // Emit event for any reference change
    const { eventBus } = await import("@/lib/events");
    const { id: outfitId } = await params;
    eventBus.emit({ type: "reference_updated", outfitId, userId: session.id, timestamp: Date.now() });

    return NextResponse.json({ success: true });
  }
);
