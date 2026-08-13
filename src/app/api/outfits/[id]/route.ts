import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, referenceImages, dependencies, productionLogs, orders, customers, users, customerMeasurements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { withPermission } from "@/lib/api-guard";

export const GET = withPermission(
  { resource: "outfit", action: "read" },
  async (_request, { params, session }) => {
    const { id } = await params;

    const [outfit] = await db.select().from(outfits).where(eq(outfits.id, id)).limit(1);

    if (!outfit) {
      return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
    }

    // Master can only see assigned outfits
    if (session.role === "MASTER" && outfit.masterId !== session.id) {
      return NextResponse.json({ error: "You are not assigned to this outfit" }, { status: 403 });
    }

    // Fetch all related data in parallel
    const [allReferences, outfitDependencies, logs, orderResult] = await Promise.all([
      db.select().from(referenceImages).where(eq(referenceImages.outfitId, id)).orderBy(desc(referenceImages.createdAt)),
      db.select().from(dependencies).where(eq(dependencies.outfitId, id)),
      db.select().from(productionLogs).where(eq(productionLogs.outfitId, id)).orderBy(desc(productionLogs.createdAt)),
      db.select().from(orders).where(eq(orders.id, outfit.orderId)).limit(1),
    ]);

    // Get customer info + staff names
    const order = orderResult[0];
    const [customer, designerUser, masterUser] = await Promise.all([
      order
        ? db.select({ id: customers.id, name: customers.name, mobile: customers.mobile, occasion: customers.occasion })
            .from(customers).where(eq(customers.id, order.customerId)).limit(1).then(r => r[0] || null)
        : Promise.resolve(null),
      outfit.designerId
        ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, outfit.designerId)).limit(1).then(r => r[0] || null)
        : Promise.resolve(null),
      outfit.masterId
        ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, outfit.masterId)).limit(1).then(r => r[0] || null)
        : Promise.resolve(null),
    ]);

    // Master can only see LOCKED references
    const outfitReferences = session.role === "MASTER"
      ? allReferences.filter((r) => r.status === "LOCKED")
      : allReferences;

    // Fetch customer-level measurements (latest version)
    let latestCustomerMeasurement = null;
    if (order) {
      const [cm] = await db
        .select()
        .from(customerMeasurements)
        .where(eq(customerMeasurements.customerId, order.customerId))
        .orderBy(desc(customerMeasurements.version))
        .limit(1);
      latestCustomerMeasurement = cm || null;
    }

    return NextResponse.json({
      ...outfit,
      order: order ? { id: order.id, orderNumber: order.orderNumber, deliveryDate: order.deliveryDate, trialDate: order.trialDate } : null,
      customer,
      designer: designerUser,
      master: masterUser,
      customerMeasurements: latestCustomerMeasurement,
      references: outfitReferences,
      dependencies: outfitDependencies,
      productionLogs: logs,
    });
  }
);

export const PATCH = withPermission(
  { resource: "outfit", action: "update" },
  async (request, { params, session }) => {
    const { id } = await params;
    const body = await request.json();

    // Master can only update assigned outfits
    if (session.role === "MASTER") {
      const [outfit] = await db
        .select({ masterId: outfits.masterId })
        .from(outfits)
        .where(eq(outfits.id, id));
      if (outfit?.masterId !== session.id) {
        return NextResponse.json({ error: "You are not assigned to this outfit" }, { status: 403 });
      }
    }

    const updateData: any = { updatedAt: new Date() };

    // Fields Designer/Admin can update
    if (session.role !== "MASTER") {
      if (body.designerNotes !== undefined) updateData.designerNotes = body.designerNotes;
      if (body.specialInstructions !== undefined) updateData.specialInstructions = body.specialInstructions;
      if (body.trialNotes !== undefined) updateData.trialNotes = body.trialNotes;
      if (body.alterationNotes !== undefined) updateData.alterationNotes = body.alterationNotes;
      if (body.maggamRequired !== undefined) updateData.maggamRequired = body.maggamRequired;
      if (body.designerId !== undefined) updateData.designerId = body.designerId;
      if (body.masterId !== undefined) updateData.masterId = body.masterId;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.deliveryDate) updateData.deliveryDate = new Date(body.deliveryDate);
      if (body.trialDate) updateData.trialDate = new Date(body.trialDate);
    }

    // Status changes go through the transition endpoint
    // But allow basic field updates here

    const [updated] = await db
      .update(outfits)
      .set(updateData)
      .where(eq(outfits.id, id))
      .returning();

    // Auto-triggers based on assignments
    const { onDesignerAssigned, onMasterAssigned, onTrialDateSet } = await import("@/lib/auto-triggers");

    if (body.designerId) {
      await onDesignerAssigned(id, body.designerId);
    }
    if (body.masterId) {
      await onMasterAssigned(id, body.masterId);
    }
    if (body.trialDate) {
      await onTrialDateSet(id, session.id);
    }

    // Re-fetch to get updated status
    const [final] = await db.select().from(outfits).where(eq(outfits.id, id));
    return NextResponse.json(final);
  }
);

export const DELETE = withPermission(
  { resource: "outfit", action: "delete" },
  async (_request, { params }) => {
    const { id } = await params;

    // Delete related data
    await db.delete(referenceImages).where(eq(referenceImages.outfitId, id));
    await db.delete(dependencies).where(eq(dependencies.outfitId, id));
    await db.delete(productionLogs).where(eq(productionLogs.outfitId, id));

    // Delete outfit
    await db.delete(outfits).where(eq(outfits.id, id));

    return NextResponse.json({ success: true });
  }
);
