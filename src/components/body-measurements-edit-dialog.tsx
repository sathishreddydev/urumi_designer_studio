"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Body sections — kept in sync with the customer detail page so saved
// field names match exactly what the customer page stores ("Shoulder", etc.).
const BODY_SECTIONS = [
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

const ALL_BODY_FIELDS: string[] = BODY_SECTIONS.flatMap(
  (s) => s.fields as unknown as string[],
);

interface BodyMeasurementsEditDialogProps {
  customerId: string;
  customerName?: string;
  /** Latest body measurement values (Record<field, value>) */
  currentValues?: Record<string, string> | null;
  /** Called after a successful save — parent should refresh its own data */
  onSaved?: () => void;
  /** Custom trigger label (defaults to "Edit"/"Add body measurements →") */
  triggerLabel?: string;
  /** Extra classes for the trigger */
  triggerClassName?: string;
}

export function BodyMeasurementsEditDialog({
  customerId,
  customerName,
  currentValues,
  onSaved,
  triggerLabel,
  triggerClassName = "text-[11px] text-primary hover:underline mt-1 inline-block",
}: BodyMeasurementsEditDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [newField, setNewField] = useState("");

  const hasExisting =
    !!currentValues &&
    Object.values(currentValues).some((v) => v && v.trim() !== "");

  // Prefill when the dialog opens: all standard fields (even if blank) + any
  // custom fields already stored, so the user sees the full form each time.
  useEffect(() => {
    if (!open) return;
    const latest = currentValues || {};
    const prefilled: Record<string, string> = {};
    ALL_BODY_FIELDS.forEach((k) => {
      prefilled[k] = latest[k] || "";
    });
    Object.entries(latest).forEach(([k, v]) => {
      if (!(k in prefilled)) prefilled[k] = v;
    });
    setValues(prefilled);
    setNewField("");
  }, [open, currentValues]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) throw new Error("Failed to save measurements");
      return res.json();
    },
    onSuccess: () => {
      // Refresh customer data (customer page uses this key) and let the
      // parent refresh its own view (e.g. the outfit page's ["outfit", id]).
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onSaved?.();
      setOpen(false);
      toast({
        title: "Saved",
        description: "Body measurements updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed",
        description: error.message,
      });
    },
  });

  function setField(field: string, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function addField() {
    const k = newField.trim();
    if (!k || k in values) return;
    setValues((prev) => ({ ...prev, [k]: "" }));
    setNewField("");
  }

  function removeField(field: string) {
    setValues((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }

  const label =
    triggerLabel ??
    (hasExisting ? "Edit body measurements →" : "Add body measurements →");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          {label}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {hasExisting ? "Edit" : "Add"} Body Measurements
            {customerName ? (
              <span className="text-muted-foreground font-normal"> · {customerName}</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
          Body dimensions only. Garment-specific lengths are entered on each
          outfit. <strong>All values in inches.</strong>
        </p>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {BODY_SECTIONS.map((section) => {
            const sectionFields = section.fields as unknown as string[];
            return (
              <div key={section.num} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-primary/60 tabular-nums">
                    {section.num}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {section.title}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
                  {sectionFields.map((field) => (
                    <div key={field} className="space-y-0.5">
                      <label className="text-[11px] text-muted-foreground truncate block">
                        {field}
                      </label>
                      <Input
                        value={values[field] ?? ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setField(field, e.target.value)
                        }
                        placeholder="in inches"
                        inputMode="decimal"
                        className="h-7 text-xs px-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Custom fields */}
          {(() => {
            const extras = Object.keys(values).filter(
              (k) => !ALL_BODY_FIELDS.includes(k),
            );
            if (!extras.length) return null;
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    CUSTOM FIELDS
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
                  {extras.map((field) => (
                    <div key={field} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-muted-foreground truncate">
                          {field}
                        </label>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          onClick={() => removeField(field)}
                          title="Remove field"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <Input
                        value={values[field] ?? ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setField(field, e.target.value)
                        }
                        placeholder="in inches"
                        inputMode="decimal"
                        className="h-7 text-xs px-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Add custom field */}
          <div className="flex gap-2 pt-1">
            <Input
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              placeholder="Custom field (e.g. Sleeve Round)"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addField();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 shrink-0"
              onClick={addField}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save measurements"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
