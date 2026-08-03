-- =============================================================================
-- 067_decision_recommendations.sql
-- Phase F — Recruiter recommendations before hiring decision.
-- Each row = one recruiter's recommendation (STRONG, MEDIUM, WEAK).
-- Links to applications(id). Precedes application_decisions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS decision_recommendations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  recommended_by  UUID NOT NULL REFERENCES profiles(id),
  recommendation  TEXT NOT NULL CHECK (recommendation IN ('STRONG', 'MEDIUM', 'WEAK')),
  observations    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(application_id, recommended_by)
);

CREATE INDEX IF NOT EXISTS idx_decision_rec_app ON decision_recommendations(application_id);
CREATE INDEX IF NOT EXISTS idx_decision_rec_by ON decision_recommendations(recommended_by);

ALTER TABLE decision_recommendations ENABLE ROW LEVEL SECURITY;

-- Institution members can read/write recommendations for their institution's applications.
CREATE POLICY decision_recommendations_institution_member ON decision_recommendations
  FOR ALL USING (
    application_id IN (
      SELECT a.id FROM applications a
      JOIN roles r ON r.id = a.role_id
      JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
        AND im.status IN ('OWNER','ADMIN','ACTIVE')
    )
  );
