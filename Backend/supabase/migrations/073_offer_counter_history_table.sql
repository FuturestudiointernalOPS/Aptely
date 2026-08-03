-- =============================================================================
-- 073_offer_counter_history_table.sql
-- Phase F — Create offer_counter_history table for audit trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS offer_counter_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  counter_round INTEGER NOT NULL,
  counter_status TEXT NOT NULL,
  counter_terms JSONB,
  counter_reason TEXT,
  counter_proposed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  counter_proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  counter_responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  counter_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
