import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments, orders, customers } from "@/lib/db/schema";
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

    if (!body.orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    // Validate the order actually exists and get customerId for event
    const [order] = await db
      .select({ id: orders.id, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, body.orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const [payment] = await db
      .insert(payments)
      .values({
        orderId: body.orderId,
        amount: String(parsed.data.amount),
        method: parsed.data.method,
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
