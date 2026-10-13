-- =============================================================================
-- 141_email_otps_code_salt.sql
-- Per-code salt for signup OTP hashes.
-- The stored value is now SHA-256 of "<salt>:<code>" instead of a bare SHA-256
-- of the code, so an attacker who reads the table cannot brute-force the small
-- 6-digit space offline without the secret salt.
-- =============================================================================

ALTER TABLE email_otps
  ADD COLUMN IF NOT EXISTS code_salt TEXT;

-- Legacy codes were hashed without a salt and cannot be verified under the new
-- scheme; burn any still-outstanding ones so users simply re-request a code.
UPDATE email_otps
  SET used_at = NOW()
  WHERE purpose = 'REGISTER' AND used_at IS NULL;

-- Backfill the remaining (already used/expired) rows so the column can be NOT NULL.
UPDATE email_otps
  SET code_salt = gen_random_uuid()::text
  WHERE code_salt IS NULL;

ALTER TABLE email_otps
  ALTER COLUMN code_salt SET NOT NULL;

COMMENT ON COLUMN email_otps.code_salt IS 'Per-code salt; code_hash is SHA-256 of "<salt>:<code>".';
