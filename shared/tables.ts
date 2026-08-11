import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  real,
} from "drizzle-orm/pg-core";
import * as enums from "./enums";

// ─── USERS ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  role: enums.userRoleEnum("role").notNull().default("reception"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── CUSTOMERS ─────────────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  mobile: text("mobile").unique().notNull(),
  whatsapp: text("whatsapp"),
  email: text("email"),
  address: text("address"),
  occasion: text("occasion"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── ORDERS ────────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").unique().notNull(),
  customerId: varchar("customer_id")
    .references(() => customers.id)
    .notNull(),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  deliveryDate: timestamp("delivery_date"),
  trialDate: timestamp("trial_date"),
  status: text("status").notNull().default("Active"),
  portalToken: varchar("portal_token").unique(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── OUTFITS ───────────────────────────────────────────────────────────────────
export const outfits = pgTable("outfits", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  occasion: text("occasion"),
  priority: integer("priority").notNull().default(0),
  deliveryDate: timestamp("delivery_date"),
  trialDate: timestamp("trial_date"),
  status: enums.outfitStatusEnum("status").notNull().default("draft"),
  designerNotes: text("designer_notes"),
  specialInstructions: text("special_instructions"),
  maggamRequired: boolean("maggam_required").notNull().default(false),
  designerId: varchar("designer_id").references(() => users.id),
  masterId: varchar("master_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── MEASUREMENTS ──────────────────────────────────────────────────────────────
export const measurements = pgTable("measurements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  outfitId: varchar("outfit_id")
    .references(() => outfits.id)
    .notNull(),
  template: text("template"),
  values: json("values").notNull().$type<Record<string, string>>(),
  version: integer("version").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── MEASUREMENT TEMPLATES ─────────────────────────────────────────────────────
export const measurementTemplates = pgTable("measurement_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").unique().notNull(),
  type: text("type").notNull(),
  fields: json("fields").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── REFERENCE IMAGES ──────────────────────────────────────────────────────────
export const referenceImages = pgTable("reference_images", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  outfitId: varchar("outfit_id")
    .references(() => outfits.id)
    .notNull(),
  type: enums.referenceTypeEnum("type").notNull(),
  status: enums.referenceStatusEnum("status").notNull().default("draft"),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  isCustomerUpload: boolean("is_customer_upload").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── DEPENDENCIES ──────────────────────────────────────────────────────────────
export const dependencies = pgTable("dependencies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  outfitId: varchar("outfit_id")
    .references(() => outfits.id)
    .notNull(),
  type: enums.dependencyTypeEnum("type").notNull(),
  status: enums.dependencyStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  raisedBy: varchar("raised_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── PAYMENTS ──────────────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .references(() => orders.id)
    .notNull(),
  amount: real("amount").notNull(),
  method: enums.paymentMethodEnum("method").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── PRODUCTION LOGS ───────────────────────────────────────────────────────────
export const productionLogs = pgTable("production_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  outfitId: varchar("outfit_id")
    .references(() => outfits.id)
    .notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: varchar("entity_id"),
  details: json("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
