/**
 * Auto-triggers — automatically advance outfit status based on actions.
 * 
 * These run AFTER the action completes (e.g., after measurement is saved).
 * They check the current status and advance if conditions are met.
 */

import { eq } from "drizzle-orm";
import { db } from "./db";
import { outfits, productionLogs } from "./db/schema";

type OutfitStatus = string;

async function advanceStatus(outfitId: string, newStatus: OutfitStatus, triggeredBy: string, reason: string) {
  await db
    .update(outfits)
    .set({ status: newStatus as any, updatedAt: new Date() })
    .where(eq(outfits.id, outfitId));

  await db.insert(productionLogs).values({
    outfitId,
    status: newStatus,
    notes: `Auto: ${reason}`,
    createdBy: triggeredBy,
  });

  // Emit real-time event
  const { eventBus } = await import("./events");
  const [outfit] = await db.select({ orderId: outfits.orderId }).from(outfits).where(eq(outfits.id, outfitId));
  eventBus.emit({
    type: "outfit_updated",
    outfitId,
    orderId: outfit?.orderId,
    userId: triggeredBy,
    timestamp: Date.now(),
  });
}

// ─── TRIGGER: Designer Assigned ─────────────────────────────────────────────
// DRAFT → DESIGN_IN_PROGRESS

export async function onDesignerAssigned(outfitId: string, designerId: string) {
  const [outfit] = await db.select({ status: outfits.status }).from(outfits).where(eq(outfits.id, outfitId));
  if (outfit?.status === "DRAFT") {
    await advanceStatus(outfitId, "DESIGN_IN_PROGRESS", designerId, "Designer assigned");
  }
}

// ─── TRIGGER: First Measurement Saved ───────────────────────────────────────
// DESIGN_IN_PROGRESS → WAITING_FOR_REFERENCES

export async function onMeasurementSaved(outfitId: string, userId: string) {
  const [outfit] = await db.select({ status: outfits.status }).from(outfits).where(eq(outfits.id, outfitId));
  if (outfit?.status === "DESIGN_IN_PROGRESS") {
    await advanceStatus(outfitId, "WAITING_FOR_REFERENCES", userId, "Measurement recorded");
  }
}

// ─── TRIGGER: References Locked ─────────────────────────────────────────────
// WAITING_FOR_REFERENCES → PRODUCTION_READY

export async function onReferencesLocked(outfitId: string, userId: string) {
  const [outfit] = await db.select({ status: outfits.status }).from(outfits).where(eq(outfits.id, outfitId));
  if (outfit?.status === "WAITING_FOR_REFERENCES") {
    await advanceStatus(outfitId, "PRODUCTION_READY", userId, "References locked");
  }
}

// ─── TRIGGER: Master Assigned ───────────────────────────────────────────────
// PRODUCTION_READY → PATTERN_DRAFTING

export async function onMasterAssigned(outfitId: string, masterId: string) {
  const [outfit] = await db.select({ status: outfits.status }).from(outfits).where(eq(outfits.id, outfitId));
  // Only advance if outfit is ready for production
  if (outfit?.status === "PRODUCTION_READY" || outfit?.status === "WAITING_FOR_DEPENDENCIES") {
    if (outfit.status === "PRODUCTION_READY") {
      await advanceStatus(outfitId, "PATTERN_DRAFTING", masterId, "Master assigned");
    }
  }
}

// ─── TRIGGER: Blocker Raised ────────────────────────────────────────────────
// Any production status → WAITING_FOR_DEPENDENCIES (saves previous status)

export async function onBlockerRaised(outfitId: string, userId: string) {
  const [outfit] = await db.select({ status: outfits.status }).from(outfits).where(eq(outfits.id, outfitId));
  // Only interrupt if in production-related status
  const interruptable = ["PRODUCTION_READY", "PATTERN_DRAFTING", "MAGGAM_WORK", "FABRIC_CUTTING", "STITCHING"];
  if (outfit && interruptable.includes(outfit.status)) {
    await advanceStatus(outfitId, "WAITING_FOR_DEPENDENCIES", userId, "Blocker raised");
  }
}

// ─── TRIGGER: All Blockers Resolved ─────────────────────────────────────────
// WAITING_FOR_DEPENDENCIES → PRODUCTION_READY

export async function onAllBlockersResolved(outfitId: string, userId: string) {
  const [outfit] = await db.select({ status: outfits.status }).from(outfits).where(eq(outfits.id, outfitId));
  if (outfit?.status === "WAITING_FOR_DEPENDENCIES") {
    await advanceStatus(outfitId, "PRODUCTION_READY", userId, "All blockers resolved");
  }
}

// ─── TRIGGER: Trial Date Set ────────────────────────────────────────────────
// PRODUCTION_COMPLETED → TRIAL

export async function onTrialDateSet(outfitId: string, userId: string) {
  const [outfit] = await db.select({ status: outfits.status }).from(outfits).where(eq(outfits.id, outfitId));
  if (outfit?.status === "PRODUCTION_COMPLETED") {
    await advanceStatus(outfitId, "TRIAL", userId, "Trial date scheduled");
  }
}
