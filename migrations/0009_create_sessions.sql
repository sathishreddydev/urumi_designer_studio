-- Persist login sessions so administrators can revoke individual devices.
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" varchar(20) PRIMARY KEY,
  "user_id" varchar(20) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "device_name" text NOT NULL,
  "user_agent" text,
  "ip_address" text,
  "last_active_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions"("user_id");