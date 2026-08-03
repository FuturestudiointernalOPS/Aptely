-- =============================================================================
-- 073_offer_counter_support.sql
-- Phase F — Add counter-offer tracking columns to offers table
-- Enables two-way negotiation: candidate proposes → HR approves/rejects
-- =============================================================================

ALTER TABLE offers ADD COLUMN IF NOT EXISTS counter_round INTEGER DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS counter_status TEXT DEFAULT NULL CHECK (counter_status IN ('PENDING', 'APPROVED', 'REJECTED', NULL));
ALTER TABLE offers ADD COLUMN IF NOT EXISTS counter_terms JSONB DEFAULT NULL;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS counter_reason TEXT DEFAULT NULL CHECK (CHAR_LENGTH(counter_reason) <= 2000);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS counter_responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS counter_responded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_offers_counter_status ON offers(counter_status) WHERE counter_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_counter_round ON offers(counter_round) WHERE counter_round > 0;

-- Denormalization: link offer_counter_history.id for quick lookup
ALTER TABLE offers ADD COLUMN IF NOT EXISTS latest_counter_id UUID REFERENCES offer_counter_history(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_offers_latest_counter ON offers(latest_counter_id) WHERE latest_counter_id IS NOT NULL;
