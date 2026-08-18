import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, customers, outfits, payments, invoices } from "@/lib/db/schema";
import { generateInvoiceNumber } from "@/lib/utils";
import { withPermission } from "@/lib/api-guard";
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

  // Fetch persisted invoice if exists
  const [persistedInvoice] = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, issuedAt: invoices.issuedAt, dueDate: invoices.dueDate, total: invoices.total, status: invoices.status, pdfUrl: invoices.pdfUrl })
    .from(invoices)
    .where(eq(invoices.orderId, id))
    .orderBy(invoices.issuedAt)
    .limit(1);

  const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return NextResponse.json({
    order,
    outfits: orderOutfits,
    payments: orderPayments,
    totalPaid,
    balance: order.estimatedAmount ? Math.max(0, Number(order.estimatedAmount) - totalPaid) : 0,
    invoice: persistedInvoice || null,
  });
});

export const POST = withPermission(
  { resource: "order", action: "update" },
  async (request, { params, session }) => {
    const { id } = await params;

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // compute total (prefer estimatedAmount, otherwise sum outfit prices)
    const orderOutfits = await db.select({ price: outfits.price }).from(outfits).where(eq(outfits.orderId, id));
    const outfitTotal = orderOutfits.reduce((s, o) => s + Number(o.price || 0), 0);
    const total = order.estimatedAmount ? Number(order.estimatedAmount) : outfitTotal;

    // generate invoice
    const invoiceNumber = generateInvoiceNumber();
    const [created] = await db.insert(invoices).values({
      orderId: id,
      invoiceNumber,
      total: String(total || 0),
      createdBy: session.id,
    }).returning();

    return NextResponse.json(created, { status: 201 });
  }
);
