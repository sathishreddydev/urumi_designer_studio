import { eventBus, type AppEvent } from "@/lib/events";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { outfits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/events?since=<timestamp>
 *
 * Polling endpoint that replaces the previous SSE stream. Returns a JSON array
 * of events that occurred after `since` (millisecond Unix timestamp). Clients
 * should store the highest timestamp they've seen and pass it on the next poll.
 *
 * Responds in under 1ms — no open connections, no serverless timeout risk.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = parseInt(searchParams.get("since") ?? "0", 10);

  // Fetch all events newer than the client's last seen timestamp
  let events = eventBus.since(isNaN(since) ? 0 : since);

  // MASTER role: filter to only their assigned outfits
  if (session.role === "MASTER") {
    const assigned = await db
      .select({ id: outfits.id })
      .from(outfits)
      .where(eq(outfits.masterId, session.id));
    const masterOutfitIds = new Set(assigned.map((o) => o.id));

    events = events.filter((event: AppEvent) => {
      return (
        (event.outfitId && masterOutfitIds.has(event.outfitId)) ||
        event.type === "dependency_updated"
      );
    });
  }

  return Response.json({ events, serverTime: Date.now() });
}
