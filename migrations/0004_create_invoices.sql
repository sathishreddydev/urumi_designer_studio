-- Create invoices table
BEGIN;

CREATE TABLE IF NOT EXISTS invoices (
  id varchar(20) PRIMARY KEY,
  order_id varchar(20) NOT NULL,
  invoice_number text NOT NULL UNIQUE,
  issued_at timestamp NOT NULL DEFAULT now(),
  due_date timestamp,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT',
  pdf_url text,
  created_by varchar(20),
  created_at timestamp NOT NULL DEFAULT now()
);

COMMIT;
