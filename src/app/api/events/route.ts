import { eventBus, type AppEvent } from "@/lib/events";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { outfits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  // Verify auth
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // For MASTER role, get their assigned outfit IDs for filtering
  let masterOutfitIds: Set<string> | null = null;
  if (session.role === "MASTER") {
    const assigned = await db
      .select({ id: outfits.id })
      .from(outfits)
      .where(eq(outfits.masterId, session.id));
    masterOutfitIds = new Set(assigned.map((o) => o.id));
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`));

      // Keep-alive every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      // Subscribe to events with role-based filtering
      const unsubscribe = eventBus.subscribe((event: AppEvent) => {
        try {
          // MASTER role: only receive events for their assigned outfits
          if (masterOutfitIds !== null) {
            const isRelevant =
              (event.outfitId && masterOutfitIds.has(event.outfitId)) ||
              event.type === "dependency_updated"; // Masters need blocker updates
            if (!isRelevant) return;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected
          unsubscribe();
          clearInterval(keepAlive);
        }
      });

      // Store cleanup for when the stream is cancelled
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
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
