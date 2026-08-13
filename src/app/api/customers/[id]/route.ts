import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, orders, outfits, payments, customerMeasurements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { customerSchema } from "@/lib/validations";

export const GET = withPermission(
  { resource: "customer", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const customerOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, id));

    let allMeasurements: any[] = [];
    allMeasurements = await db
      .select()
      .from(customerMeasurements)
      .where(eq(customerMeasurements.customerId, id))
      .orderBy(desc(customerMeasurements.version));

    const ordersWithOutfits = await Promise.all(
      customerOrders.map(async (order) => {
        const [orderOutfits, orderPayments] = await Promise.all([
          db.select({ id: outfits.id, name: outfits.name, type: outfits.type, status: outfits.status })
            .from(outfits).where(eq(outfits.orderId, order.id)),
          db.select().from(payments).where(eq(payments.orderId, order.id)),
        ]);
        return { ...order, outfits: orderOutfits, payments: orderPayments };
      })
    );

    return NextResponse.json({ ...customer, orders: ordersWithOutfits, measurements: allMeasurements });
  }
);

export const PATCH = withPermission(
  { resource: "customer", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = customerSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const [customer] = await db
      .update(customers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();

    return NextResponse.json(customer);
  }
);

export const DELETE = withPermission(
  { resource: "customer", action: "delete" },
  async (_request, { params }) => {
    const { id } = await params;

    // Check if customer has orders
    const customerOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.customerId, id));

    if (customerOrders.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete customer with existing orders. Delete orders first." },
        { status: 400 }
      );
    }

    // Delete measurements
    await db.delete(customerMeasurements).where(eq(customerMeasurements.customerId, id));

    // Delete customer
    await db.delete(customers).where(eq(customers.id, id));

    return NextResponse.json({ success: true });
  }
);
