CREATE TABLE IF NOT EXISTS tenant_registry_studios (
  id text PRIMARY KEY,
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  logo_url text NOT NULL,
  database_url_encrypted text NOT NULL,
  cloudinary_url_encrypted text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_registry_studios_active_domain_idx
  ON tenant_registry_studios (domain)
  WHERE active = true;
