import { eventBus, type AppEvent } from "@/lib/events";
import { db } from "@/lib/db";
import { customers, orders, outfits } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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

  // Get this customer's order IDs
  const customerOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.customerId, customer.id));
  const orderIds = new Set(customerOrders.map((o) => o.id));

  // Get all outfit IDs across all orders
  const outfitIds = new Set<string>();
  if (customerOrders.length > 0) {
    const allOutfits = await db
      .select({ id: outfits.id })
      .from(outfits)
      .where(inArray(outfits.orderId, customerOrders.map((o) => o.id)));
    allOutfits.forEach((o) => outfitIds.add(o.id));
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      const unsubscribe = eventBus.subscribe((event: AppEvent) => {
        const isRelevant =
          (event.orderId && orderIds.has(event.orderId)) ||
          (event.outfitId && outfitIds.has(event.outfitId)) ||
          (event.customerId && event.customerId === customer.id);

        if (isRelevant) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "update", timestamp: Date.now() })}\n\n`));
          } catch {
            unsubscribe();
            clearInterval(keepAlive);
          }
        }
      });

      cleanup = () => {
        unsubscribe();
        clearInterval(keepAlive);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
