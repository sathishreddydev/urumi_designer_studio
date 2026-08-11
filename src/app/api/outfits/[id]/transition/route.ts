import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { outfits } from "@/lib/db/schema";
import { withAuth } from "@/lib/api-guard";
import {
  validateTransition,
  executeTransition,
  getAvailableTransitions,
  type OutfitStatus,
} from "@/lib/workflow";
import type { Role } from "@/lib/permissions";

export const POST = withAuth(async (request, { params, session }) => {
  const { id } = await params;
  const { newStatus, notes } = await request.json();

  if (!newStatus) {
    return NextResponse.json({ error: "newStatus is required" }, { status: 400 });
  }

  // Get current outfit status
  const [outfit] = await db
    .select({ status: outfits.status, masterId: outfits.masterId })
    .from(outfits)
    .where(eq(outfits.id, id))
    .limit(1);

  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }

  // Validate transition
  const result = await validateTransition(
    id,
    outfit.status as OutfitStatus,
    newStatus as OutfitStatus,
    session.role as Role,
    { userId: session.id }
  );

  if (!result.success) {
    // Return available transitions for the client to show alternatives
    const available = await getAvailableTransitions(
      id,
      outfit.status as OutfitStatus,
      session.role as Role,
      session.id
    );
    return NextResponse.json(
      { error: result.error, availableTransitions: available },
      { status: 400 }
    );
  }

  // Execute the transition
  await executeTransition(id, newStatus as OutfitStatus, session.id, notes);

  // Return updated available transitions
  const nextTransitions = await getAvailableTransitions(
    id,
    newStatus as OutfitStatus,
    session.role as Role,
    session.id
  );

  // If moved to READY_FOR_DELIVERY, include customer WhatsApp link for notification
  let notifyCustomer = null;
  if (newStatus === "READY_FOR_DELIVERY") {
    const { orders, customers } = await import("@/lib/db/schema");
    const [outfitData] = await db.select({ orderId: outfits.orderId, name: outfits.name }).from(outfits).where(eq(outfits.id, id));
    if (outfitData) {
      const [order] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, outfitData.orderId));
      if (order) {
        const [customer] = await db.select({ name: customers.name, mobile: customers.mobile }).from(customers).where(eq(customers.id, order.customerId));
        if (customer?.mobile) {
          const msg = `Hi ${customer.name}! Your ${outfitData.name} is ready for pickup. Please visit the studio at your convenience.`;
          notifyCustomer = {
            whatsappUrl: `https://wa.me/${customer.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`,
            customerName: customer.name,
          };
        }
      }
    }
  }

  return NextResponse.json({
    status: newStatus,
    availableTransitions: nextTransitions,
    notifyCustomer,
  });
});

// GET — returns available transitions for the current user
export const GET = withAuth(async (_request, { params, session }) => {
  const { id } = await params;

  const [outfit] = await db
    .select({ status: outfits.status })
    .from(outfits)
    .where(eq(outfits.id, id))
    .limit(1);

  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }

  const available = await getAvailableTransitions(
    id,
    outfit.status as OutfitStatus,
    session.role as Role,
    session.id
  );

  return NextResponse.json({
    currentStatus: outfit.status,
    availableTransitions: available,
  });
});
