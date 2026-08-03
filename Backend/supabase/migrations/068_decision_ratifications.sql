-- =============================================================================
-- 067_decision_ratifications.sql
-- Phase F — Multi-step decision workflow (Recruiter recommends → Hiring Manager decides → HR Head ratifies).
-- =============================================================================

ALTER TABLE application_decisions
  ADD COLUMN IF NOT EXISTS decided_by_role TEXT,           -- role_specialization of the deciding user
  ADD COLUMN IF NOT EXISTS ratified_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ratified_by_role TEXT,
  ADD COLUMN IF NOT EXISTS ratified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recommendation_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommendation_role TEXT,
  ADD COLUMN IF NOT EXISTS recommendation_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_decisions_ratified ON application_decisions(ratified_at);
