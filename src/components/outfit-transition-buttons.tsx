"use client";

import React from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SHORT_STATUS_LABELS } from "@/components/outfit-status-badge";

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
    * outline styling to signal "send back for rework". Default: true.
   */
  maggamWorkVariant?: boolean;
    /** Optional layout classes for the button group container. */
    containerClassName?: string;
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
  maggamWorkVariant = true,
  containerClassName = "w-full flex-wrap",
  emptyPlaceholder = null,
}: OutfitTransitionButtonsProps) {
  if (transitions.length === 0) return <>{emptyPlaceholder}</>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`flex items-center justify-end gap-1.5 ${containerClassName}`}>
        {transitions.map((t) => {
          const shortLabel = SHORT_STATUS_LABELS[t.status] ?? t.label;
          const isLoading = !t.blocked && pendingStatus === t.status;

          // MAGGAM_WORK is a "rework / send back" action — amber outline + RotateCcw
          const isMaggamRework = maggamWorkVariant && t.status === "MAGGAM_WORK";

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
