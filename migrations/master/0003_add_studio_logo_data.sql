ALTER TABLE tenant_registry_studios
  ADD COLUMN IF NOT EXISTS logo_data bytea;
