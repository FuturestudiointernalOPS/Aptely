-- =============================================================================
-- 140_email_otps_attempt_limit.sql
-- Track failed verification attempts on signup OTP codes.
-- The application caps this at 3; once reached the code is invalidated and the
-- user must request a new one.
-- =============================================================================

ALTER TABLE email_otps
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE email_otps
  ADD CONSTRAINT email_otps_attempts_non_negative CHECK (attempts >= 0);
