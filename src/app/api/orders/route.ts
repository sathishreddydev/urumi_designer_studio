import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, customers, payments } from "@/lib/db/schema";
import { eq, ilike, or, count, desc, and, sum } from "drizzle-orm";
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
    if (search) {
      conditions.push(
        or(
          ilike(orders.orderNumber, `%${search}%`),
          ilike(customers.name, `%${search}%`),
          ilike(customers.mobile, `%${search}%`)
        )
      );
    }
    if (status && status !== "all") conditions.push(eq(orders.status, status));
    const condition = conditions.length > 0 ? and(...conditions) : undefined;

    const ordersList = await db
      .select({ order: orders })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(condition)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset)
      .then((rows) => rows.map((r) => r.order));

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
          .where(and(eq(payments.orderId, order.id), eq(payments.status, "SETTLED")));
        return {
          ...order,
          customerName: cust?.name || "",
          customerMobile: cust?.mobile || "",
          totalPaid: paymentResult?.totalPaid ? Number(paymentResult.totalPaid) : 0,
        };
      })
    );

    const [totalResult] = await db
      .select({ count: count() })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(condition);

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

    // Note: advance payments should be recorded explicitly via the /api/payments
    // endpoint to avoid duplicate records and to allow the client to provide
    // payment `method` and `notes`. Previous behaviour auto-inserted a payment
    // here which caused duplicates when the client also created the payment.

    return NextResponse.json(order, { status: 201 });
  }
);
