import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, outfits, payments, customers, referenceImages, dependencies, productionLogs, invoices } from "@/lib/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";

export const GET = withPermission(
  { resource: "order", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Batch: fetch customer, outfits, payments in parallel
    // Only include SETTLED payments in the returned list for balance calculations
    const [customerResult, orderOutfits, orderPayments] = await Promise.all([
      db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1),
      db.select().from(outfits).where(eq(outfits.orderId, id)).orderBy(asc(outfits.priority), asc(outfits.createdAt)),
      db.select().from(payments).where(eq(payments.orderId, id)),  // all statuses returned so UI can show voided payments
    ]);

    // Enrich outfits with their references
    const outfitsWithRefs = await Promise.all(
      orderOutfits.map(async (outfit) => {
        const refs = await db
          .select()
          .from(referenceImages)
          .where(eq(referenceImages.outfitId, outfit.id));
        return { ...outfit, references: refs };
      })
    );

    return NextResponse.json({
      ...order,
      customer: customerResult[0] || null,
      outfits: outfitsWithRefs,
      payments: orderPayments,
    });
  }
);

export const PATCH = withPermission(
  { resource: "order", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();

    // Allowed order-level statuses that staff can set manually
    const ALLOWED_ORDER_STATUSES = [
      "Active", "In Design", "Production Ready", "Waiting For Dependencies",
      "In Production", "Trial/QC", "Ready For Delivery", "Completed",
    ];

    const updateData: any = { updatedAt: new Date() };
    if (body.deliveryDate !== undefined)
      updateData.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
    if (body.trialDate !== undefined)
      updateData.trialDate = body.trialDate ? new Date(body.trialDate) : null;
    if (body.status) {
      if (!ALLOWED_ORDER_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
      }
      updateData.status = body.status;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.estimatedAmount !== undefined)
      updateData.estimatedAmount = body.estimatedAmount ? String(body.estimatedAmount) : null;
    if (body.advanceAmount !== undefined)
      updateData.advanceAmount = body.advanceAmount ? String(body.advanceAmount) : null;

    const [order] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Emit event
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({ type: "order_updated", orderId: id, customerId: order.customerId, timestamp: Date.now() });

    return NextResponse.json(order);
  }
);

export const DELETE = withPermission(
  { resource: "order", action: "delete" },
  async (_request, { params, session }) => {
    const { id } = await params;

    // Fetch order to validate it exists and capture customerId
    const [order] = await db
      .select({ customerId: orders.customerId, status: orders.status })
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Block deletion of orders that are in production or completed
    const nonDeletableStatuses = [
      "In Production", "Trial/QC", "Ready For Delivery", "Completed",
    ];
    if (nonDeletableStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot delete an order with status "${order.status}". Only Active, In Design, or Production Ready orders can be deleted.` },
        { status: 409 }
      );
    }

    // Get all outfits for this order
    const orderOutfits = await db
      .select({ id: outfits.id })
      .from(outfits)
      .where(eq(outfits.orderId, id));
    const outfitIds = orderOutfits.map((o) => o.id);

    // Delete in dependency order to avoid FK violations:
    // 1. outfit children (references, dependencies, production logs)
    if (outfitIds.length > 0) {
      await db.delete(referenceImages).where(inArray(referenceImages.outfitId, outfitIds));
      await db.delete(dependencies).where(inArray(dependencies.outfitId, outfitIds));
      await db.delete(productionLogs).where(inArray(productionLogs.outfitId, outfitIds));
    }

    // 2. outfits themselves
    await db.delete(outfits).where(eq(outfits.orderId, id));

    // 3. payments referencing this order
    await db.delete(payments).where(eq(payments.orderId, id));

    // 4. invoices referencing this order (FK would block order deletion otherwise)
    await db.delete(invoices).where(eq(invoices.orderId, id));

    // 5. finally the order itself
    await db.delete(orders).where(eq(orders.id, id));

    // Notify all clients
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({
      type: "order_updated",
      orderId: id,
      customerId: order.customerId,
      userId: session.id,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  }
);
