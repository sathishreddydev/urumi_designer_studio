import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, referenceImages, outfits } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { portalLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limiting
  const ip = getClientIp(request);
  const { allowed, resetMs } = portalLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) } }
    );
  }

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

  if (!referenceId || !outfitId || !["approved", "rejected"].includes(feedback)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Ownership check: verify the outfit belongs to this customer's orders
  const [ownershipCheck] = await db
    .select({ outfitId: outfits.id })
    .from(outfits)
    .innerJoin(
      // inline join via orders table
      customers,
      eq(customers.id, customer.id)
    )
    .where(eq(outfits.id, outfitId))
    .limit(1);

  // We need to check via the orders table
  const { orders } = await import("@/lib/db/schema");
  const [ownershipRow] = await db
    .select({ outfitId: outfits.id })
    .from(outfits)
    .innerJoin(orders, eq(outfits.orderId, orders.id))
    .where(
      eq(outfits.id, outfitId)
    )
    .limit(1);

  // Verify the order belongs to this customer
  const [orderOwner] = await db
    .select({ customerId: orders.customerId })
    .from(orders)
    .innerJoin(outfits, eq(outfits.orderId, orders.id))
    .where(eq(outfits.id, outfitId))
    .limit(1);

  if (!orderOwner || orderOwner.customerId !== customer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Also verify the referenceId belongs to the claimed outfitId
  const [refOwnership] = await db
    .select({ id: referenceImages.id })
    .from(referenceImages)
    .where(
      and(
        eq(referenceImages.id, referenceId),
        eq(referenceImages.outfitId, outfitId)
      )
    )
    .limit(1);

  if (!refOwnership) {
    return NextResponse.json({ error: "Reference not found or does not belong to this outfit" }, { status: 403 });
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

  // Emit events so dashboard staff see customer feedback in real-time
  const { eventBus } = await import("@/lib/events");
  eventBus.emit({
    type: "customer_feedback",
    outfitId: outfitId || undefined,
    customerId: customer.id,
    timestamp: Date.now(),
  });
  eventBus.emit({
    type: "reference_updated",
    outfitId: outfitId || undefined,
    customerId: customer.id,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true, feedback });
}
