import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers, orders, outfits } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "ADMIN" || session.role === "RECEPTION") {
    const [{ total: totalCustomers }] = await db.select({ total: count() }).from(customers);
    const [{ total: activeOrders }] = await db
      .select({ total: count() })
      .from(orders)
      .where(eq(orders.status, "Active"));

    const statusCounts = await db
      .select({ status: outfits.status, count: count() })
      .from(outfits)
      .groupBy(outfits.status);

    const counts: Record<string, number> = {};
    statusCounts.forEach((s) => { counts[s.status] = s.count; });

    return NextResponse.json({
      role: session.role,
      name: session.name,
      customers: totalCustomers,
      activeOrders,
      totalOutfits: statusCounts.reduce((sum, s) => sum + s.count, 0),
      productionReady: counts["PRODUCTION_READY"] || 0,
      inProduction:
        (counts["PATTERN_DRAFTING"] || 0) +
        (counts["MAGGAM_WORK"] || 0) +
        (counts["FABRIC_CUTTING"] || 0) +
        (counts["STITCHING"] || 0),
      pendingTrials: counts["TRIAL"] || 0,
      readyForDelivery: counts["READY_FOR_DELIVERY"] || 0,
      delivered: counts["DELIVERED"] || 0,
    });
  }

  if (session.role === "DESIGNER") {
    const statusCounts = await db
      .select({ status: outfits.status, count: count() })
      .from(outfits)
      .where(eq(outfits.designerId, session.id))
      .groupBy(outfits.status);

    const counts: Record<string, number> = {};
    statusCounts.forEach((s) => { counts[s.status] = s.count; });

    return NextResponse.json({
      role: session.role,
      name: session.name,
      // Design phase
      unstarted:           counts["DRAFT"] || 0,
      inDesign:            counts["DESIGN_IN_PROGRESS"] || 0,
      waitingReferences:   counts["WAITING_FOR_REFERENCES"] || 0,
      waitingDependencies: counts["WAITING_FOR_DEPENDENCIES"] || 0,
      // Released to production
      productionReleased:  counts["PRODUCTION_READY"] || 0,
      // Post-production (designer handles these)
      maggamReview:        counts["MAGGAM_REVIEW"] || 0,
      productionCompleted: counts["PRODUCTION_COMPLETED"] || 0,
      trials:              counts["TRIAL"] || 0,
      alterations:         counts["ALTERATION"] || 0,
      qc:                  counts["QC"] || 0,
      // Done
      readyForDelivery:    counts["READY_FOR_DELIVERY"] || 0,
    });
  }

  if (session.role === "MASTER") {
    const statusCounts = await db
      .select({ status: outfits.status, count: count() })
      .from(outfits)
      .where(eq(outfits.masterId, session.id))
      .groupBy(outfits.status);

    const counts: Record<string, number> = {};
    statusCounts.forEach((s) => { counts[s.status] = s.count; });

    return NextResponse.json({
      role: session.role,
      name: session.name,
      // Queued — ready and waiting for this master to start
      productionReady: counts["PRODUCTION_READY"] || 0,
      // Active production stages
      patternDrafting: counts["PATTERN_DRAFTING"] || 0,
      maggamWork: counts["MAGGAM_WORK"] || 0,
      maggamReview: counts["MAGGAM_REVIEW"] || 0,
      fabricCutting: counts["FABRIC_CUTTING"] || 0,
      stitching: counts["STITCHING"] || 0,
      // Done — waiting for designer QC
      productionCompleted: counts["PRODUCTION_COMPLETED"] || 0,
      // Total active (everything except completed)
      totalActive:
        (counts["PRODUCTION_READY"] || 0) +
        (counts["PATTERN_DRAFTING"] || 0) +
        (counts["MAGGAM_WORK"] || 0) +
        (counts["MAGGAM_REVIEW"] || 0) +
        (counts["FABRIC_CUTTING"] || 0) +
        (counts["STITCHING"] || 0),
    });
  }

  return NextResponse.json({ role: session.role, name: session.name });
}
