import { NextResponse } from "next/server";
import { eq, count, sql, gte, lte, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { outfits, orders, customers, payments, productionLogs } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";

export const GET = withPermission(
  { resource: "customer", action: "read" }, // Admin can view reports
  async (request) => {
    const { searchParams } = new URL(request.url);

    // Prefer explicit from/to ISO params (calendar picker); fall back to legacy `days`
    const fromParam = searchParams.get("from");
    const toParam   = searchParams.get("to");
    const days      = parseInt(searchParams.get("days") || "30");

    const since = fromParam ? new Date(fromParam) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const until = toParam   ? new Date(toParam)   : new Date();

    // Run all queries in parallel
    const [
      totalCustomers,
      totalOrders,
      totalOutfits,
      outfitsByStatus,
      revenueResult,
      recentOrders,
      avgProductionTime,
    ] = await Promise.all([
      // Total customers
      db.select({ count: count() }).from(customers),

      // Total orders
      db.select({ count: count() }).from(orders),

      // Total outfits
      db.select({ count: count() }).from(outfits),

      // Outfits grouped by status
      db.select({ status: outfits.status, count: count() }).from(outfits).groupBy(outfits.status),

      // Total revenue in period (sum of payments within the date window)
      db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(payments)
        .where(and(gte(payments.createdAt, since), lte(payments.createdAt, until))),

      // Orders in the selected date range
      db.select({ count: count() }).from(orders).where(and(gte(orders.createdAt, since), lte(orders.createdAt, until))),

      // Average production time (from PRODUCTION_READY to PRODUCTION_COMPLETED)
      db.execute(sql`
        SELECT AVG(EXTRACT(EPOCH FROM (completed.created_at - started.created_at)) / 86400)::numeric(10,1) as avg_days
        FROM production_logs completed
        JOIN production_logs started ON completed.outfit_id = started.outfit_id
        WHERE completed.status = 'PRODUCTION_COMPLETED'
        AND started.status = 'PATTERN_DRAFTING'
      `),
    ]);

    // Outfits by status breakdown
    const statusBreakdown: Record<string, number> = {};
    outfitsByStatus.forEach((s) => { statusBreakdown[s.status] = s.count; });

    // Calculate key metrics
    const totalRevenue = Number(revenueResult[0]?.total || 0);
    const avgDays = (avgProductionTime as any)?.rows?.[0]?.avg_days || null;

    return NextResponse.json({
      summary: {
        totalCustomers: totalCustomers[0].count,
        totalOrders: totalOrders[0].count,
        totalOutfits: totalOutfits[0].count,
        totalRevenue,
        ordersInPeriod: recentOrders[0].count,
        avgProductionDays: avgDays ? Number(avgDays) : null,
      },
      statusBreakdown,
      period: { from: since.toISOString(), to: until.toISOString() },
    });
  }
);
