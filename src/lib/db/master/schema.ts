/**
 * Master Database Schema
 * This database stores metadata about ALL studios (tenants).
 * Each studio has its own separate database for business data.
 */

import {
  pgTable,
  pgEnum,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  decimal,
  integer,
} from "drizzle-orm/pg-core";
import { generatePrefixedId } from "@/lib/id";

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const studioStatusEnum = pgEnum("studio_status", [
  "trial",
  "active",
  "suspended",
  "cancelled",
]);

export const planTypeEnum = pgEnum("plan_type", [
  "trial",
  "basic",
  "premium",
  "enterprise",
]);

export const cloudinaryAccountTypeEnum = pgEnum("cloudinary_account_type", [
  "shared",  // Uses platform's Cloudinary account
  "own",     // Customer's own Cloudinary account
]);

export const dnsRecordTypeEnum = pgEnum("dns_record_type", [
  "CNAME",
  "A",
  "TXT",
]);

export const adminRoleEnum = pgEnum("admin_role", [
  "super_admin",
  "support",
  "billing",
]);

// ─── TABLES ──────────────────────────────────────────────────────────────────

/**
 * studios - One row per customer/tenant
 * This is the core table that maps domains to databases.
 */
export const studios = pgTable("studios", {
  id: varchar("id", { length: 20 })
    .primaryKey()
    .$defaultFn(() => generatePrefixedId("stu")),

  // Domain mapping
  domain: text("domain").notNull().unique(), // designer.elitestudio.com

  // Tenant database
  databaseName: text("database_name").notNull().unique(), // studio_abc123_db

  // Status
  status: studioStatusEnum("status").notNull().default("trial"),

  // Branding
  brandName: text("brand_name").notNull(),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: varchar("primary_color", { length: 7 }), // #FF69B4
  secondaryColor: varchar("secondary_color", { length: 7 }),
  customCss: text("custom_css"), // Premium only

  // Business info
  businessName: text("business_name"),
  businessEmail: text("business_email").unique(),
  businessPhone: text("business_phone"),
  businessAddress: text("business_address"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),

  // Subscription
  planType: planTypeEnum("plan_type").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, past_due, cancelled

  // Cloudinary (file storage)
  cloudinaryAccountType: cloudinaryAccountTypeEnum("cloudinary_account_type")
    .notNull()
    .default("shared"),
  cloudinaryCloudName: text("cloudinary_cloud_name"),
  cloudinaryApiKey: text("cloudinary_api_key"),
  cloudinaryApiSecret: text("cloudinary_api_secret"), // AES-256 encrypted

  // Database (BYODB — Bring Your Own Database, same pattern as Cloudinary)
  // "shared" = use platform's DATABASE_URL
  // "own"   = customer provides their own PostgreSQL connection string
  databaseAccountType: cloudinaryAccountTypeEnum("database_account_type")
    .notNull()
    .default("shared"),
  databaseUrl: text("database_url"), // AES-256 encrypted full connection string

  // DNS & SSL
  dnsVerified: boolean("dns_verified").notNull().default(false),
  dnsVerifiedAt: timestamp("dns_verified_at"),
  sslStatus: text("ssl_status").notNull().default("pending"), // pending, active, failed

  // Feature flags (per studio toggles)
  features: jsonb("features")
    .$type<{
      whatsappIntegration?: boolean;
      instagramFeed?: boolean;
      customerPortal?: boolean;
      aiMeasurements?: boolean;
      customReports?: boolean;
    }>()
    .notNull()
    .default({
      whatsappIntegration: false,
      instagramFeed: false,
      customerPortal: true,
      aiMeasurements: false,
      customReports: false,
    }),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  suspendedAt: timestamp("suspended_at"),
  suspendReason: text("suspend_reason"),
});

/**
 * admin_users - Super admin accounts (manage all studios)
 * Separate from studio user accounts.
 */
export const adminUsers = pgTable("admin_users", {
  id: varchar("id", { length: 20 })
    .primaryKey()
    .$defaultFn(() => generatePrefixedId("adm")),

  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: adminRoleEnum("role").notNull().default("support"),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * dns_records - DNS verification records for each studio domain
 */
export const dnsRecords = pgTable("dns_records", {
  id: varchar("id", { length: 20 })
    .primaryKey()
    .$defaultFn(() => generatePrefixedId("dns")),

  studioId: varchar("studio_id", { length: 20 })
    .notNull()
    .references(() => studios.id),

  domain: text("domain").notNull(),
  recordType: dnsRecordTypeEnum("record_type").notNull(),
  recordName: text("record_name").notNull(),
  recordValue: text("record_value").notNull(),
  verifiedAt: timestamp("verified_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * studio_usage - Daily usage metrics per studio (for billing & monitoring)
 */
export const studioUsage = pgTable("studio_usage", {
  id: varchar("id", { length: 20 })
    .primaryKey()
    .$defaultFn(() => generatePrefixedId("usg")),

  studioId: varchar("studio_id", { length: 20 })
    .notNull()
    .references(() => studios.id),

  metricDate: text("metric_date").notNull(), // "YYYY-MM-DD"

  totalCustomers: integer("total_customers").default(0),
  totalOrders: integer("total_orders").default(0),
  totalOutfits: integer("total_outfits").default(0),
  storageUsedMb: decimal("storage_used_mb", { precision: 10, scale: 2 }).default("0"),
  apiCalls: integer("api_calls").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * master_audit_logs - Audit trail for admin actions
 */
export const masterAuditLogs = pgTable("master_audit_logs", {
  id: varchar("id", { length: 20 })
    .primaryKey()
    .$defaultFn(() => generatePrefixedId("mal")),

  studioId: varchar("studio_id", { length: 20 }).references(() => studios.id),
  adminId: varchar("admin_id", { length: 20 }).references(() => adminUsers.id),

  action: text("action").notNull(), // 'studio.created', 'studio.suspended'
  entityType: text("entity_type"),  // 'studio', 'admin_user'
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type Studio = typeof studios.$inferSelect;
export type NewStudio = typeof studios.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type DnsRecord = typeof dnsRecords.$inferSelect;
export type StudioUsage = typeof studioUsage.$inferSelect;
