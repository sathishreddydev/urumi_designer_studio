ALTER TABLE tenant_registry_studios
  ADD COLUMN IF NOT EXISTS deactivate_at timestamptz;
