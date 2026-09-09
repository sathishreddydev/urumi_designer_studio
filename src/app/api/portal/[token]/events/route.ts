import { eventBus, type AppEvent } from "@/lib/events";
import { db } from "@/lib/db";
import { customers, orders, outfits } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/portal/[token]/events?since=<timestamp>
 *
 * Polling endpoint for the customer-facing portal. Returns a JSON array of
 * events relevant to this customer since the given timestamp.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Verify portal token
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.portalToken, token))
    .limit(1);

  if (!customer) {
    return new Response("Invalid token", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const since = parseInt(searchParams.get("since") ?? "0", 10);

  // Get this customer's order IDs and outfit IDs for filtering
  const customerOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.customerId, customer.id));
  const orderIds = new Set(customerOrders.map((o) => o.id));

  const outfitIds = new Set<string>();
  if (customerOrders.length > 0) {
    const allOutfits = await db
      .select({ id: outfits.id })
      .from(outfits)
      .where(inArray(outfits.orderId, customerOrders.map((o) => o.id)));
    allOutfits.forEach((o) => outfitIds.add(o.id));
  }

  const allEvents = eventBus.since(isNaN(since) ? 0 : since);

  const relevant = allEvents.filter((event: AppEvent) =>
    (event.orderId && orderIds.has(event.orderId)) ||
    (event.outfitId && outfitIds.has(event.outfitId)) ||
    (event.customerId && event.customerId === customer.id)
  );

  // Portal only needs to know "something changed" — not event details
  const hasUpdates = relevant.length > 0;

  return Response.json({
    hasUpdates,
    events: relevant,
    serverTime: Date.now(),
  });
}
