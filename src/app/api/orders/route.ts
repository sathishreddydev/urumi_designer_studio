import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, customers, payments } from "@/lib/db/schema";
import { eq, ilike, count, desc, and, sum } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { eventBus } from "@/lib/events";
import { orderSchema } from "@/lib/validations";
import { generateOrderNumber } from "@/lib/utils";

export const GET = withPermission(
  { resource: "order", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (search) conditions.push(ilike(orders.orderNumber, `%${search}%`));
    if (status && status !== "all") conditions.push(eq(orders.status, status));
    const condition = conditions.length > 0 ? and(...conditions) : undefined;

    const ordersList = await db
      .select()
      .from(orders)
      .where(condition)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich with customer names and payment totals
    const enriched = await Promise.all(
      ordersList.map(async (order) => {
        const [cust] = await db
          .select({ name: customers.name, mobile: customers.mobile })
          .from(customers)
          .where(eq(customers.id, order.customerId))
          .limit(1);
        const [paymentResult] = await db
          .select({ totalPaid: sum(payments.amount) })
          .from(payments)
          .where(eq(payments.orderId, order.id));
        return {
          ...order,
          customerName: cust?.name || "",
          customerMobile: cust?.mobile || "",
          totalPaid: paymentResult?.totalPaid ? Number(paymentResult.totalPaid) : 0,
        };
      })
    );

    const [totalResult] = await db.select({ count: count() }).from(orders).where(condition);

    return NextResponse.json({ orders: enriched, total: totalResult.count, page, limit });
  }
);

export const POST = withPermission(
  { resource: "order", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    let order: any;
    let retries = 3;
    while (retries > 0) {
      try {
        [order] = await db
          .insert(orders)
          .values({
            orderNumber: generateOrderNumber(),
            customerId: parsed.data.customerId,
            deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate) : null,
            trialDate: parsed.data.trialDate ? new Date(parsed.data.trialDate) : null,
            estimatedAmount: parsed.data.estimatedAmount ? String(parsed.data.estimatedAmount) : null,
            advanceAmount: parsed.data.advanceAmount ? String(parsed.data.advanceAmount) : null,
            notes: parsed.data.notes,
          })
          .returning();
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0 || !err.message?.includes("unique")) {
          throw err;
        }
      }
    }

    // Emit event
    eventBus.emit({ type: "order_updated", orderId: order.id, customerId: parsed.data.customerId, timestamp: Date.now() });

    // If an advance amount was provided, record it as a payment immediately
    if (parsed.data.advanceAmount && parsed.data.advanceAmount > 0) {
      await db.insert(payments).values({
        orderId: order.id,
        amount: String(parsed.data.advanceAmount),
        method: "CASH", // default; can be overridden in follow-up
        notes: "Advance payment at order creation",
      });
      eventBus.emit({ type: "payment_added", orderId: order.id, customerId: parsed.data.customerId, timestamp: Date.now() });
    }

    return NextResponse.json(order, { status: 201 });
  }
);
