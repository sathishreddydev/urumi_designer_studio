"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AppEvent } from "@/lib/events";

const POLL_INTERVAL_MS = 4000; // poll every 4 seconds

/**
 * Polls /api/events?since=<timestamp> on an interval and auto-invalidates
 * React Query cache when events arrive. Replaces the previous SSE approach
 * which timed out on Vercel's serverless 10-second execution limit.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  // Track the highest event timestamp we've processed so we only get new ones
  const lastTimestampRef = useRef<number>(Date.now());

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;

      try {
        const res = await fetch(`/api/events?since=${lastTimestampRef.current}`, {
          // Don't cache poll responses
          cache: "no-store",
        });

        if (!res.ok) return;

        const { events, serverTime } = await res.json() as {
          events: AppEvent[];
          serverTime: number;
        };

        // Advance cursor even if no events, using server time to avoid clock skew
        if (events.length === 0) {
          // Keep lastTimestamp as-is; no events means nothing to advance past
          return;
        }

        // Advance to the most recent event we received
        const maxTs = Math.max(...events.map((e) => e.timestamp));
        lastTimestampRef.current = maxTs;

        for (const data of events) {
          handleEvent(data, queryClient);
        }
      } catch {
        // Network error — silently retry next interval
      }
    }

    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    // Run immediately on mount so the first update isn't delayed by POLL_INTERVAL_MS
    poll();

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [queryClient]);
}

function handleEvent(data: AppEvent, queryClient: ReturnType<typeof useQueryClient>) {
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

    case "payment_deleted":
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

    case "session_revoked":
      // If this device's session was revoked, force logout
      if (data.userId || data.sessionId) {
        fetch("/api/auth/me")
          .then((r) => r.json())
          .then((me) => {
            const targetedByUserId = data.sessionId === undefined && me.id === data.userId;
            const targetedBySessionId = data.sessionId && me.sessionId === data.sessionId;
            if (targetedByUserId || targetedBySessionId) {
              fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                window.location.href = "/login";
              });
            }
          })
          .catch(() => {
            // /me returned 401 — session already invalid
            window.location.href = "/login";
          });
      }
      break;
  }
}
