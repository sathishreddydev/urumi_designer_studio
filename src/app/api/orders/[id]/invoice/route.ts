import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, customers, outfits, payments, invoices } from "@/lib/db/schema";
import { generateInvoiceNumber } from "@/lib/utils";
import { withPermission } from "@/lib/api-guard";
import { eq, desc } from "drizzle-orm";
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

  // Get outfits — include price + addOns for line items
  const orderOutfits = await db
    .select({
      id: outfits.id,
      name: outfits.name,
      type: outfits.type,
      status: outfits.status,
      price: outfits.price,
      addOns: outfits.addOns,
    })
    .from(outfits)
    .where(eq(outfits.orderId, id));

  // Get payments — only count SETTLED payments toward balance
  const orderPayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      status: payments.status,
      transactionRef: payments.transactionRef,
      notes: payments.notes,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.orderId, id));

  // Fetch the most recently issued invoice if one exists
  const [persistedInvoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      issuedAt: invoices.issuedAt,
      dueDate: invoices.dueDate,
      total: invoices.total,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
    })
    .from(invoices)
    .where(eq(invoices.orderId, id))
    .orderBy(desc(invoices.issuedAt))  // most recent first
    .limit(1);

  // Only count SETTLED payments in the balance calculation
  const totalPaid = orderPayments
    .filter((p) => p.status === "SETTLED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Use live outfit sum (price + addOns) as the source of truth for the invoice total
  const outfitTotal = orderOutfits.reduce((s, o) => {
    const outfitPrice = Number(o.price || 0);
    const addOnsTotal = ((o.addOns as any[]) || []).reduce((as: number, a: any) => as + (Number(a.price) || 0), 0);
    return s + outfitPrice + addOnsTotal;
  }, 0);
  const invoiceTotal = outfitTotal > 0 ? outfitTotal : (order.estimatedAmount ? Number(order.estimatedAmount) : 0);
  // Show real balance — negative means overpaid (credit due)
  const balance = invoiceTotal > 0 ? invoiceTotal - totalPaid : 0;

  return NextResponse.json({
    order,
    outfits: orderOutfits,
    payments: orderPayments,
    totalPaid,
    outfitTotal: invoiceTotal,
    balance,
    invoice: persistedInvoice || null,
  });
});

export const POST = withPermission(
  { resource: "order", action: "update" },
  async (request, { params, session }) => {
    const { id } = await params;

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Guard: prevent duplicate invoices for the same order
    const [existing] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.orderId, id))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An invoice already exists for this order", invoiceId: existing.id },
        { status: 409 }
      );
    }

    // compute total — always use live outfit price sum + addOns (source of truth)
    const orderOutfits = await db.select({ price: outfits.price, addOns: outfits.addOns }).from(outfits).where(eq(outfits.orderId, id));
    const outfitTotal = orderOutfits.reduce((s, o) => {
      const outfitPrice = Number(o.price || 0);
      const addOnsTotal = ((o.addOns as any[]) || []).reduce((as: number, a: any) => as + (Number(a.price) || 0), 0);
      return s + outfitPrice + addOnsTotal;
    }, 0);
    // fall back to estimatedAmount snapshot only if no outfit prices set
    const total = outfitTotal > 0 ? outfitTotal : (order.estimatedAmount ? Number(order.estimatedAmount) : 0);

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
