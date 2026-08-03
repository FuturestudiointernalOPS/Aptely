-- Migration 084: Add expires_at to offers for auto-expiry cron
-- The cron job in index.ts checks expires_at to auto-expire SENT offers

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_offers_expires_at
  ON offers(expires_at)
  WHERE status = 'SENT' AND expires_at IS NOT NULL;
