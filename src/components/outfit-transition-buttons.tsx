"use client";

import { ArrowRight } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Short labels for mobile — single-word / abbreviation so they fit narrow spaces
export const OUTFIT_STATUS_SHORT_LABELS: Record<string, string> = {
  DESIGN_IN_PROGRESS: "Design",
  WAITING_FOR_REFERENCES: "Refs",
  WAITING_FOR_DEPENDENCIES: "Deps",
  PRODUCTION_READY: "Prod",
  PATTERN_DRAFTING: "Pattern",
  MAGGAM_WORK: "Maggam",
  MAGGAM_REVIEW: "Review",
  MAGGAM_REVIEWED: "✓ Maggam",
  FABRIC_CUTTING: "Cut",
  STITCHING: "Stitch",
  PRODUCTION_COMPLETED: "✓ Prod",
  TRIAL: "Trial",
  ALTERATION: "Alter",
  QC: "QC",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "✓ Done",
};

export interface OutfitTransition {
  status: string;
  label: string;
  blocked: boolean;
  reason?: string;
}

interface OutfitTransitionButtonsProps {
  transitions: OutfitTransition[];
  /**
   * Called when a transition button is clicked.
   * `isPending` should track whether *this* status is currently loading.
   */
  onTransition: (status: string) => void;
  /** Pass the currently-pending status string so the right button shows a spinner. */
  pendingStatus?: string | null;
  /** When true, show icon + short label on mobile; full label on sm+. Default: true */
  responsive?: boolean;
}

/**
 * Shared outfit status transition buttons.
 * Used in both the outfit detail page header and the order detail outfit cards.
 */
export function OutfitTransitionButtons({
  transitions,
  onTransition,
  pendingStatus,
  responsive = true,
}: OutfitTransitionButtonsProps) {
  if (transitions.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1.5">
        {transitions.map((t) => {
          const shortLabel = OUTFIT_STATUS_SHORT_LABELS[t.status] ?? t.label;
          const isLoading = !t.blocked && pendingStatus === t.status;

          return (
            <Tooltip key={t.status}>
              <TooltipTrigger asChild>
                <span className={t.blocked ? "cursor-not-allowed" : undefined}>
                  <LoadingButton
                    size="sm"
                    variant="outline"
                    loading={isLoading}
                    disabled={t.blocked}
                    onClick={() => !t.blocked && onTransition(t.status)}
                    className="h-7 text-xs px-2 sm:px-2.5 whitespace-nowrap bg-background"
                  >
                    <ArrowRight className="h-3 w-3 shrink-0 sm:mr-1" />
                    {responsive ? (
                      <>
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="sm:hidden ml-0.5">{shortLabel}</span>
                      </>
                    ) : (
                      <span>{t.label}</span>
                    )}
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t.blocked && t.reason ? t.reason : `Move to: ${t.label}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
