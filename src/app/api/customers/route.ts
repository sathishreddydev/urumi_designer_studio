import { NextResponse } from "next/server";
import { eq, ilike, or, desc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { customerSchema } from "@/lib/validations";
import { generateId, generatePortalToken } from "@/lib/id";

export const GET = withPermission(
  { resource: "customer", action: "read" },
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const condition = search
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.mobile, `%${search}%`),
          ilike(customers.email, `%${search}%`)
        )
      : undefined;

    const allCustomers = await db
      .select()
      .from(customers)
      .where(condition)
      .orderBy(desc(customers.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich each customer: attach order stubs + linked customer name
    const customersWithOrders = await Promise.all(
      allCustomers.map(async (customer) => {
        const [customerOrders, linkedCustomer] = await Promise.all([
          db
            .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
            .from(orders)
            .where(eq(orders.customerId, customer.id)),
          customer.linkedCustomerId
            ? db
                .select({ id: customers.id, name: customers.name, mobile: customers.mobile })
                .from(customers)
                .where(eq(customers.id, customer.linkedCustomerId))
                .limit(1)
                .then((r) => r[0] ?? null)
            : Promise.resolve(null),
        ]);
        return { ...customer, orders: customerOrders, linkedCustomer };
      })
    );

    const [{ total }] = await db.select({ total: count() }).from(customers).where(condition);

    return NextResponse.json({ customers: customersWithOrders, total, page, limit });
  }
);

export const POST = withPermission(
  { resource: "customer", action: "create" },
  async (request, { session }) => {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // If linkedCustomerId is provided, verify it exists
    if (parsed.data.linkedCustomerId) {
      const [linked] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, parsed.data.linkedCustomerId))
        .limit(1);
      if (!linked) {
        return NextResponse.json({ error: "Linked customer not found" }, { status: 400 });
      }
    }

    // mobile is optional — when blank, generate a unique internal placeholder so the
    // UNIQUE constraint is satisfied. The placeholder is never shown in the UI.
    const mobile = parsed.data.mobile?.trim()
      ? parsed.data.mobile.trim()
      : `no-phone_${generateId()}`;

    try {
      const [customer] = await db
        .insert(customers)
        .values({
          ...parsed.data,
          mobile,
          portalToken: generatePortalToken(),
        })
        .returning();

      // Emit event for real-time updates
      const { eventBus } = await import("@/lib/events");
      eventBus.emit({ type: "customer_updated", customerId: customer.id, userId: session.id, timestamp: Date.now() });

      return NextResponse.json(customer, { status: 201 });
    } catch (error: any) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Customer with this mobile already exists" }, { status: 409 });
      }
      throw error;
    }
  }
);
