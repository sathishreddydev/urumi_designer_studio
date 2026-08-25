"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Plus, X } from "lucide-react";

// ─── Body sections ────────────────────────────────────────────────────────────

export const BODY_SECTIONS = [
  {
    num: "01",
    title: "UPPER BODY",
    fields: [
      "Shoulder Length",
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

export const ALL_BODY_FIELD_NAMES: string[] = BODY_SECTIONS.flatMap(
  (s) => s.fields as unknown as string[],
);

// ─── Garment fields per outfit type ──────────────────────────────────────────

export const GARMENT_FIELDS: Record<string, string[]> = {
  "Bridal Blouse": [
    "Front Length",
    "Back Length",
    "Neck Front",
    "Neck Back",
    "Sleeve Round",
    "Armhole",
  ],
  "Reception Blouse": [
    "Front Length",
    "Back Length",
    "Neck Front",
    "Neck Back",
    "Sleeve Round",
    "Armhole",
  ],
  "Saree Blouse": [
    "Front Length",
    "Back Length",
    "Neck Front",
    "Neck Back",
    "Sleeve Round",
    "Armhole",
  ],
  Lehenga: ["Lehenga Length", "Flare / Gher", "Waist Band"],
  Gown: [
    "Full Length",
    "Yoke Length",
    "Neck Front",
    "Neck Back",
    "Slit Start",
  ],
  Kurta: ["Kurti Length", "Neck Front", "Neck Back", "Side Slit Start"],
  Anarkali: [
    "Anarkali Length",
    "Yoke Length",
    "Neck Front",
    "Neck Back",
    "Flare / Gher",
  ],
  Sharara: ["Top Length", "Sharara Length", "Neck Front"],
  Other: ["Length", "Neck Front", "Neck Back"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerMeasurement {
  id: string;
  version: number;
  values: Record<string, string>;
  createdAt?: string;
}

export interface OutfitMeasurementsProps {
  customerMeasurements: CustomerMeasurement | null | undefined;
  measurementIsSnapshot?: boolean;
  measurementSnapshotId?: string | null;
  customer?: { id?: string; name?: string } | null;
  outfitType?: string;

  // Garment measurements — state lives in parent
  garmentMeasurements: Record<string, string>;
  onGarmentMeasurementsChange: (updated: Record<string, string>) => void;
  onGarmentMeasurementsDirty?: () => void;

  role?: string;

  /**
   * readOnly=true — garment fields shown as plain text, no add/remove/input.
   * Used in the zoom modal so the user can read measurements alongside the calculator.
   * Default: false (editable, used on the detail page).
   */
  readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OutfitMeasurements({
  customerMeasurements,
  measurementIsSnapshot,
  measurementSnapshotId,
  customer,
  outfitType,
  garmentMeasurements,
  onGarmentMeasurementsChange,
  onGarmentMeasurementsDirty,
  role,
  readOnly = false,
}: OutfitMeasurementsProps) {
  const [newGarmentField, setNewGarmentField] = useState("");

  const isReception = role === "RECEPTION";
  const isMaster = role === "MASTER";
  // In readOnly mode treat all garment fields as display-only (no inputs, no add/remove)
  const garmentEditable = !readOnly && !isReception;

  // Template fields for the garment type
  const typeKey =
    Object.keys(GARMENT_FIELDS).find(
      (k) => k.toLowerCase() === (outfitType || "").toLowerCase(),
    ) || outfitType;
  const templateFields =
    GARMENT_FIELDS[typeKey ?? ""] || GARMENT_FIELDS["Other"] || [];

  function addField(key: string) {
    const k = key.trim();
    if (!k || k in garmentMeasurements) return;
    onGarmentMeasurementsChange({ ...garmentMeasurements, [k]: "" });
    onGarmentMeasurementsDirty?.();
    setNewGarmentField("");
  }

  function removeField(field: string) {
    const copy = { ...garmentMeasurements };
    delete copy[field];
    onGarmentMeasurementsChange(copy);
    onGarmentMeasurementsDirty?.();
  }

  function setFieldValue(field: string, value: string) {
    onGarmentMeasurementsChange({ ...garmentMeasurements, [field]: value });
    onGarmentMeasurementsDirty?.();
  }

  // ── Body ─────────────────────────────────────────────────────────────────

  const bodyContent = (() => {
    if (!customerMeasurements) {
      return (
        <p className="text-xs text-muted-foreground italic py-1">
          No body measurements.{" "}
          {customer?.id && !isMaster && !readOnly && (
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="text-primary hover:underline"
            >
              Add →
            </Link>
          )}
        </p>
      );
    }

    const vals = customerMeasurements.values as Record<string, string>;

    return (
      <div className="space-y-1.5">
        {/* Stale-snapshot warning — only in edit mode */}
        {!readOnly &&
          !measurementIsSnapshot &&
          measurementSnapshotId === null &&
          customer?.id &&
          !isMaster && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Showing latest — created before snapshots were tracked.
            </p>
          )}

        {BODY_SECTIONS.map((section) => {
          const entries = (section.fields as unknown as string[])
            .map((f) => [f, vals[f]] as [string, string])
            .filter(([, v]) => v);
          if (!entries.length) return null;

          return (
            <div key={section.num} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-primary/60 tabular-nums">
                  {section.num}
                </span>
                <span className="text-[9px] font-bold text-muted-foreground">
                  {section.title}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5">
                {entries.map(([field, value]) => (
                  <div
                    key={field}
                    className="flex justify-between items-center border-b border-muted/40 py-0.5"
                  >
                    <span className="text-[11px] text-muted-foreground truncate mr-1">
                      {field}
                    </span>
                    <span className="text-[11px] font-semibold shrink-0">
                      {value}"
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Custom fields not in standard sections */}
        {(() => {
          const extras = Object.entries(vals).filter(
            ([k, v]) => !ALL_BODY_FIELD_NAMES.includes(k) && v,
          );
          if (!extras.length) return null;
          return (
            <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 pt-1">
              {extras.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between items-center border-b border-muted/40 py-0.5"
                >
                  <span className="text-[11px] text-muted-foreground">{k}</span>
                  <span className="text-[11px] font-semibold">{v}"</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Edit link — detail page only */}
        {!readOnly && customer?.id && !isMaster && (
          <Link
            href={`/dashboard/customers/${customer.id}`}
            className="text-[11px] text-primary hover:underline mt-1 inline-block"
          >
            Edit body measurements →
          </Link>
        )}
      </div>
    );
  })();

  // ── Garment ───────────────────────────────────────────────────────────────

  const garmentContent = (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">
        Garment ·{" "}
        <span className="normal-case font-normal">{outfitType}</span>
      </p>
      <p className="text-[11px] text-muted-foreground">All values in inches.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
        {Object.entries(garmentMeasurements).map(([field, value]) => {
          const bodyValue = customerMeasurements?.values?.[field];
          const isDuplicate =
            bodyValue && bodyValue !== "" && bodyValue !== value && value !== "";
          const isCustomField = !templateFields.includes(field);

          return (
            <div key={field} className="space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <label className="text-[11px] text-muted-foreground truncate">
                  {field}
                </label>
                <div className="flex items-center gap-0.5 shrink-0">
                  {bodyValue && bodyValue !== "" && (
                    <span
                      className={`text-[9px] px-1 rounded font-medium ${
                        isDuplicate
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                      title={`Body measurement: ${bodyValue}"`}
                    >
                      B:{bodyValue}"
                    </span>
                  )}
                  {/* Remove only in edit mode */}
                  {isCustomField && garmentEditable && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => removeField(field)}
                      title="Remove field"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Read-only: plain text. Edit mode: input */}
              {readOnly || isReception ? (
                <p className="h-7 text-xs px-2 flex items-center font-semibold">
                  {value || "—"}
                </p>
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setFieldValue(field, e.target.value)}
                  placeholder="in inches"
                  inputMode="decimal"
                  className={`h-7 text-xs px-2 ${
                    isDuplicate
                      ? "border-amber-400 focus-visible:ring-amber-400"
                      : ""
                  }`}
                />
              )}

              {isDuplicate && (
                <p className="text-[9px] text-amber-600 flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  Differs from body ({bodyValue}")
                </p>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(garmentMeasurements).length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No garment measurements.
        </p>
      )}

      {/* Add custom field — edit mode only */}
      {garmentEditable && (
        <div className="flex gap-2 pt-1">
          <Input
            value={newGarmentField}
            onChange={(e) => setNewGarmentField(e.target.value)}
            placeholder="Custom field (e.g. Sleeve Round)"
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addField(newGarmentField);
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 shrink-0"
            onClick={() => addField(newGarmentField)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Body section header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            Body ·{" "}
            <span className="normal-case font-normal text-muted-foreground">
              inches
            </span>
          </p>
          {customerMeasurements && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">
                v{customerMeasurements.version}
              </span>
              {measurementIsSnapshot ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  at order time
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50"
                >
                  latest
                </Badge>
              )}
            </div>
          )}
        </div>
        {bodyContent}
      </div>

      <Separator />

      {garmentContent}
    </div>
  );
}
