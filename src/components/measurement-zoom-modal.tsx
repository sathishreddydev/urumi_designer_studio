"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Ruler, Calculator } from "lucide-react";
import { formatDate } from "@/lib/utils";

// ─── Body measurement sections ───────────────────────────────────────────────

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
  (s) => s.fields as unknown as string[]
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
      {/*
        w-[95vw] on mobile → full-width with small margin
        sm:max-w-2xl  → medium screens
        lg:max-w-5xl  → large screens (measurements + calculator side by side)
      */}
      <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-5xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
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
                        <div className="flex-1 h-px bg-border" />
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
                    ([k, v]) => !ALL_BODY_FIELDS.includes(k) && v
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

          {/* ── Divider ── */}
          <div className="hidden lg:block w-px bg-border shrink-0" />
          <div className="block lg:hidden h-px bg-border shrink-0" />

          {/* Calculator panel — sticky, never scrolls, measurements scroll beside it */}
          <div className="lg:w-72 shrink-0 flex flex-col px-5 py-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-4 w-4 text-primary shrink-0" />
              <h3 className="text-sm font-semibold">Calculator</h3>
            </div>
            <MeasurementCalculator />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Calculator ───────────────────────────────────────────────────────────────

function MeasurementCalculator() {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(true);

  function inputDigit(digit: string) {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  }

  function inputDecimal() {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  }

  function handleOperator(nextOp: string) {
    const current = parseFloat(display);
    if (previousValue !== null && operation && !waitingForOperand) {
      const result = compute(previousValue, current, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    } else {
      setPreviousValue(current);
    }
    setOperation(nextOp);
    setWaitingForOperand(true);
  }

  function handleEquals() {
    if (previousValue === null || !operation) return;
    const current = parseFloat(display);
    const result = compute(previousValue, current, operation);
    setDisplay(String(result));
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  }

  function handleClear() {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  }

  function handleBackspace() {
    if (waitingForOperand) return;
    const next = display.length > 1 ? display.slice(0, -1) : "0";
    setDisplay(next);
    if (next === "0") setWaitingForOperand(true);
  }

  function compute(a: number, b: number, op: string): number {
    let result: number;
    switch (op) {
      case "+": result = a + b; break;
      case "−": result = a - b; break;
      case "×": result = a * b; break;
      case "÷": result = b !== 0 ? a / b : 0; break;
      default: result = b;
    }
    // Avoid floating-point noise
    return Math.round(result * 100000) / 100000;
  }

  // ── Styles ──
  const cell  = "flex items-center justify-center rounded-xl font-semibold select-none cursor-pointer transition-all active:scale-95 h-11 text-base";
  const num   = `${cell} bg-background border border-border text-foreground shadow-sm hover:bg-muted`;
  const op    = `${cell} bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20`;
  const eq    = `${cell} col-span-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md text-lg`;
  const ac    = `${cell} bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400`;
  const bk    = `${cell} bg-muted border border-border text-muted-foreground hover:bg-muted/60`;

  return (
    <div className="space-y-3">
      {/* Display */}
      <div className="rounded-xl bg-background border border-border px-4 py-3 shadow-inner">
        {/* Expression line */}
        <div className="min-h-[18px] text-right">
          {operation && previousValue !== null ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {previousValue} {operation}
            </span>
          ) : (
            <span className="text-xs text-transparent select-none">·</span>
          )}
        </div>
        {/* Main number */}
        <div className="text-right">
          <span className="text-3xl font-bold tabular-nums tracking-tight break-all">
            {display}
          </span>
        </div>
      </div>

      {/* Buttons — 4-column grid */}
      <div className="grid grid-cols-4 gap-2">
        {/* Row 1: AC  ⌫  ÷  × */}
        <button className={ac} onClick={handleClear}>AC</button>
        <button className={bk} onClick={handleBackspace}>⌫</button>
        <button className={op} onClick={() => handleOperator("÷")}>÷</button>
        <button className={op} onClick={() => handleOperator("×")}>×</button>

        {/* Row 2: 7  8  9  − */}
        <button className={num} onClick={() => inputDigit("7")}>7</button>
        <button className={num} onClick={() => inputDigit("8")}>8</button>
        <button className={num} onClick={() => inputDigit("9")}>9</button>
        <button className={op}  onClick={() => handleOperator("−")}>−</button>

        {/* Row 3: 4  5  6  + */}
        <button className={num} onClick={() => inputDigit("4")}>4</button>
        <button className={num} onClick={() => inputDigit("5")}>5</button>
        <button className={num} onClick={() => inputDigit("6")}>6</button>
        <button className={op}  onClick={() => handleOperator("+")}>+</button>

        {/* Row 4: 1  2  3  0 */}
        <button className={num} onClick={() => inputDigit("1")}>1</button>
        <button className={num} onClick={() => inputDigit("2")}>2</button>
        <button className={num} onClick={() => inputDigit("3")}>3</button>
        <button className={num} onClick={() => inputDigit("0")}>0</button>

        {/* Row 5: .  =  = (spans 2) */}
        <button className={num} onClick={inputDecimal}>.</button>
        <button className={eq}  onClick={handleEquals}>=</button>
      </div>

      <p className="text-[11px] text-center text-muted-foreground pt-1">
        Quick calculations for measurements
      </p>
    </div>
  );
}
