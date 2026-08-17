import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "reception",
  "designer",
  "master",
]);

export const outfitStatusEnum = pgEnum("outfit_status", [
  "draft",
  "design_in_progress",
  "waiting_for_references",
  "waiting_for_dependencies",
  "production_ready",
  "pattern_drafting",
  "maggam_work",
  "fabric_cutting",
  "stitching",
  "production_completed",
  "trial",
  "alteration",
  "qc",
  "ready_for_delivery",
  "delivered",
]);

export const referenceTypeEnum = pgEnum("reference_type", [
  "PATTERN",
  "MAGGAM",
  "FABRIC",
]);

export const referenceStatusEnum = pgEnum("reference_status", [
  "draft",
  "selected",
  "locked",
]);

export const dependencyTypeEnum = pgEnum("dependency_type", [
  "fabric",
  "lining",
  "dyeing",
  "accessories",
  "stones",
  "canvas",
  "cups",
  "other",
]);

export const dependencyStatusEnum = pgEnum("dependency_status", [
  "pending",
  "available",
  "blocked",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "upi",
  "bank_transfer",
]);
