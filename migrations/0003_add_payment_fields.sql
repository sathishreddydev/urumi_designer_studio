-- Add payment metadata fields and payment_status enum
BEGIN;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING','SETTLED','FAILED','REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payments
  ADD COLUMN status payment_status NOT NULL DEFAULT 'SETTLED',
  ADD COLUMN transaction_ref text,
  ADD COLUMN outfit_id varchar(20),
  ADD COLUMN invoice_id varchar(20),
  ADD COLUMN customer_id varchar(20);

COMMIT;
