"use client";

import { Badge } from "@/components/ui/badge";
import { getStatusColor, formatStatus } from "@/lib/utils";

// ─── Canonical status lists ───────────────────────────────────────────────────

/** All 17 outfit workflow statuses in pipeline order. */
export const ALL_OUTFIT_STATUSES = [
  "DRAFT",
  "DESIGN_IN_PROGRESS",
  "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES",
  "PRODUCTION_READY",
  "PATTERN_DRAFTING",
  "MAGGAM_WORK",
  "MAGGAM_REVIEW",
  "MAGGAM_REVIEWED",
  "FABRIC_CUTTING",
  "STITCHING",
  "PRODUCTION_COMPLETED",
  "TRIAL",
  "ALTERATION",
  "QC",
  "READY_FOR_DELIVERY",
  "DELIVERED",
] as const;

export type OutfitStatus = (typeof ALL_OUTFIT_STATUSES)[number];

/** Production-phase statuses used to filter the production and stitching-maggam pages. */
export const PRODUCTION_STATUSES = [
  "WAITING_FOR_DEPENDENCIES",
  "PRODUCTION_READY",
  "PATTERN_DRAFTING",
  "MAGGAM_WORK",
  "MAGGAM_REVIEW",
  "MAGGAM_REVIEWED",
  "FABRIC_CUTTING",
  "STITCHING",
  "PRODUCTION_COMPLETED",
] as const;

/** Order-level status strings (stored as human-readable, not SNAKE_CASE). */
export const ORDER_STATUSES = [
  "Active",
  "In Design",
  "Production Ready",
  "Waiting For Dependencies",
  "In Production",
  "Trial/QC",
  "Ready For Delivery",
  "Completed",
] as const;

/**
 * Short labels for mobile — keeps badge narrow on small screens.
 * Full label shown on sm+ via responsive classes.
 */
const SHORT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  DESIGN_IN_PROGRESS: "Design",
  WAITING_FOR_REFERENCES: "Refs",
  WAITING_FOR_DEPENDENCIES: "Blocked",
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

/**
 * Returns the short label for a status. Falls back to formatStatus if not in the map.
 * Useful for rendering compact labels in filter dropdowns on mobile.
 */
export function formatStatusShort(status: string): string {
  return SHORT_STATUS_LABELS[status] ?? formatStatus(status);
}

interface OutfitStatusBadgeProps {
  status: string;
  /**
   * When true (default), shows short label on mobile and full label on sm+.
   * When false, always shows the full label.
   */
  responsive?: boolean;
  className?: string;
}

/**
 * Shared badge for outfit (and order) status — consistent colour + label everywhere.
 * Replaces the scattered `<Badge className={getStatusColor(status)}>{formatStatus(status)}</Badge>` pattern.
 */
export function OutfitStatusBadge({
  status,
  responsive = true,
  className = "",
}: OutfitStatusBadgeProps) {
  const colorClass = getStatusColor(status);
  const fullLabel = formatStatus(status);
  const shortLabel = SHORT_STATUS_LABELS[status] ?? fullLabel;

  return (
    <Badge
      className={`${colorClass} whitespace-nowrap ${className}`}
    >
      {responsive ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{fullLabel}</span>
        </>
      ) : (
        fullLabel
      )}
    </Badge>
  );
}
