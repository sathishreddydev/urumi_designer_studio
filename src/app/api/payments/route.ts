import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments, orders, outfits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { paymentSchema } from "@/lib/validations";

export const POST = withPermission(
  { resource: "payment", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Validate the order actually exists and get customerId for event
    const [order] = await db
      .select({ id: orders.id, customerId: orders.customerId, estimatedAmount: orders.estimatedAmount })
      .from(orders)
      .where(eq(orders.id, body.orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderOutfits = await db
      .select({ price: outfits.price })
      .from(outfits)
      .where(eq(outfits.orderId, order.id));
    const outfitTotal = orderOutfits.reduce((sum, outfit) => sum + (Number(outfit.price) || 0), 0);
    const orderTotal = outfitTotal > 0 ? outfitTotal : Number(order.estimatedAmount) || 0;

    if (orderTotal > 0) {
      const settledPayments = await db
        .select({ amount: payments.amount, status: payments.status })
        .from(payments)
        .where(eq(payments.orderId, order.id));
      const totalPaid = settledPayments
        .filter((payment) => !payment.status || payment.status === "SETTLED")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const balance = orderTotal - totalPaid;

      if (parsed.data.amount > balance) {
        return NextResponse.json(
          { error: `Payment exceeds the remaining balance of ₹${Math.max(0, balance).toLocaleString()}.` },
          { status: 400 },
        );
      }
    }

    if (parsed.data.outfitId) {
      const [outfit] = await db
        .select({ id: outfits.id })
        .from(outfits)
        .where(eq(outfits.id, parsed.data.outfitId))
        .limit(1);

      if (!outfit) {
        return NextResponse.json({ error: "Selected outfit not found" }, { status: 404 });
      }

      const [outfitOrder] = await db
        .select({ orderId: outfits.orderId })
        .from(outfits)
        .where(eq(outfits.id, parsed.data.outfitId))
        .limit(1);

      if (outfitOrder?.orderId !== order.id) {
        return NextResponse.json({ error: "Selected outfit does not belong to this order" }, { status: 400 });
      }
    }

    const [payment] = await db
      .insert(payments)
      .values({
        orderId: parsed.data.orderId,
        amount: String(parsed.data.amount),
        method: parsed.data.method,
        status: parsed.data.status || "SETTLED",
        transactionRef: parsed.data.transactionRef || null,
        outfitId: parsed.data.outfitId || null,
        invoiceId: parsed.data.invoiceId || null,
        customerId: order.customerId,
        notes: parsed.data.notes,
      })
      .returning();

    // Emit real-time event with customerId so customer page also refreshes
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({
      type: "payment_added",
      orderId: body.orderId,
      customerId: order.customerId,
      timestamp: Date.now(),
    });

    return NextResponse.json(payment, { status: 201 });
  }
);
