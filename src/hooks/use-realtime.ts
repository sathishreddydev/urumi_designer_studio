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

          case "session_revoked":
            // If this device's session was revoked, force logout
            if (data.userId || data.sessionId) {
              // Fetch current session to check if we're the target
              fetch("/api/auth/me")
                .then((r) => r.json())
                .then((me) => {
                  const targetedByUserId = data.sessionId === undefined && me.id === data.userId;
                  const targetedBySessionId = data.sessionId && me.sessionId === data.sessionId;
                  if (targetedByUserId || targetedBySessionId) {
                    // Our session was revoked — clear cookie and redirect
                    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                      window.location.href = "/login";
                    });
                  }
                })
                .catch(() => {
                  // /me returns 401 → session already invalid → go to login
                  window.location.href = "/login";
                });
            }
            break;

          case "customer_feedback":
            queryClient.invalidateQueries({ queryKey: ["outfit", data.outfitId] });
            queryClient.invalidateQueries({ queryKey: ["outfits"] });
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
