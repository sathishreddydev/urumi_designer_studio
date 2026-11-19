ALTER TABLE tenant_registry_studios
  ADD COLUMN IF NOT EXISTS favicon_data bytea;
