-- =============================================================================
-- 076_decision_ratifications.sql
-- Phase F — Owner/HR ratification table for high-value hiring decisions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS decision_ratifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  decision_id     UUID NOT NULL REFERENCES application_decisions(id) ON DELETE CASCADE,
  ratified_by     UUID NOT NULL REFERENCES profiles(id),
  ratified_by_role TEXT,
  status          TEXT NOT NULL CHECK (status IN ('APPROVED', 'REJECTED', 'PENDING')) DEFAULT 'PENDING',
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(decision_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_ratif_app    ON decision_ratifications(application_id);
CREATE INDEX IF NOT EXISTS idx_decision_ratif_dec    ON decision_ratifications(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_ratif_status ON decision_ratifications(status);

ALTER TABLE decision_ratifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_ratifications_institution_member ON decision_ratifications
  FOR ALL USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN roles r ON r.id = a.role_id
      JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
        AND im.status IN ('OWNER','ADMIN','ACTIVE')
    )
  );
