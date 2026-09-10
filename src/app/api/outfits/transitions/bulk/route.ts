import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { outfits, orders, payments } from "@/lib/db/schema";
import { withAuth } from "@/lib/api-guard";
import { getAvailableTransitions, type OutfitStatus } from "@/lib/workflow";
import type { Role } from "@/lib/permissions";

/**
 * POST /api/outfits/transitions/bulk
 * Body: { outfitIds: string[] }
 * Returns: { [outfitId]: { status, label, blocked, reason? }[] }
 *
 * Used by list pages (production, stitching-maggam) to fetch transitions
 * for all visible outfits in a single request instead of per-row calls.
 */
export const POST = withAuth(async (request, { session }) => {
  const body = await request.json();
  const { outfitIds } = body as { outfitIds: string[] };

  if (!Array.isArray(outfitIds) || outfitIds.length === 0) {
    return NextResponse.json({ transitions: {} });
  }

  // Cap to 300 to prevent abuse
  const ids = outfitIds.slice(0, 300);

  // Fetch all outfits in one query
  const rows = await db
    .select({ id: outfits.id, status: outfits.status, orderId: outfits.orderId })
    .from(outfits)
    .where(inArray(outfits.id, ids));

  // Get transitions for each outfit concurrently
  const results = await Promise.all(
    rows.map(async (outfit) => {
      const available = await getAvailableTransitions(
        outfit.id,
        outfit.status as OutfitStatus,
        session.role as Role,
        session.id
      );

      // Apply payment check for the DELIVERED transition if present
      const deliveredEntry = available.find((t) => t.status === "DELIVERED");
      if (deliveredEntry && !deliveredEntry.blocked && outfit.orderId) {
        const orderOutfits = await db
          .select({ price: outfits.price, addOns: outfits.addOns })
          .from(outfits)
          .where(eq(outfits.orderId, outfit.orderId));

        const outfitTotal = orderOutfits.reduce((s, o) => {
          const outfitPrice = Number(o.price) || 0;
          const addOnsTotal = ((o.addOns as any[]) || []).reduce(
            (as: number, a: any) => as + (Number(a.price) || 0),
            0
          );
          return s + outfitPrice + addOnsTotal;
        }, 0);

        let orderTotal = outfitTotal;
        if (orderTotal === 0) {
          const [ord] = await db
            .select({ estimatedAmount: orders.estimatedAmount })
            .from(orders)
            .where(eq(orders.id, outfit.orderId));
          orderTotal = ord?.estimatedAmount ? Number(ord.estimatedAmount) : 0;
        }

        const settledPayments = await db
          .select({ amount: payments.amount, status: payments.status })
          .from(payments)
          .where(eq(payments.orderId, outfit.orderId));
        const totalPaid = settledPayments
          .filter((p) => !p.status || p.status === "SETTLED")
          .reduce((s, p) => s + Number(p.amount), 0);

        if (orderTotal > 0 && totalPaid < orderTotal) {
          const balance = orderTotal - totalPaid;
          deliveredEntry.blocked = true;
          deliveredEntry.reason = `Payment not cleared — ₹${balance.toLocaleString()} still pending`;
        }
      }

      return { id: outfit.id, available };
    })
  );

  const transitions: Record<string, typeof results[0]["available"]> = {};
  for (const { id, available } of results) {
    transitions[id] = available;
  }

  return NextResponse.json({ transitions });
});
