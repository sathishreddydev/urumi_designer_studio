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

    const customersWithOrders = await Promise.all(
      allCustomers.map(async (customer) => {
        const customerOrders = await db
          .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
          .from(orders)
          .where(eq(orders.customerId, customer.id));
        return { ...customer, orders: customerOrders };
      })
    );

    const [{ total }] = await db.select({ total: count() }).from(customers).where(condition);

    return NextResponse.json({ customers: customersWithOrders, total, page, limit });
  }
);

export const POST = withPermission(
  { resource: "customer", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const [customer] = await db.insert(customers).values({
        ...parsed.data,
        portalToken: generatePortalToken(),
      }).returning();
      return NextResponse.json(customer, { status: 201 });
    } catch (error: any) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Customer with this mobile already exists" }, { status: 409 });
      }
      throw error;
    }
  }
);
