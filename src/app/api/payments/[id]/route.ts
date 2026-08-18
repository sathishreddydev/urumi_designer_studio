import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments, orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";

export const DELETE = withPermission(
  { resource: "payment", action: "delete" },
  async (_request, { params, session }) => {
    const { id } = await params;

    // Only ADMIN can delete payments
    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can void payments" },
        { status: 403 }
      );
    }

    const [payment] = await db
      .select({ orderId: payments.orderId, amount: payments.amount })
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    await db.delete(payments).where(eq(payments.id, id));

    // Emit real-time event so all clients refresh
    const [order] = await db
      .select({ customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1);

    const { eventBus } = await import("@/lib/events");
    eventBus.emit({
      type: "payment_added",
      orderId: payment.orderId,
      customerId: order?.customerId,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  }
);
