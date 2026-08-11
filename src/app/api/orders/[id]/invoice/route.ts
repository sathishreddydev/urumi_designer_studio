import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, customers, outfits, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api-guard";

export const GET = withAuth(async (_request, { params }) => {
  const { id } = await params;

  // Get order with customer
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      orderDate: orders.orderDate,
      deliveryDate: orders.deliveryDate,
      trialDate: orders.trialDate,
      estimatedAmount: orders.estimatedAmount,
      advanceAmount: orders.advanceAmount,
      notes: orders.notes,
      status: orders.status,
      customerName: customers.name,
      customerMobile: customers.mobile,
      customerEmail: customers.email,
      customerAddress: customers.address,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Get outfits
  const orderOutfits = await db
    .select({
      id: outfits.id,
      name: outfits.name,
      type: outfits.type,
      status: outfits.status,
    })
    .from(outfits)
    .where(eq(outfits.orderId, id));

  // Get payments
  const orderPayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      notes: payments.notes,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.orderId, id));

  const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return NextResponse.json({
    order,
    outfits: orderOutfits,
    payments: orderPayments,
    totalPaid,
    balance: order.estimatedAmount ? Math.max(0, Number(order.estimatedAmount) - totalPaid) : 0,
  });
});
