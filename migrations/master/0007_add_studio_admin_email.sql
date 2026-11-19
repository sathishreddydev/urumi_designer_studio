-- Stores the admin email that was seeded into the studio's tenant DB.
-- This is informational only — credentials live in the tenant DB, not here.
ALTER TABLE tenant_registry_studios
  ADD COLUMN IF NOT EXISTS admin_email text;
