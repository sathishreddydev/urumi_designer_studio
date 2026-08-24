import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outfits, orders, customers } from "@/lib/db/schema";
import { eq, and, lt, lte, isNotNull, notInArray } from "drizzle-orm";
import { withAuth } from "@/lib/api-guard";

export const GET = withAuth(async (_request, { session }) => {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Scope outfits to the logged-in user for role-specific views
  const scopeFilter =
    session.role === "MASTER"
      ? eq(outfits.masterId, session.id)
      : session.role === "DESIGNER"
      ? eq(outfits.designerId, session.id)
      : undefined; // ADMIN / RECEPTION see everything

  // --- Delivery deadlines: past or within 3 days, not yet delivered/ready ---
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

  // Categorize delivery alerts
  const overdue = overdueOutfits
    .filter((o) => o.deliveryDate && new Date(o.deliveryDate) < now)
    .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime());

  const dueSoon = overdueOutfits
    .filter((o) => o.deliveryDate && new Date(o.deliveryDate) >= now)
    .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime());

  // IDs already shown in delivery sections — exclude from trials to prevent duplication
  const deliveryAlertIds = new Set([...overdue, ...dueSoon].map((o) => o.id));

  // --- Trial alerts: not relevant for MASTER (they don't handle fittings) ---
  // Includes:
  //   1. Outfits currently IN a trial (status = TRIAL) — active fittings happening now
  //   2. Upcoming trial dates within 7 days (production complete, trial not yet started)
  // Uses the same scopeFilter so each role only sees their own outfits.
  const upcomingTrials = session.role === "MASTER" ? [] : await (async () => {
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const trials = await db
      .select({
        id: outfits.id,
        name: outfits.name,
        type: outfits.type,
        status: outfits.status,
        trialDate: outfits.trialDate,
        deliveryDate: outfits.deliveryDate,
        orderNumber: orders.orderNumber,
        customerName: customers.name,
      })
      .from(outfits)
      .innerJoin(orders, eq(outfits.orderId, orders.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(
        and(
          isNotNull(outfits.trialDate),
          // Show if: currently in TRIAL status, OR trial date is within 7 days
          // We fetch trialDate <= 7 days from now (covers past trial dates for active trials too)
          lte(outfits.trialDate, sevenDaysFromNow),
          notInArray(outfits.status, ["DELIVERED", "READY_FOR_DELIVERY", "ALTERATION", "QC"]),
          scopeFilter
        )
      );
    // Drop any outfit already shown under delivery alerts to avoid duplicates
    return trials
      .filter((o) => !deliveryAlertIds.has(o.id))
      .sort((a, b) => {
        // Active trials (TRIAL status) first, then by trial date ascending
        if (a.status === "TRIAL" && b.status !== "TRIAL") return -1;
        if (b.status === "TRIAL" && a.status !== "TRIAL") return 1;
        return new Date(a.trialDate!).getTime() - new Date(b.trialDate!).getTime();
      });
  })();

  return NextResponse.json({
    overdue,
    dueSoon,
    upcomingTrials,
    totalAlerts: overdue.length + dueSoon.length + upcomingTrials.length,
  });
});
