"use client";

import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";

interface Branding {
  name: string;
  logoUrl: string;
}

export function InactiveStudioPage({ branding: initialBranding }: { branding?: Branding }) {
  const [branding, setBranding] = useState<Branding | null>(initialBranding ?? null);

  useEffect(() => {
    if (initialBranding) return;
    fetch("/api/tenant/branding", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.studio) setBranding(data.studio); })
      .catch(() => {});
  }, [initialBranding]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">

        {/* Logo or fallback icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border bg-background shadow-sm">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-16 w-16 rounded-xl object-contain"
            />
          ) : (
            <ShieldOff className="h-9 w-9 text-muted-foreground" />
          )}
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {branding?.name ?? "This studio"} is currently inactive
          </h1>
          <p className="text-sm text-muted-foreground">
            Access to this domain has been temporarily disabled.
            Please contact the studio team for assistance.
          </p>
        </div>

        {/* Status badge */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1 text-xs font-medium text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          Domain inactive
        </span>

      </div>
    </main>
  );
}
