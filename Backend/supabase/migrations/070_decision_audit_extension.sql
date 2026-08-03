-- =============================================================================
-- 070_decision_audit_extension.sql
-- Phase F — Add role tracking to application_decisions for audit trail.
-- Captures decided_by_role and ratified_by_role for compliance.
-- =============================================================================

ALTER TABLE application_decisions
  ADD COLUMN IF NOT EXISTS decided_by_role TEXT;

COMMENT ON COLUMN application_decisions.decided_by_role IS 'Role of actor at time of decision (RECRUITER, HR_LEAD, HIRING_MANAGER, OWNER)';

ALTER TABLE application_decisions
  ADD COLUMN IF NOT EXISTS ratified_by_role TEXT;

COMMENT ON COLUMN application_decisions.ratified_by_role IS 'Role of ratifier — NULL unless decision was ratified';

CREATE INDEX IF NOT EXISTS idx_app_decisions_decided_role
  ON application_decisions(decided_by_role)
  WHERE decided_by_role IS NOT NULL;
