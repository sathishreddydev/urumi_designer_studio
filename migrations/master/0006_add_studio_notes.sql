ALTER TABLE tenant_registry_studios
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
