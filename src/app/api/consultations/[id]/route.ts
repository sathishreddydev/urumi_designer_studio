import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consultations, customers, users, orders, outfits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";
import { generateOrderNumber } from "@/lib/utils";
import { eventBus } from "@/lib/events";

export const GET = withPermission(
  { resource: "order", action: "read" },
  async (_req, { params }) => {
    const { id } = await params;
    const [consultation] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, id))
      .limit(1);

    if (!consultation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [cust] = await db
      .select({ id: customers.id, name: customers.name, mobile: customers.mobile })
      .from(customers)
      .where(eq(customers.id, consultation.customerId))
      .limit(1);

    return NextResponse.json({ ...consultation, customer: cust || null });
  }
);

export const PATCH = withPermission(
  { resource: "order", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = { updatedAt: new Date() };
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.outfitIdeas !== undefined) updateData.outfitIdeas = body.outfitIdeas;
    if (body.estimatedAmount !== undefined)
      updateData.estimatedAmount = body.estimatedAmount ? String(body.estimatedAmount) : null;
    if (body.status !== undefined) updateData.status = body.status;

    const [updated] = await db
      .update(consultations)
      .set(updateData)
      .where(eq(consultations.id, id))
      .returning();

    return NextResponse.json(updated);
  }
);

// ── Convert to Order ──────────────────────────────────────────────────────────
export const POST = withPermission(
  { resource: "order", action: "create" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();

    const [consultation] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, id))
      .limit(1);

    if (!consultation) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }
    if (consultation.status === "converted") {
      return NextResponse.json({ error: "Already converted to an order" }, { status: 400 });
    }

    // Create the order
    let order: any;
    let retries = 3;
    while (retries > 0) {
      try {
        [order] = await db
          .insert(orders)
          .values({
            orderNumber: generateOrderNumber(),
            customerId: consultation.customerId,
            estimatedAmount: consultation.estimatedAmount,
            notes: consultation.notes || undefined,
            deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
            trialDate: body.trialDate ? new Date(body.trialDate) : null,
          })
          .returning();
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0 || !err.message?.includes("unique")) throw err;
      }
    }

    // Create outfits from ideas
    const ideas: any[] = consultation.outfitIdeas || [];
    for (const idea of ideas) {
      if (!idea.type) continue;
      await db.insert(outfits).values({
        orderId: order.id,
        name: idea.type, // use type as default name; user can rename later
        type: idea.type,
        price: idea.estimatedPrice ? String(idea.estimatedPrice) : null,
        designerNotes: idea.notes || null,
        status: "DRAFT",
      });
    }

    // Mark consultation as converted
    await db
      .update(consultations)
      .set({ status: "converted", convertedOrderId: order.id, updatedAt: new Date() })
      .where(eq(consultations.id, id));

    eventBus.emit({
      type: "order_updated",
      orderId: order.id,
      customerId: consultation.customerId,
      timestamp: Date.now(),
    });

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber });
  }
);

export const DELETE = withPermission(
  { resource: "order", action: "delete" },
  async (_req, { params }) => {
    const { id } = await params;
    await db.update(consultations)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(consultations.id, id));
    return NextResponse.json({ success: true });
  }
);
