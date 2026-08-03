-- 096_offer_signing_signature_data.sql
-- Store canvas signature image + audit metadata on signing steps

ALTER TABLE offer_signing_steps
  ADD COLUMN IF NOT EXISTS signature_data TEXT,       -- base64 PNG from canvas
  ADD COLUMN IF NOT EXISTS signed_ip     TEXT,        -- IP address at signing time
  ADD COLUMN IF NOT EXISTS signer_name   TEXT;        -- display name at signing time
