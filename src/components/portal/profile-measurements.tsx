"use client";

import { Ruler } from "lucide-react";

export function ProfileMeasurements({
  measurements,
}: {
  measurements: Record<string, string> | null | undefined;
}) {
  const entries = measurements
    ? Object.entries(measurements as Record<string, string>).filter(
        ([, v]) => v,
      )
    : [];

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Ruler className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Measurements will be recorded by the studio during your consultation.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-lg border bg-card px-3 py-2.5 space-y-0.5"
        >
          <p className="text-[11px] text-muted-foreground capitalize leading-none">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </p>
          <p className="text-sm font-semibold font-mono text-foreground">
            {value}"
          </p>
        </div>
      ))}
    </div>
  );
}
