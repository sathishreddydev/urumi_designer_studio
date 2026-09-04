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

    // Master can only see LOCKED design references (PATTERN/MAGGAM).
    // FABRIC refs are customer material photos — MASTER needs these to cut and stitch correctly,
    // so they are always visible regardless of lock status.
    const outfitReferences = session.role === "MASTER"
      ? allReferences.filter((r) => r.status === "LOCKED" || r.type === "FABRIC")
      : allReferences;

    // Fetch measurements: prefer the snapshot taken at outfit-creation time,
    // fall back to the customer's latest version for older outfits without a snapshot.
    let latestCustomerMeasurement = null;
    let measurementIsSnapshot = false;
    if (order) {
      try {
        if (outfit.measurementSnapshotId) {
          // Load the exact version that was active when this outfit was created
          const [snapshotMeasurement] = await db
            .select()
            .from(customerMeasurements)
            .where(eq(customerMeasurements.id, outfit.measurementSnapshotId))
            .limit(1);
          if (snapshotMeasurement) {
            latestCustomerMeasurement = snapshotMeasurement;
            measurementIsSnapshot = true;
          }
        }

        // No snapshot (old outfit) — fall back to latest version
        if (!latestCustomerMeasurement) {
          const [cm] = await db
            .select()
            .from(customerMeasurements)
            .where(eq(customerMeasurements.customerId, order.customerId))
            .orderBy(desc(customerMeasurements.version))
            .limit(1);
          latestCustomerMeasurement = cm || null;
          measurementIsSnapshot = false;
        }
      } catch {
        // Table may not exist yet
        latestCustomerMeasurement = null;
      }
    }

    return NextResponse.json({
      ...outfit,
      order: order ? { id: order.id, orderNumber: order.orderNumber, deliveryDate: order.deliveryDate, trialDate: order.trialDate } : null,
      customer,
      designer: designerUser,
      master: masterUser,
      customerMeasurements: latestCustomerMeasurement,
      measurementIsSnapshot,
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
        .where(eq(outfits.id, id))
        .limit(1);
      if (!outfit) {
        return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
      }
      if (outfit.masterId !== session.id) {
        return NextResponse.json({ error: "You are not assigned to this outfit" }, { status: 403 });
      }
    }

    const updateData: any = { updatedAt: new Date() };

    // Fields Designer/Admin can update (not MASTER)
    if (session.role !== "MASTER") {
      if (body.name !== undefined) updateData.name = body.name;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.occasion !== undefined) updateData.occasion = body.occasion || null;
      if (body.designerNotes !== undefined) updateData.designerNotes = body.designerNotes;
      if (body.specialInstructions !== undefined) updateData.specialInstructions = body.specialInstructions;
      if (body.trialNotes !== undefined) updateData.trialNotes = body.trialNotes;
      if (body.alterationNotes !== undefined) updateData.alterationNotes = body.alterationNotes;
      if (body.maggamRequired !== undefined) updateData.maggamRequired = body.maggamRequired;
      if (body.designerId !== undefined) updateData.designerId = body.designerId;
      if (body.masterId !== undefined) updateData.masterId = body.masterId;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.price !== undefined) updateData.price = body.price ? String(body.price) : null;
      if (body.deliveryDate) updateData.deliveryDate = new Date(body.deliveryDate);
      if (body.trialDate) updateData.trialDate = new Date(body.trialDate);
      if (body.garmentMeasurements !== undefined) updateData.garmentMeasurements = body.garmentMeasurements;
      if (body.voiceNotes !== undefined) updateData.voiceNotes = body.voiceNotes;
    }

    // MASTER can update garment measurements too (they're stitching it)
    if (session.role === "MASTER") {
      if (body.garmentMeasurements !== undefined) updateData.garmentMeasurements = body.garmentMeasurements;
    }

    // Add-ons can be updated by admins/reception
    if (body.addOns !== undefined) {
      updateData.addOns = body.addOns;
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

    // If price or addOns changed, recalculate order's estimatedAmount
    if (body.price !== undefined || body.addOns !== undefined) {
      const [outfitData] = await db.select({ orderId: outfits.orderId }).from(outfits).where(eq(outfits.id, id));
      if (outfitData) {
        const orderOutfits = await db.select({ price: outfits.price, addOns: outfits.addOns }).from(outfits).where(eq(outfits.orderId, outfitData.orderId));
        const newTotal = orderOutfits.reduce((sum, o) => {
          const outfitPrice = Number(o.price) || 0;
          const addOnsTotal = (o.addOns as any[] || []).reduce((as: number, a: any) => as + (Number(a.price) || 0), 0);
          return sum + outfitPrice + addOnsTotal;
        }, 0);
        await db.update(orders).set({ estimatedAmount: String(newTotal), updatedAt: new Date() }).where(eq(orders.id, outfitData.orderId));
      }
    }

    // Re-fetch to get updated status
    const [final] = await db.select().from(outfits).where(eq(outfits.id, id));

    // Emit event for any outfit update (field changes, assignments, etc.)
    // Look up customerId so the portal SSE can match even if the outfit was created after the SSE connected
    const { eventBus } = await import("@/lib/events");
    let outfitCustomerId: string | undefined;
    if (final?.orderId) {
      const [outfitOrder] = await db
        .select({ customerId: orders.customerId })
        .from(orders)
        .where(eq(orders.id, final.orderId))
        .limit(1);
      outfitCustomerId = outfitOrder?.customerId;
    }
    eventBus.emit({
      type: "outfit_updated",
      outfitId: id,
      orderId: final?.orderId,
      customerId: outfitCustomerId,
      userId: session.id,
      timestamp: Date.now(),
    });

    return NextResponse.json(final);
  }
);

export const DELETE = withPermission(
  { resource: "outfit", action: "delete" },
  async (_request, { params, session }) => {
    const { id } = await params;

    // Get orderId + customerId before deleting for event emission
    const [outfit] = await db
      .select({ orderId: outfits.orderId })
      .from(outfits)
      .where(eq(outfits.id, id));

    let deletedOutfitCustomerId: string | undefined;
    if (outfit?.orderId) {
      const [outfitOrder] = await db
        .select({ customerId: orders.customerId })
        .from(orders)
        .where(eq(orders.id, outfit.orderId))
        .limit(1);
      deletedOutfitCustomerId = outfitOrder?.customerId;
    }

    // Delete related data
    await db.delete(referenceImages).where(eq(referenceImages.outfitId, id));
    await db.delete(dependencies).where(eq(dependencies.outfitId, id));
    await db.delete(productionLogs).where(eq(productionLogs.outfitId, id));

    // Delete outfit
    await db.delete(outfits).where(eq(outfits.id, id));

    // Emit deletion event
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({
      type: "outfit_deleted",
      outfitId: id,
      orderId: outfit?.orderId,
      customerId: deletedOutfitCustomerId,
      userId: session.id,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  }
);
