import { eq, ne, and } from "drizzle-orm";
import { db } from "./db";
import { outfits, referenceImages, dependencies, productionLogs } from "./db/schema";
import type { Role } from "./permissions";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type OutfitStatus =
  | "DRAFT"
  | "DESIGN_IN_PROGRESS"
  | "WAITING_FOR_REFERENCES"
  | "WAITING_FOR_DEPENDENCIES"
  | "PRODUCTION_READY"
  | "PATTERN_DRAFTING"
  | "MAGGAM_WORK"
  | "MAGGAM_REVIEW"
  | "MAGGAM_REVIEWED"
  | "FABRIC_CUTTING"
  | "STITCHING"
  | "PRODUCTION_COMPLETED"
  | "TRIAL"
  | "ALTERATION"
  | "QC"
  | "READY_FOR_DELIVERY"
  | "DELIVERED";

type PreconditionType =
  | "references_locked"
  | "no_pending_dependencies"
  | "maggam_required"
  | "maggam_not_required";

interface TransitionRule {
  from: OutfitStatus;
  to: OutfitStatus;
  allowedRoles: Role[];
  preconditions?: { type: PreconditionType }[];
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  newStatus?: OutfitStatus;
}

// ─── TRANSITION RULES ───────────────────────────────────────────────────────

const TRANSITION_RULES: TransitionRule[] = [
  // Design phase
  { from: "DRAFT", to: "DESIGN_IN_PROGRESS", allowedRoles: ["ADMIN", "DESIGNER"] },
  { from: "DESIGN_IN_PROGRESS", to: "WAITING_FOR_REFERENCES", allowedRoles: ["ADMIN", "DESIGNER"] },

  // Release to production (refs must be locked)
  {
    from: "WAITING_FOR_REFERENCES",
    to: "PRODUCTION_READY",
    allowedRoles: ["ADMIN", "DESIGNER"],
    preconditions: [{ type: "references_locked" }],
  },

  // Dependency handling
  { from: "WAITING_FOR_REFERENCES", to: "WAITING_FOR_DEPENDENCIES", allowedRoles: ["ADMIN", "DESIGNER", "MASTER"] },
  {
    from: "WAITING_FOR_DEPENDENCIES",
    to: "PRODUCTION_READY",
    allowedRoles: ["ADMIN", "DESIGNER"],
    preconditions: [{ type: "no_pending_dependencies" }],
  },

  // Production phase — Master/Admin
  { from: "PRODUCTION_READY", to: "PATTERN_DRAFTING", allowedRoles: ["ADMIN", "MASTER"] },
  {
    from: "PATTERN_DRAFTING",
    to: "MAGGAM_WORK",
    allowedRoles: ["ADMIN", "MASTER"],
    preconditions: [{ type: "maggam_required" }],
  },
  {
    from: "PATTERN_DRAFTING",
    to: "FABRIC_CUTTING",
    allowedRoles: ["ADMIN", "MASTER"],
    preconditions: [{ type: "maggam_not_required" }],
  },
  { from: "MAGGAM_WORK", to: "MAGGAM_REVIEW", allowedRoles: ["ADMIN", "MASTER"] },
  { from: "MAGGAM_REVIEW", to: "MAGGAM_REVIEWED", allowedRoles: ["ADMIN", "DESIGNER"] }, // approve
  { from: "MAGGAM_REVIEW", to: "MAGGAM_WORK", allowedRoles: ["ADMIN", "DESIGNER"] },     // rework
  { from: "MAGGAM_REVIEWED", to: "FABRIC_CUTTING", allowedRoles: ["ADMIN", "MASTER"] },
  { from: "FABRIC_CUTTING", to: "STITCHING", allowedRoles: ["ADMIN", "MASTER"] },
  { from: "STITCHING", to: "PRODUCTION_COMPLETED", allowedRoles: ["ADMIN", "MASTER"] },

  // Post-production — Designer/Admin
  { from: "PRODUCTION_COMPLETED", to: "TRIAL", allowedRoles: ["ADMIN", "DESIGNER"] },
  { from: "TRIAL", to: "ALTERATION", allowedRoles: ["ADMIN", "DESIGNER"] },
  { from: "TRIAL", to: "QC", allowedRoles: ["ADMIN", "DESIGNER"] },
  { from: "ALTERATION", to: "QC", allowedRoles: ["ADMIN", "DESIGNER"] },
  { from: "QC", to: "READY_FOR_DELIVERY", allowedRoles: ["ADMIN", "DESIGNER"] },

  // Delivery — Reception/Admin
  { from: "READY_FOR_DELIVERY", to: "DELIVERED", allowedRoles: ["ADMIN", "RECEPTION"] },
];

// ─── PRECONDITION EVALUATION ────────────────────────────────────────────────

async function evaluatePrecondition(
  outfitId: string,
  precondition: { type: PreconditionType }
): Promise<boolean> {
  switch (precondition.type) {
    case "references_locked": {
      const refs = await db
        .select()
        .from(referenceImages)
        .where(eq(referenceImages.outfitId, outfitId));
      const patternRefs = refs.filter((r) => r.type === "PATTERN");
      if (patternRefs.length === 0) return false;
      return patternRefs.every((r) => r.status === "LOCKED");
    }

    case "no_pending_dependencies": {
      const pending = await db
        .select()
        .from(dependencies)
        .where(and(eq(dependencies.outfitId, outfitId), ne(dependencies.status, "AVAILABLE")));
      return pending.length === 0;
    }

    case "maggam_required": {
      const [outfit] = await db
        .select({ maggamRequired: outfits.maggamRequired })
        .from(outfits)
        .where(eq(outfits.id, outfitId));
      return outfit?.maggamRequired === true;
    }

    case "maggam_not_required": {
      const [outfit] = await db
        .select({ maggamRequired: outfits.maggamRequired })
        .from(outfits)
        .where(eq(outfits.id, outfitId));
      return outfit?.maggamRequired === false;
    }

    default:
      return false;
  }
}

// ─── TRANSITION VALIDATION ──────────────────────────────────────────────────

export async function validateTransition(
  outfitId: string,
  fromStatus: OutfitStatus,
  toStatus: OutfitStatus,
  role: Role,
  context?: { userId: string }
): Promise<TransitionResult> {
  // Find matching rule
  const rule = TRANSITION_RULES.find((r) => r.from === fromStatus && r.to === toStatus);

  if (!rule) {
    return { success: false, error: `Invalid transition: ${fromStatus} → ${toStatus}` };
  }

  // Check role authorization
  if (!rule.allowedRoles.includes(role)) {
    return { success: false, error: `Your role (${role}) cannot perform this transition` };
  }

  // Evaluate preconditions
  if (rule.preconditions) {
    for (const precondition of rule.preconditions) {
      const satisfied = await evaluatePrecondition(outfitId, precondition);
      if (!satisfied) {
        const messages: Record<PreconditionType, string> = {
          references_locked: "Pattern references must be locked before proceeding",
          no_pending_dependencies: "All dependencies must be resolved first",
          maggam_required: "This outfit requires Maggam work",
          maggam_not_required: "This outfit does not require Maggam work",
        };
        return { success: false, error: messages[precondition.type] };
      }
    }
  }

  // Master assignment check
  if (role === "MASTER" && context?.userId) {
    const [outfit] = await db
      .select({ masterId: outfits.masterId })
      .from(outfits)
      .where(eq(outfits.id, outfitId));
    if (outfit?.masterId !== context.userId) {
      return { success: false, error: "You are not assigned to this outfit" };
    }
  }

  return { success: true, newStatus: toStatus };
}

// ─── GET AVAILABLE TRANSITIONS ──────────────────────────────────────────────

export async function getAvailableTransitions(
  outfitId: string,
  currentStatus: OutfitStatus,
  role: Role,
  userId?: string
): Promise<{ status: OutfitStatus; label: string }[]> {
  const possibleRules = TRANSITION_RULES.filter(
    (r) => r.from === currentStatus && r.allowedRoles.includes(role)
  );

  const available: { status: OutfitStatus; label: string }[] = [];

  for (const rule of possibleRules) {
    // Check preconditions
    let valid = true;
    if (rule.preconditions) {
      for (const pre of rule.preconditions) {
        const ok = await evaluatePrecondition(outfitId, pre);
        if (!ok) {
          valid = false;
          break;
        }
      }
    }

    // Check master assignment
    if (role === "MASTER" && userId) {
      const [outfit] = await db
        .select({ masterId: outfits.masterId })
        .from(outfits)
        .where(eq(outfits.id, outfitId));
      if (outfit?.masterId !== userId) valid = false;
    }

    if (valid) {
      available.push({
        status: rule.to,
        label: formatStatusLabel(rule.to),
      });
    }
  }

  return available;
}

// ─── EXECUTE TRANSITION ─────────────────────────────────────────────────────

export async function executeTransition(
  outfitId: string,
  newStatus: OutfitStatus,
  userId: string,
  notes?: string
): Promise<void> {
  await db
    .update(outfits)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(outfits.id, outfitId));

  await db.insert(productionLogs).values({
    outfitId,
    status: newStatus,
    notes: notes || null,
    createdBy: userId,
  });

  // Auto-update order status based on all outfit statuses
  await updateOrderStatus(outfitId);

  // Emit real-time event
  const { eventBus } = await import("./events");
  const [outfit] = await db.select({ orderId: outfits.orderId }).from(outfits).where(eq(outfits.id, outfitId));
  eventBus.emit({
    type: "outfit_updated",
    outfitId,
    orderId: outfit?.orderId,
    userId,
    timestamp: Date.now(),
  });
}

// ─── ORDER STATUS CALCULATION ───────────────────────────────────────────────

import { orders } from "./db/schema";

async function updateOrderStatus(outfitId: string) {
  // Get the order for this outfit
  const [outfit] = await db
    .select({ orderId: outfits.orderId })
    .from(outfits)
    .where(eq(outfits.id, outfitId));

  if (!outfit) return;

  // Get all outfits in this order
  const orderOutfits = await db
    .select({ status: outfits.status })
    .from(outfits)
    .where(eq(outfits.orderId, outfit.orderId));

  const statuses = orderOutfits.map((o) => o.status);

  // Compute order status
  let orderStatus: string;

  if (statuses.every((s) => s === "DELIVERED")) {
    orderStatus = "Completed";
  } else if (statuses.every((s) => s === "READY_FOR_DELIVERY" || s === "DELIVERED")) {
    orderStatus = "Ready For Delivery";
  } else if (statuses.some((s) =>
    ["PATTERN_DRAFTING", "MAGGAM_WORK", "MAGGAM_REVIEW", "MAGGAM_REVIEWED", "FABRIC_CUTTING", "STITCHING", "PRODUCTION_COMPLETED"].includes(s)
  )) {
    orderStatus = "In Production";
  } else if (statuses.some((s) => s === "TRIAL" || s === "ALTERATION" || s === "QC")) {
    orderStatus = "Trial/QC";
  } else if (statuses.some((s) => s === "PRODUCTION_READY")) {
    orderStatus = "Production Ready";
  } else if (statuses.some((s) => s === "WAITING_FOR_DEPENDENCIES")) {
    orderStatus = "Waiting For Dependencies";
  } else if (statuses.some((s) =>
    ["DESIGN_IN_PROGRESS", "WAITING_FOR_REFERENCES"].includes(s)
  )) {
    orderStatus = "In Design";
  } else {
    orderStatus = "Active";
  }

  await db
    .update(orders)
    .set({ status: orderStatus, updatedAt: new Date() })
    .where(eq(orders.id, outfit.orderId));

  // Emit order_updated with customerId so customer pages refresh
  const [order] = await db
    .select({ customerId: orders.customerId })
    .from(orders)
    .where(eq(orders.id, outfit.orderId));

  const { eventBus } = await import("./events");
  eventBus.emit({
    type: "order_updated",
    orderId: outfit.orderId,
    customerId: order?.customerId,
    timestamp: Date.now(),
  });
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatStatusLabel(status: OutfitStatus): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
