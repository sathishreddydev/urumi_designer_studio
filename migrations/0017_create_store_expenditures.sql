-- ─── expenditure_category enum ───────────────────────────────────────────────

CREATE TYPE "expenditure_category" AS ENUM (
  'RENT',
  'MATERIAL',
  'ELECTRICITY',
  'WATER',
  'EQUIPMENT',
  'MAINTENANCE',
  'TRANSPORT',
  'MARKETING',
  'MISCELLANEOUS'
);

-- ─── store_expenditures ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "store_expenditures" (
  "id"               varchar(20)              PRIMARY KEY,
  "date"             text                     NOT NULL,
  "category"         "expenditure_category"   NOT NULL,
  "custom_category"  text,
  "description"      text                     NOT NULL,
  "amount"           decimal(10,2)            NOT NULL,
  "method"           "payment_method"         NOT NULL DEFAULT 'CASH',
  "vendor"           text,
  "receipt_url"      text,
  "recorded_by"      varchar(20)              REFERENCES "users"("id"),
  "notes"            text,
  "created_at"       timestamp                NOT NULL DEFAULT now(),
  "updated_at"       timestamp                NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_expenditures_date"     ON "store_expenditures"("date");
CREATE INDEX IF NOT EXISTS "idx_expenditures_category" ON "store_expenditures"("category");
