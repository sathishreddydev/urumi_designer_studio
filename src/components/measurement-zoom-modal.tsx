"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { Calculator } from "./calculator";
// ─── Body measurement sections ───────────────────────────────────────────────
import { Ruler } from "lucide-react";
const BODY_MEASUREMENT_SECTIONS = [
  {
    num: "01",
    title: "UPPER BODY",
    fields: [
      "Shoulder",
      "Upper Bust",
      "Bust",
      "Lower Bust",
      "Waist",
      "Lower Waist",
      "Hip",
    ],
  },
  {
    num: "02",
    title: "APEX & SLEEVES",
    fields: [
      "Apex Point",
      "Apex Down",
      "Apex Gap",
      "Sleeve Length",
      "Sleeve Loose",
      "Armhole",
      "Neck Front",
      "Neck Back",
    ],
  },
  {
    num: "03",
    title: "BOTTOM (PANT)",
    fields: [
      "Pant Length",
      "Pant Waist",
      "Hip / Seat",
      "Crotch (Rise)",
      "Thigh",
      "Knee",
      "Ankle",
      "Bottom Loose",
    ],
  },
] as const;

const ALL_BODY_FIELDS: string[] = BODY_MEASUREMENT_SECTIONS.flatMap(
  (s) => s.fields as unknown as string[],
);

// ─── Props ───────────────────────────────────────────────────────────────────

interface MeasurementZoomModalProps {
  open: boolean;
  onClose: () => void;
  customer: {
    name: string;
    /** Pass a measurements array (customer page) OR a single measurement (outfit page) */
    measurements?: Array<{
      id: string;
      version: number;
      values: Record<string, string>;
      createdAt: string;
    }>;
    measurement?: {
      id: string;
      version: number;
      values: Record<string, string>;
      createdAt: string;
    };
  };
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function MeasurementZoomModal({
  open,
  onClose,
  customer,
}: MeasurementZoomModalProps) {
  // Accept either an array (customer page) or a single object (outfit page)
  const measurements = customer.measurements?.length
    ? customer.measurements
    : customer.measurement
      ? [customer.measurement]
      : [];

  const saved =
    measurements.length > 0
      ? (measurements[0].values as Record<string, string>)
      : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>

      <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-5xl h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Ruler className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">
              Body Measurements — {customer.name}
            </span>
          </DialogTitle>
          {saved && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Version {measurements[0].version} ·{" "}
              {formatDate(measurements[0].createdAt)} · All values in inches
            </p>
          )}
        </DialogHeader>

        {/* ── Body: measurements left | calculator right ── */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Measurements panel — independently scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
            {saved ? (
              <>
                {BODY_MEASUREMENT_SECTIONS.map((section) => {
                  const entries = (section.fields as unknown as string[])
                    .map((f) => [f, saved[f]] as [string, string])
                    .filter(([, v]) => v);
                  if (!entries.length) return null;
                  return (
                    <div key={section.num} className="space-y-2">
                      {/* Section header */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-primary tabular-nums">
                          {section.num}
                        </span>
                        <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                          {section.title}
                        </span>
                      </div>

                      {/* 2 cols on mobile, 3 on sm+ */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {entries.map(([field, value]) => (
                          <div
                            key={field}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-xs text-muted-foreground truncate mr-2">
                              {field}
                            </span>
                            <span className="text-sm font-bold tabular-nums shrink-0">
                              {value}"
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Custom fields */}
                {(() => {
                  const extras = Object.entries(saved).filter(
                    ([k, v]) => !ALL_BODY_FIELDS.includes(k) && v,
                  );
                  if (!extras.length) return null;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                          CUSTOM
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {extras.map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-xs text-muted-foreground truncate mr-2">
                              {k}
                            </span>
                            <span className="text-sm font-bold tabular-nums shrink-0">
                              {v}"
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="py-16 text-center">
                <Ruler className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No measurements available
                </p>
              </div>
            )}
          </div>

          <Calculator />
        </div>
      </DialogContent>
    </Dialog>
  );
}
