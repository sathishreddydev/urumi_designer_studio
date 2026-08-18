import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, orders, customers, users } from "@/lib/db/schema";
import { eq, count, desc, inArray, ilike, and as drizzleAnd } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { outfitSchema } from "@/lib/validations";
import { eventBus } from "@/lib/events";

export const GET = withPermission(
  { resource: "outfit", action: "read" },
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId") || "";
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    // Role-based scoping
    if (session.role === "DESIGNER") {
      conditions.push(eq(outfits.designerId, session.id));
    } else if (session.role === "MASTER") {
      conditions.push(eq(outfits.masterId, session.id));
    }

    // Filters
    if (orderId) {
      conditions.push(eq(outfits.orderId, orderId));
    } else if (status === "production") {
      conditions.push(inArray(outfits.status, [
        "WAITING_FOR_DEPENDENCIES",
        "PRODUCTION_READY",
        "PATTERN_DRAFTING",
        "MAGGAM_WORK",
        "MAGGAM_REVIEW",
        "FABRIC_CUTTING",
        "STITCHING",
        "PRODUCTION_COMPLETED",
      ] as any));
    } else if (status && status !== "all") {
      conditions.push(eq(outfits.status, status as any));
    }

    if (search) {
      conditions.push(ilike(outfits.name, `%${search}%`));
    }

    const condition = conditions.length > 0 ? drizzleAnd(...conditions) : undefined;

    const outfitsList = await db
      .select()
      .from(outfits)
      .where(condition)
      .orderBy(desc(outfits.priority), desc(outfits.createdAt))
      .limit(limit)
      .offset(offset);

    // Enrich with customer name, order number, designer/master names
    const enriched = await Promise.all(
      outfitsList.map(async (outfit) => {
        const [order] = await db
          .select({ id: orders.id, orderNumber: orders.orderNumber, customerId: orders.customerId })
          .from(orders)
          .where(eq(orders.id, outfit.orderId))
          .limit(1);

        let customerName = "";
        if (order) {
          const [cust] = await db
            .select({ name: customers.name })
            .from(customers)
            .where(eq(customers.id, order.customerId))
            .limit(1);
          customerName = cust?.name || "";
        }

        let designerName = "";
        if (outfit.designerId) {
          const [d] = await db.select({ name: users.name }).from(users).where(eq(users.id, outfit.designerId)).limit(1);
          designerName = d?.name || "";
        }

        let masterName = "";
        if (outfit.masterId) {
          const [m] = await db.select({ name: users.name }).from(users).where(eq(users.id, outfit.masterId)).limit(1);
          masterName = m?.name || "";
        }

        return {
          ...outfit,
          customerName,
          orderNumber: order?.orderNumber || "",
          designerName,
          masterName,
        };
      })
    );

    const [totalResult] = await db.select({ count: count() }).from(outfits).where(condition);

    return NextResponse.json({ outfits: enriched, total: totalResult.count, page, limit });
  }
);

export const POST = withPermission(
  { resource: "outfit", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = outfitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!body.orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const [outfit] = await db
      .insert(outfits)
      .values({
        orderId: body.orderId,
        name: parsed.data.name,
        type: parsed.data.type,
        occasion: parsed.data.occasion,
        priority: parsed.data.priority,
        deliveryDate: parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate) : null,
        trialDate: parsed.data.trialDate ? new Date(parsed.data.trialDate) : null,
        maggamRequired: parsed.data.maggamRequired,
        // Use validated values from parsed.data (not raw body)
        price: parsed.data.price != null ? String(parsed.data.price) : null,
        designerId: parsed.data.designerId || null,
      })
      .returning();

    // Emit event
    eventBus.emit({ type: "outfit_updated", outfitId: outfit.id, orderId: body.orderId, timestamp: Date.now() });

    return NextResponse.json(outfit, { status: 201 });
  }
);
