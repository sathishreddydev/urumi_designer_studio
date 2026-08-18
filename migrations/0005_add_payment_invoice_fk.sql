-- Add foreign key constraint from payments.invoice_id → invoices.id
-- Safe to run multiple times (constraint only added if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_invoice_id_fkey'
      AND table_name = 'payments'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;
