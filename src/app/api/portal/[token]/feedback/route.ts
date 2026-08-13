import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, referenceImages, outfits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Verify the token belongs to a customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.portalToken, token))
    .limit(1);

  if (!customer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const body = await request.json();
  const { referenceId, outfitId, feedback } = body;

  if (!referenceId || !["approved", "rejected"].includes(feedback)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (feedback === "approved") {
    // Approve → lock the reference
    await db
      .update(referenceImages)
      .set({
        status: "LOCKED" as any,
        notes: "✓ Customer approved",
        updatedAt: new Date(),
      })
      .where(eq(referenceImages.id, referenceId));

    // Check if all references for this outfit are now locked
    if (outfitId) {
      const allRefs = await db
        .select({ id: referenceImages.id, status: referenceImages.status })
        .from(referenceImages)
        .where(eq(referenceImages.outfitId, outfitId));

      const allLocked = allRefs.length > 0 && allRefs.every((r) => r.status === "LOCKED");

      if (allLocked) {
        // All references approved by customer → auto-advance outfit if in WAITING_FOR_REFERENCES
        const [outfit] = await db
          .select({ status: outfits.status })
          .from(outfits)
          .where(eq(outfits.id, outfitId));

        if (outfit?.status === "WAITING_FOR_REFERENCES") {
          const { onReferencesLocked } = await import("@/lib/auto-triggers");
          await onReferencesLocked(outfitId, "customer");
        }
      }
    }
  } else {
    // Reject → keep as draft, add rejection note
    await db
      .update(referenceImages)
      .set({
        status: "DRAFT" as any,
        notes: "✗ Customer rejected",
        updatedAt: new Date(),
      })
      .where(eq(referenceImages.id, referenceId));
  }

  return NextResponse.json({ success: true, feedback });
}
