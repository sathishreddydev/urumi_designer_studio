import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, outfits, payments, customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";

export const GET = withPermission(
  { resource: "order", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Batch: fetch customer, outfits, payments in parallel
    const [customerResult, orderOutfits, orderPayments] = await Promise.all([
      db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1),
      db.select().from(outfits).where(eq(outfits.orderId, id)),
      db.select().from(payments).where(eq(payments.orderId, id)),
    ]);

    return NextResponse.json({
      ...order,
      customer: customerResult[0] || null,
      outfits: orderOutfits,
      payments: orderPayments,
    });
  }
);

export const PATCH = withPermission(
  { resource: "order", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = { updatedAt: new Date() };
    if (body.deliveryDate) updateData.deliveryDate = new Date(body.deliveryDate);
    if (body.trialDate) updateData.trialDate = new Date(body.trialDate);
    if (body.status) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.estimatedAmount !== undefined) updateData.estimatedAmount = body.estimatedAmount ? String(body.estimatedAmount) : null;
    if (body.advanceAmount !== undefined) updateData.advanceAmount = body.advanceAmount ? String(body.advanceAmount) : null;

    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();

    // Emit event
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({ type: "order_updated", orderId: id, customerId: order.customerId, timestamp: Date.now() });

    return NextResponse.json(order);
  }
);
