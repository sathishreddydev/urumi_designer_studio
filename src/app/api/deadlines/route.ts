import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, orders, customers } from "@/lib/db/schema";
import { eq, and, lt, isNotNull, notInArray } from "drizzle-orm";
import { withAuth } from "@/lib/api-guard";

export const GET = withAuth(async (_request, { session }) => {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // MASTER only sees deadlines for their assigned outfits
  const masterFilter = session.role === "MASTER"
    ? eq(outfits.masterId, session.id)
    : undefined;

  // DESIGNER only sees deadlines for their assigned outfits
  const designerFilter = session.role === "DESIGNER"
    ? eq(outfits.designerId, session.id)
    : undefined;

  const scopeFilter = masterFilter ?? designerFilter;

  // Get outfits that are NOT delivered and have a delivery date that's past or within 3 days
  const overdueOutfits = await db
    .select({
      id: outfits.id,
      name: outfits.name,
      type: outfits.type,
      status: outfits.status,
      deliveryDate: outfits.deliveryDate,
      trialDate: outfits.trialDate,
      orderId: outfits.orderId,
      orderNumber: orders.orderNumber,
      customerName: customers.name,
      customerMobile: customers.mobile,
    })
    .from(outfits)
    .innerJoin(orders, eq(outfits.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        isNotNull(outfits.deliveryDate),
        lt(outfits.deliveryDate, threeDaysFromNow),
        notInArray(outfits.status, ["DELIVERED", "READY_FOR_DELIVERY"]),
        scopeFilter
      )
    );

  // Categorize
  const overdue = overdueOutfits
    .filter((o) => o.deliveryDate && new Date(o.deliveryDate) < now)
    .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime());

  const dueSoon = overdueOutfits
    .filter((o) => o.deliveryDate && new Date(o.deliveryDate) >= now)
    .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime());

  // Trial dates approaching — not relevant for MASTER (they don't handle trials)
  // Skip for MASTER to keep their dashboard focused on production
  const upcomingTrials = session.role === "MASTER" ? [] : await (async () => {
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    return db
      .select({
        id: outfits.id,
        name: outfits.name,
        type: outfits.type,
        status: outfits.status,
        trialDate: outfits.trialDate,
        orderNumber: orders.orderNumber,
        customerName: customers.name,
      })
      .from(outfits)
      .innerJoin(orders, eq(outfits.orderId, orders.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(
        and(
          isNotNull(outfits.trialDate),
          lt(outfits.trialDate, twoDaysFromNow),
          notInArray(outfits.status, ["DELIVERED", "READY_FOR_DELIVERY", "TRIAL"]),
          designerFilter
        )
      );
  })();

  return NextResponse.json({
    overdue,
    dueSoon,
    upcomingTrials,
    totalAlerts: overdue.length + dueSoon.length + upcomingTrials.length,
  });
});
