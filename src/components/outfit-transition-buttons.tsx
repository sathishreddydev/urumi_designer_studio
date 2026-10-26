"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
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
   * Called when a transition button is clicked with the target status string.
   */
  onTransition: (status: string) => void;
  /** Pass the currently-pending status string so only that button shows a spinner. */
  pendingStatus?: string | null;
  /**
   * When true (default), show short label on mobile and full label on sm+.
   * When false, always show the full label.
   */
  responsive?: boolean;
  /**
   * Which side to show the tooltip on. Default: "bottom".
   */
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /**
   * When true, MAGGAM_WORK transitions render with a RotateCcw icon and amber
   * outline styling to signal "send back for rework". Default: false.
   */
  maggamWorkVariant?: boolean;
  /**
   * Element to render when there are no available transitions.
   * Default: null (renders nothing).
   */
  emptyPlaceholder?: React.ReactNode;
}

/**
 * Shared outfit status transition buttons.
 * Used in the outfit detail header, order detail cards, production, outfits list,
 * and stitching-maggam pages.
 */
export function OutfitTransitionButtons({
  transitions,
  onTransition,
  pendingStatus,
  responsive = true,
  tooltipSide = "bottom",
  maggamWorkVariant = false,
  emptyPlaceholder = null,
}: OutfitTransitionButtonsProps) {
  if (transitions.length === 0) return <>{emptyPlaceholder}</>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1.5">
        {transitions.map((t) => {
          const shortLabel = OUTFIT_STATUS_SHORT_LABELS[t.status] ?? t.label;
          const isLoading = !t.blocked && pendingStatus === t.status;

          // MAGGAM_WORK is a "rework / send back" action — amber outline + RotateCcw
          const isMaggamRework = maggamWorkVariant && t.status === "MAGGAM_WORK";

          return (
            <Tooltip key={t.status}>
              <TooltipTrigger asChild>
                <span className={t.blocked ? "cursor-not-allowed" : undefined}>
                  <LoadingButton
                    size="sm"
                    variant={isMaggamRework ? "outline" : "outline"}
                    loading={isLoading}
                    disabled={t.blocked}
                    onClick={() => !t.blocked && onTransition(t.status)}
                    className={[
                      "h-7 text-xs px-2 sm:px-2.5 whitespace-nowrap bg-background",
                      isMaggamRework
                        ? "text-amber-600 border-amber-400 hover:bg-amber-50"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {isMaggamRework ? (
                      <RotateCcw className="h-3 w-3 shrink-0 sm:mr-1" />
                    ) : (
                      <ArrowRight className="h-3 w-3 shrink-0 sm:mr-1" />
                    )}
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
              <TooltipContent side={tooltipSide}>
                {t.blocked && t.reason ? t.reason : `Move to: ${t.label}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
