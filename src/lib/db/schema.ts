import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";

// ─── ENUMS ──────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["ADMIN", "RECEPTION", "DESIGNER", "MASTER"]);

export const outfitStatusEnum = pgEnum("outfit_status", [
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
]);

export const referenceTypeEnum = pgEnum("reference_type", ["PATTERN", "MAGGAM", "FABRIC"]);

export const referenceStatusEnum = pgEnum("reference_status", ["DRAFT", "SELECTED", "LOCKED"]);

export const dependencyTypeEnum = pgEnum("dependency_type", [
  "FABRIC",
  "LINING",
  "DYEING",
  "ACCESSORIES",
  "STONES",
  "CANVAS",
  "CUPS",
]);

export const dependencyStatusEnum = pgEnum("dependency_status", ["PENDING", "AVAILABLE", "BLOCKED"]);

export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "CARD", "UPI", "BANK_TRANSFER"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "SETTLED", "FAILED", "REFUNDED"]);

// ─── TABLES ─────────────────────────────────────────────────────────────────
// IDs are generated in application code using short alphanumeric strings.
// The $defaultFn runs at insert time in the app (not in the DB).

import { generatePrefixedId } from "../id";

export const users = pgTable("users", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("usr")),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("RECEPTION"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("ses")),
  userId: varchar("user_id", { length: 20 }).references(() => users.id).notNull(),
  deviceName: text("device_name").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("cst")),
  name: text("name").notNull(),
  mobile: text("mobile").notNull().unique(),
  whatsapp: text("whatsapp"),
  email: text("email"),
  address: text("address"),
  occasion: text("occasion"),
  notes: text("notes"),
  portalToken: text("portal_token").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("ord")),
  orderNumber: text("order_number").notNull().unique(),
  customerId: varchar("customer_id", { length: 20 }).references(() => customers.id).notNull(),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  deliveryDate: timestamp("delivery_date"),
  trialDate: timestamp("trial_date"),
  estimatedAmount: decimal("estimated_amount", { precision: 10, scale: 2 }),
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const outfits = pgTable("outfits", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("otf")),
  orderId: varchar("order_id", { length: 20 }).references(() => orders.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  occasion: text("occasion"),
  price: decimal("price", { precision: 10, scale: 2 }),
  priority: integer("priority").notNull().default(0),
  deliveryDate: timestamp("delivery_date"),
  trialDate: timestamp("trial_date"),
  status: outfitStatusEnum("status").notNull().default("DRAFT"),
  designerNotes: text("designer_notes"),
  specialInstructions: text("special_instructions"),
  trialNotes: text("trial_notes"),
  alterationNotes: text("alteration_notes"),
  maggamRequired: boolean("maggam_required").notNull().default(false),
  designerId: varchar("designer_id", { length: 20 }).references(() => users.id),
  masterId: varchar("master_id", { length: 20 }).references(() => users.id),
  // Snapshot of the customer's body measurements at outfit-creation time.
  // NULL means "no snapshot yet" — falls back to the customer's latest version.
  measurementSnapshotId: varchar("measurement_snapshot_id", { length: 20 }),
  // Garment-specific measurements stored directly on the outfit
  // (e.g. Front Length, Neck Front, Sleeve Round — fields that vary by garment type).
  garmentMeasurements: jsonb("garment_measurements").$type<Record<string, string>>(),
  // Voice notes — array of { id, url, label, createdAt } recorded on the outfit
  voiceNotes: jsonb("voice_notes").$type<{ id: string; url: string; label: string; createdAt: string }[]>(),
  // Add-ons — sourced/external items attached to this outfit (e.g. dupatta, lining)
  // Each item has its own price and does NOT go through the production workflow.
  addOns: jsonb("add_ons").$type<{ id: string; name: string; price: number; notes?: string }[]>(),
  // Actual timestamps stamped automatically on status transition.
  // *Date fields = planned dates set by staff; *At fields = actual event timestamps.
  trialedAt: timestamp("trialed_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Customer-level measurements (body measurements versioned per customer)
export const customerMeasurements = pgTable("customer_measurements", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("cms")),
  customerId: varchar("customer_id", { length: 20 }).references(() => customers.id).notNull(),
  template: text("template"),
  values: json("values").notNull().$type<Record<string, string>>(),
  version: integer("version").notNull().default(1),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 20 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const measurementTemplates = pgTable("measurement_templates", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("tpl")),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  fields: json("fields").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referenceImages = pgTable("reference_images", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("ref")),
  outfitId: varchar("outfit_id", { length: 20 }).references(() => outfits.id).notNull(),
  type: referenceTypeEnum("type").notNull(),
  status: referenceStatusEnum("status").notNull().default("DRAFT"),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  isCustomerUpload: boolean("is_customer_upload").notNull().default(false),
  isWorkPhoto: boolean("is_work_photo").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dependencies = pgTable("dependencies", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("dep")),
  outfitId: varchar("outfit_id", { length: 20 }).references(() => outfits.id).notNull(),
  type: dependencyTypeEnum("type").notNull(),
  status: dependencyStatusEnum("status").notNull().default("PENDING"),
  notes: text("notes"),
  raisedBy: varchar("raised_by", { length: 20 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("pay")),
  orderId: varchar("order_id", { length: 20 }).references(() => orders.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("SETTLED"),
  transactionRef: text("transaction_ref"),
  outfitId: varchar("outfit_id", { length: 20 }).references(() => outfits.id),
  // invoiceId FK added after invoices table is defined — see bottom of file
  invoiceId: varchar("invoice_id", { length: 20 }),
  customerId: varchar("customer_id", { length: 20 }).references(() => customers.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("inv")),
  orderId: varchar("order_id", { length: 20 }).references(() => orders.id).notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("DRAFT"),
  pdfUrl: text("pdf_url"),
  createdBy: varchar("created_by", { length: 20 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productionLogs = pgTable("production_logs", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("log")),
  outfitId: varchar("outfit_id", { length: 20 }).references(() => outfits.id).notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 20 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("aud")),
  userId: varchar("user_id", { length: 20 }).references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: json("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── CONSULTATIONS ───────────────────────────────────────────────────────────

export type OutfitIdea = {
  id: string;
  type: string;
  notes: string;
  estimatedPrice: number | null;
  fabricSwatches: string[]; // uploaded image URLs
};

export const consultations = pgTable("consultations", {
  id: varchar("id", { length: 20 }).primaryKey().$defaultFn(() => generatePrefixedId("con")),
  customerId: varchar("customer_id", { length: 20 }).references(() => customers.id).notNull(),
  createdBy: varchar("created_by", { length: 20 }).references(() => users.id),
  status: text("status").notNull().default("draft"), // draft | converted | cancelled
  notes: text("notes"),
  estimatedAmount: decimal("estimated_amount", { precision: 10, scale: 2 }),
  convertedOrderId: varchar("converted_order_id", { length: 20 }).references(() => orders.id),
  outfitIdeas: jsonb("outfit_ideas").$type<OutfitIdea[]>().default([]),
  consultationDate: timestamp("consultation_date"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  expectedTrialDate: timestamp("expected_trial_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Outfit = typeof outfits.$inferSelect;
export type NewOutfit = typeof outfits.$inferInsert;
export type CustomerMeasurement = typeof customerMeasurements.$inferSelect;
export type ReferenceImage = typeof referenceImages.$inferSelect;
export type Dependency = typeof dependencies.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type ProductionLog = typeof productionLogs.$inferSelect;
