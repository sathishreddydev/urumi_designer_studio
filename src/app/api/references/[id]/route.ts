import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { referenceImages, outfits, orders } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { deleteFromCloudinary } from "@/lib/cloudinary/upload";
import { getStudioDb } from "@/lib/multi-tenant/studio";

export const DELETE = withPermission(
  { resource: "reference", action: "update" },
  async (_request, { params }) => {
    const { id } = await params;

    // Get the correct database for this studio
    const db = await getStudioDb();

    // Get the reference to find its URL
    const [ref] = await db
      .select()
      .from(referenceImages)
      .where(eq(referenceImages.id, id))
      .limit(1);

    if (!ref) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    // Cannot delete LOCKED references
    if (ref.status === "LOCKED") {
      return NextResponse.json({ error: "Cannot delete locked references. Unlock first." }, { status: 400 });
    }

    // Delete from Cloudinary if it's a Cloudinary URL
    if (ref.url.includes("cloudinary.com")) {
      await deleteFromCloudinary(ref.url);
    }

    // Delete from DB
    await db.delete(referenceImages).where(eq(referenceImages.id, id));

    // Emit event
    const { eventBus } = await import("@/lib/events");
    // Look up customerId so portal SSE can match this event
    let refCustomerId: string | undefined;
    const [refOutfit] = await db.select({ orderId: outfits.orderId }).from(outfits).where(eq(outfits.id, ref.outfitId)).limit(1);
    if (refOutfit?.orderId) {
      const [refOrder] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, refOutfit.orderId)).limit(1);
      refCustomerId = refOrder?.customerId;
    }
    eventBus.emit({ type: "reference_updated", outfitId: ref.outfitId, customerId: refCustomerId, timestamp: Date.now() });

    return NextResponse.json({ success: true });
  }
);
