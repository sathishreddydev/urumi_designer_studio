import { eventBus, type AppEvent } from "@/lib/events";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // Verify auth
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

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

      // Subscribe to events
      const unsubscribe = eventBus.subscribe((event: AppEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected
          unsubscribe();
          clearInterval(keepAlive);
        }
      });

      // Cleanup on close
      const cleanup = () => {
        unsubscribe();
        clearInterval(keepAlive);
      };

      // Store cleanup for when the stream is cancelled
      (controller as any)._cleanup = cleanup;
    },
    cancel() {
      // Stream cancelled by client
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
