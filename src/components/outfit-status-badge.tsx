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
  DESIGN_IN_PROGRESS: "Designing",
  WAITING_FOR_REFERENCES: "Wait-Ref",
  WAITING_FOR_DEPENDENCIES: "Wait-Dep",
  PRODUCTION_READY: "P-Ready",
  PATTERN_DRAFTING: "Drafting",
  MAGGAM_WORK: "Maggam",
  MAGGAM_REVIEW: "M-Review",
  MAGGAM_REVIEWED: "M-Reviewed",
  FABRIC_CUTTING: "Fab Cutting",
  STITCHING: "Stitch",
  PRODUCTION_COMPLETED: "P-Completed",
  TRIAL: "Trial",
  ALTERATION: "Alter",
  QC: "QC",
  READY_FOR_DELIVERY: "Rdy-Del",
  DELIVERED: "Delivered",
};

// Export so outfit-transition-buttons and other files can reuse
export { SHORT_STATUS_LABELS };

// ─── Semantic status groupings ────────────────────────────────────────────────

/** Statuses from which completion photos can be uploaded. */
export const COMPLETION_STATUSES = [
  "PRODUCTION_COMPLETED",
  "TRIAL",
  "ALTERATION",
  "QC",
  "READY_FOR_DELIVERY",
  "DELIVERED",
] as const;

/** Statuses at which the outfit is locked for production — no material changes. */
export const MATERIAL_LOCKED_STATUSES = [
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

/** Statuses at which the outfit detail is fully locked (no editing). */
export const LOCKED_STATUSES = [
  "PRODUCTION_COMPLETED",
  "TRIAL",
  "ALTERATION",
  "QC",
  "READY_FOR_DELIVERY",
  "DELIVERED",
] as const;

/** Statuses where the customer can approve design references in the portal. */
export const APPROVAL_ALLOWED_STATUSES = [
  "DRAFT",
  "DESIGN_IN_PROGRESS",
  "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES",
] as const;

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
