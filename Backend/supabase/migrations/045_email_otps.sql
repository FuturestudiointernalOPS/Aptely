-- =============================================================================
-- 045_email_otps.sql
-- OTP codes for email verification during signup
-- =============================================================================

CREATE TABLE email_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'REGISTER',
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_otps_lookup ON email_otps(email, purpose, used_at, expires_at);

-- Auto-purge expired/used codes older than 1 hour (via cron or cleanup job)
