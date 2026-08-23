-- Consultation records: pre-order discussions with customers before committing to a full order.
CREATE TABLE IF NOT EXISTS "consultations" (
  "id" varchar(20) PRIMARY KEY,
  "customer_id" varchar(20) NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "created_by" varchar(20) REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'draft',  -- 'draft' | 'converted' | 'cancelled'
  "notes" text,
  "estimated_amount" decimal(10, 2),
  "converted_order_id" varchar(20) REFERENCES "orders"("id"),
  "outfit_ideas" jsonb,  -- array of { type, notes, fabricSwatches: string[], estimatedPrice }
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_consultations_customer_id" ON "consultations"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_consultations_status" ON "consultations"("status");
