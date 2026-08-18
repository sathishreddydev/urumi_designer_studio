import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, referenceImages, outfits, orders } from "@/lib/db/schema";
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

  // Verify the token belongs to a real customer
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.portalToken, token))
    .limit(1);

  if (!customer) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const body = await request.json();
  const { referenceId, outfitId, feedback } = body;

  if (
    typeof referenceId !== "string" || !referenceId ||
    typeof outfitId !== "string" || !outfitId ||
    !["approved", "rejected"].includes(feedback)
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // ── Ownership: verify the outfit belongs to one of THIS customer's orders ──
  const [ownerRow] = await db
    .select({ customerId: orders.customerId })
    .from(outfits)
    .innerJoin(orders, eq(outfits.orderId, orders.id))
    .where(eq(outfits.id, outfitId))
    .limit(1);

  if (!ownerRow || ownerRow.customerId !== customer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Ownership: verify the reference belongs to the claimed outfit ──────────
  const [refRow] = await db
    .select({ id: referenceImages.id })
    .from(referenceImages)
    .where(and(
      eq(referenceImages.id, referenceId),
      eq(referenceImages.outfitId, outfitId)
    ))
    .limit(1);

  if (!refRow) {
    return NextResponse.json({ error: "Reference not found" }, { status: 403 });
  }

  // ── Apply feedback ───────────────────────────────────────────────────────────
  if (feedback === "approved") {
    await db
      .update(referenceImages)
      .set({ status: "LOCKED" as any, notes: "✓ Customer approved", updatedAt: new Date() })
      .where(eq(referenceImages.id, referenceId));

    // Check if all references for this outfit are now locked → auto-advance
    const allRefs = await db
      .select({ status: referenceImages.status })
      .from(referenceImages)
      .where(eq(referenceImages.outfitId, outfitId));

    const allLocked = allRefs.length > 0 && allRefs.every((r) => r.status === "LOCKED");
    if (allLocked) {
      const [outfit] = await db
        .select({ status: outfits.status })
        .from(outfits)
        .where(eq(outfits.id, outfitId));
      if (outfit?.status === "WAITING_FOR_REFERENCES") {
        const { onReferencesLocked } = await import("@/lib/auto-triggers");
        await onReferencesLocked(outfitId, "customer");
      }
    }
  } else {
    await db
      .update(referenceImages)
      .set({ status: "DRAFT" as any, notes: "✗ Customer rejected", updatedAt: new Date() })
      .where(eq(referenceImages.id, referenceId));
  }

  // ── Emit real-time events so dashboard staff see feedback instantly ─────────
  const { eventBus } = await import("@/lib/events");
  eventBus.emit({ type: "customer_feedback", outfitId, customerId: customer.id, timestamp: Date.now() });
  eventBus.emit({ type: "reference_updated", outfitId, customerId: customer.id, timestamp: Date.now() });

  return NextResponse.json({ success: true, feedback });
}
