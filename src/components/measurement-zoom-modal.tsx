"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calculator } from "./calculator";
import { OutfitMeasurements, CustomerMeasurement } from "./outfit-measurements";
import { Ruler } from "lucide-react";

// ─── Props ───────────────────────────────────────────────────────────────────

interface MeasurementZoomModalProps {
  open: boolean;
  onClose: () => void;
  customer: {
    name: string;
    id?: string;
  };
  /** Body measurement snapshot (or latest) for this outfit */
  customerMeasurements: CustomerMeasurement | null | undefined;
  measurementIsSnapshot?: boolean;
  measurementSnapshotId?: string | null;
  /** Garment-specific measurements (read-only in this modal) */
  garmentMeasurements: Record<string, string>;
  onGarmentMeasurementsChange: (updated: Record<string, string>) => void;
  onGarmentMeasurementsDirty?: () => void;
  outfitType?: string;
  role?: string;
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function MeasurementZoomModal({
  open,
  onClose,
  customer,
  customerMeasurements,
  measurementIsSnapshot,
  measurementSnapshotId,
  garmentMeasurements,
  onGarmentMeasurementsChange,
  onGarmentMeasurementsDirty,
  outfitType,
  role,
}: MeasurementZoomModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-5xl h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Ruler className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Measurements — {customer.name}</span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Measurements left | Calculator right ── */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Measurements panel — independently scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <OutfitMeasurements
              customerMeasurements={customerMeasurements}
              measurementIsSnapshot={measurementIsSnapshot}
              measurementSnapshotId={measurementSnapshotId}
              customer={customer}
              outfitType={outfitType}
              garmentMeasurements={garmentMeasurements}
              onGarmentMeasurementsChange={onGarmentMeasurementsChange}
              onGarmentMeasurementsDirty={onGarmentMeasurementsDirty}
              role={role}
            />
          </div>

          <Calculator />
        </div>
      </DialogContent>
    </Dialog>
  );
}
