-- Master Database Migration: 0001
-- Creates all tables required for multi-tenant studio management.
-- Idempotent — safe to run multiple times.

-- ─── ENUMS (idempotent) ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE studio_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM ('trial', 'basic', 'premium', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cloudinary_account_type AS ENUM ('shared', 'own');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dns_record_type AS ENUM ('CNAME', 'A', 'TXT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('super_admin', 'support', 'billing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── STUDIOS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studios (
  id                         VARCHAR(20)  PRIMARY KEY,
  domain                     TEXT         NOT NULL UNIQUE,
  database_name              TEXT         NOT NULL UNIQUE,
  status                     studio_status NOT NULL DEFAULT 'trial',
  brand_name                 TEXT         NOT NULL,
  logo_url                   TEXT,
  favicon_url                TEXT,
  primary_color              VARCHAR(7),
  secondary_color            VARCHAR(7),
  custom_css                 TEXT,
  business_name              TEXT,
  business_email             TEXT UNIQUE,
  business_phone             TEXT,
  business_address           TEXT,
  timezone                   TEXT         NOT NULL DEFAULT 'Asia/Kolkata',
  currency                   VARCHAR(3)   NOT NULL DEFAULT 'INR',
  plan_type                  plan_type    NOT NULL DEFAULT 'trial',
  trial_ends_at              TIMESTAMP,
  stripe_customer_id         TEXT,
  stripe_subscription_id     TEXT,
  subscription_status        TEXT,
  cloudinary_account_type    cloudinary_account_type NOT NULL DEFAULT 'shared',
  cloudinary_cloud_name      TEXT,
  cloudinary_api_key         TEXT,
  cloudinary_api_secret      TEXT,
  database_account_type      cloudinary_account_type NOT NULL DEFAULT 'shared',
  database_url               TEXT,   -- AES-256 encrypted connection string
  dns_verified               BOOLEAN      NOT NULL DEFAULT FALSE,
  dns_verified_at            TIMESTAMP,
  ssl_status                 TEXT         NOT NULL DEFAULT 'pending',
  features                   JSONB        NOT NULL DEFAULT '{"whatsappIntegration": false, "instagramFeed": false, "customerPortal": true, "aiMeasurements": false, "customReports": false}',
  created_at                 TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMP    NOT NULL DEFAULT NOW(),
  suspended_at               TIMESTAMP,
  suspend_reason             TEXT
);

CREATE INDEX IF NOT EXISTS idx_studios_domain ON studios (domain);
CREATE INDEX IF NOT EXISTS idx_studios_status ON studios (status);
CREATE INDEX IF NOT EXISTS idx_studios_plan ON studios (plan_type);

-- ─── ADMIN USERS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id          VARCHAR(20)  PRIMARY KEY,
  email       TEXT         NOT NULL UNIQUE,
  password    TEXT         NOT NULL,
  name        TEXT         NOT NULL,
  role        admin_role   NOT NULL DEFAULT 'support',
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── DNS RECORDS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dns_records (
  id            VARCHAR(20)      PRIMARY KEY,
  studio_id     VARCHAR(20)      NOT NULL REFERENCES studios (id) ON DELETE CASCADE,
  domain        TEXT             NOT NULL,
  record_type   dns_record_type  NOT NULL,
  record_name   TEXT             NOT NULL,
  record_value  TEXT             NOT NULL,
  verified_at   TIMESTAMP,
  created_at    TIMESTAMP        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dns_records_studio ON dns_records (studio_id);

-- ─── STUDIO USAGE ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_usage (
  id               VARCHAR(20)    PRIMARY KEY,
  studio_id        VARCHAR(20)    NOT NULL REFERENCES studios (id) ON DELETE CASCADE,
  metric_date      TEXT           NOT NULL,
  total_customers  INTEGER        DEFAULT 0,
  total_orders     INTEGER        DEFAULT 0,
  total_outfits    INTEGER        DEFAULT 0,
  storage_used_mb  DECIMAL(10,2)  DEFAULT 0,
  api_calls        INTEGER        DEFAULT 0,
  created_at       TIMESTAMP      NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, metric_date)
);

-- ─── MASTER AUDIT LOGS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS master_audit_logs (
  id           VARCHAR(20)  PRIMARY KEY,
  studio_id    VARCHAR(20)  REFERENCES studios (id) ON DELETE SET NULL,
  admin_id     VARCHAR(20)  REFERENCES admin_users (id) ON DELETE SET NULL,
  action       TEXT         NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  details      JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_audit_studio ON master_audit_logs (studio_id);
CREATE INDEX IF NOT EXISTS idx_master_audit_action ON master_audit_logs (action);
