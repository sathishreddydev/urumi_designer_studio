import { NextResponse } from "next/server";
import { eq, ne, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { dependencies, outfits, orders, customers } from "@/lib/db/schema";
import { withAuth } from "@/lib/api-guard";

// GET all active (pending/blocked) dependencies across all outfits
export const GET = withAuth(async (_request, { session }) => {
  // Get all non-resolved dependencies
  const allDeps = await db
    .select()
    .from(dependencies)
    .where(ne(dependencies.status, "AVAILABLE"))
    .orderBy(desc(dependencies.createdAt));

  // Enrich with outfit + customer info
  const enriched = await Promise.all(
    allDeps.map(async (dep) => {
      const [outfit] = await db
        .select({ id: outfits.id, name: outfits.name, type: outfits.type, orderId: outfits.orderId, status: outfits.status })
        .from(outfits)
        .where(eq(outfits.id, dep.outfitId))
        .limit(1);

      let customerName = "";
      if (outfit) {
        const [order] = await db
          .select({ customerId: orders.customerId })
          .from(orders)
          .where(eq(orders.id, outfit.orderId))
          .limit(1);
        if (order) {
          const [cust] = await db
            .select({ name: customers.name })
            .from(customers)
            .where(eq(customers.id, order.customerId))
            .limit(1);
          customerName = cust?.name || "";
        }
      }

      return {
        ...dep,
        outfit: outfit ? { id: outfit.id, name: outfit.name, type: outfit.type, status: outfit.status } : null,
        customerName,
      };
    })
  );

  return NextResponse.json(enriched);
});
