-- Migration: Add customer_measurements table
-- Moves measurements from per-outfit to per-customer level

CREATE TABLE IF NOT EXISTS "customer_measurements" (
  "id" varchar(20) PRIMARY KEY,
  "customer_id" varchar(20) NOT NULL REFERENCES "customers"("id"),
  "template" text,
  "values" json NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "notes" text,
  "created_by" varchar(20) REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Index for fast lookups by customer
CREATE INDEX IF NOT EXISTS "idx_customer_measurements_customer_id" ON "customer_measurements"("customer_id");

-- Optional: Migrate existing outfit measurements to customer measurements
-- This copies the latest measurement per customer (via outfit → order → customer)
-- Run this only once after the table is created:
--
-- INSERT INTO customer_measurements (id, customer_id, template, values, version, created_at)
-- SELECT DISTINCT ON (c.id)
--   'cms' || substr(md5(random()::text), 1, 12),
--   c.id,
--   m.template,
--   m.values,
--   1,
--   m.created_at
-- FROM measurements m
-- JOIN outfits o ON o.id = m.outfit_id
-- JOIN orders ord ON ord.id = o.order_id
-- JOIN customers c ON c.id = ord.customer_id
-- ORDER BY c.id, m.version DESC;
