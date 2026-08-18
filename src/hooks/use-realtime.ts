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
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            break;

          case "order_updated":
            queryClient.invalidateQueries({ queryKey: ["order", data.orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            if (data.customerId) {
              queryClient.invalidateQueries({ queryKey: ["customer", data.customerId] });
            }
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            break;

          case "dependency_updated":
            queryClient.invalidateQueries({ queryKey: ["outfit", data.outfitId] });
            queryClient.invalidateQueries({ queryKey: ["active-blockers"] });
            queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
            break;

          case "payment_added":
            queryClient.invalidateQueries({ queryKey: ["order", data.orderId] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            if (data.customerId) {
              queryClient.invalidateQueries({ queryKey: ["customer", data.customerId] });
            }
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            break;

          case "reference_updated":
            queryClient.invalidateQueries({ queryKey: ["outfit", data.outfitId] });
            queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
            break;

          case "customer_updated":
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            if (data.customerId) {
              queryClient.invalidateQueries({ queryKey: ["customer", data.customerId] });
            }
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            break;

          case "outfit_deleted":
            queryClient.invalidateQueries({ queryKey: ["outfits"] });
            queryClient.invalidateQueries({ queryKey: ["production-outfits"] });
            if (data.orderId) {
              queryClient.invalidateQueries({ queryKey: ["order", data.orderId] });
            }
            queryClient.invalidateQueries({ queryKey: ["active-blockers"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            break;

          case "customer_feedback":
            queryClient.invalidateQueries({ queryKey: ["outfit", data.outfitId] });
            queryClient.invalidateQueries({ queryKey: ["outfits"] });
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
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);
}
