import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { referenceImages, outfits, orders } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";

export const DELETE = withPermission(
  { resource: "reference", action: "update" },
  async (_request, { params }) => {
    const { id } = await params;

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

async function deleteFromCloudinary(url: string) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) return;

    // Extract public ID from URL
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/v123/folder/filename.jpg
    const parts = url.split("/upload/");
    if (parts.length < 2) return;

    const pathAfterUpload = parts[1];
    // Remove version prefix (v123/) and extension
    const publicId = pathAfterUpload
      .replace(/^v\d+\//, "")
      .replace(/\.[^.]+$/, "");

    const timestamp = Math.round(Date.now() / 1000);
    const crypto = await import("crypto");
    const signature = crypto
      .createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);

    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    // Don't fail the request if Cloudinary delete fails
  }
}
