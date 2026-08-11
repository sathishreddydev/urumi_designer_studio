"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Connects to the SSE endpoint and auto-invalidates React Query cache
 * when events come in. This means all connected clients see updates instantly.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE
    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "outfit_updated":
            queryClient.invalidateQueries({ queryKey: ["outfit", data.outfitId] });
            queryClient.invalidateQueries({ queryKey: ["outfit-transitions", data.outfitId] });
            queryClient.invalidateQueries({ queryKey: ["outfits"] });
            queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
            queryClient.invalidateQueries({ queryKey: ["order", data.orderId] });
            break;

          case "order_updated":
            queryClient.invalidateQueries({ queryKey: ["order", data.orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["customer", data.customerId] });
            break;

          case "dependency_updated":
            queryClient.invalidateQueries({ queryKey: ["outfit", data.outfitId] });
            queryClient.invalidateQueries({ queryKey: ["active-blockers"] });
            queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
            break;

          case "payment_added":
            queryClient.invalidateQueries({ queryKey: ["order", data.orderId] });
            break;

          case "reference_updated":
            queryClient.invalidateQueries({ queryKey: ["outfit", data.outfitId] });
            break;

          case "connected":
            // Initial connection, no action needed
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // Auto-reconnect is handled by EventSource natively
      // It will retry after a few seconds
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);
}
