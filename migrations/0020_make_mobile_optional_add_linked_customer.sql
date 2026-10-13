-- Migration: make mobile optional + add linkedCustomerId
-- mobile: drop NOT NULL, keep UNIQUE (nullable columns can have multiple NULLs in Postgres)
ALTER TABLE customers ALTER COLUMN mobile DROP NOT NULL;

-- Add linkedCustomerId FK (self-referencing, optional)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS linked_customer_id VARCHAR(20) REFERENCES customers(id);
