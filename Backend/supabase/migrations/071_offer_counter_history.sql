-- =============================================================================
-- 071_offer_counter_history.sql
-- Phase F — Full negotiation audit trail for counter-offer rounds.
-- Each row = one round of the negotiation (CANDIDATE or HR proposes a counter).
-- Links to offers(id). Complementary to offer_negotiations (which tracks status).
-- =============================================================================

CREATE TABLE IF NOT EXISTS offer_counter_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  round           INTEGER NOT NULL DEFAULT 1,
  proposed_by     TEXT NOT NULL CHECK (proposed_by IN ('CANDIDATE', 'HR')),
  counter_terms   JSONB NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  responded_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counter_history_offer   ON offer_counter_history(offer_id);
CREATE INDEX IF NOT EXISTS idx_counter_history_status  ON offer_counter_history(offer_id, status);

ALTER TABLE offer_counter_history ENABLE ROW LEVEL SECURITY;

-- Institution members of the offer's institution can read/write.
CREATE POLICY offer_counter_history_institution_member ON offer_counter_history
  FOR ALL USING (
    offer_id IN (
      SELECT o.id FROM offers o
      JOIN applications a ON a.id = o.application_id
      JOIN roles r ON r.id = a.role_id
      JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
        AND im.status IN ('OWNER','ADMIN','ACTIVE')
    )
  );
