-- =============================================================================
-- 075_add_latest_counter_id.sql
-- Add missing latest_counter_id column to offers table
-- =============================================================================

ALTER TABLE offers ADD COLUMN IF NOT EXISTS latest_counter_id UUID REFERENCES offer_counter_history(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_offers_latest_counter ON offers(latest_counter_id) WHERE latest_counter_id IS NOT NULL;

-- Also add missing index on offer_counter_history
CREATE INDEX IF NOT EXISTS idx_offers_counter_status ON offers(counter_status) WHERE counter_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_status_counter ON offers(status) WHERE status = 'COUNTER_OFFERED';
