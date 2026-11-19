"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function OwnerSessionExpiryWarning() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/owner/auth/session", { cache: "no-store" });
        if (response.status === 401) {
          if (active) {
            setExpired(true);
            setExpiresAt(null);
          }
          return;
        }
        const result: unknown = await response.json();
        if (!response.ok || !result || typeof result !== "object" || !("expiresAt" in result) ||
          typeof result.expiresAt !== "number") {
          throw new Error("Could not check the owner session expiry.");
        }
        if (active) {
          setExpiresAt(result.expiresAt);
          setExpired(false);
          setError("");
        }
      } catch (sessionError) {
        if (active) {
          setError(sessionError instanceof Error ? sessionError.message : "Could not check the owner session expiry.");
        }
      }
    }

    void loadSession();
    const refreshInterval = window.setInterval(loadSession, 60_000);
    const renewalHandler = () => { void loadSession(); };
    window.addEventListener("owner-session-renewed", renewalHandler);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("owner-session-renewed", renewalHandler);
    };
  }, []);

  useEffect(() => {
    const clockInterval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(clockInterval);
  }, []);

  const remainingMs = expiresAt === null ? null : expiresAt - now;
  const shouldWarn = expired || (remainingMs !== null && remainingMs <= 5 * 60_000);
  if (!shouldWarn && !error) return null;

  const remainingSeconds = remainingMs === null ? 0 : Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {expired || (remainingMs !== null && remainingMs <= 0) ? (
          <>
            Your owner session has expired. Unsaved changes may not be saved.{" "}
            <Link href="/owner/login" className="font-medium underline">Sign in again</Link>.
          </>
        ) : shouldWarn ? (
          <>
            Your owner session expires in {minutes}:{String(seconds).padStart(2, "0")}. Save your work soon.
          </>
        ) : (
          error
        )}
      </p>
    </div>
  );
}
