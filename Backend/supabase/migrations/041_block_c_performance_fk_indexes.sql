-- =============================================================================
-- 041_block_c_performance_fk_indexes.sql
-- Bloc C (performance): add missing covering indexes for foreign keys
-- Safe change: no business logic or RLS behavior modification
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_interview_guides_created_by
  ON public.interview_guides (created_by);

CREATE INDEX IF NOT EXISTS idx_interviews_created_by
  ON public.interviews (created_by);

CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_template_id
  ON public.onboarding_checklists (template_id);

CREATE INDEX IF NOT EXISTS idx_scorecard_audit_logs_actor_id
  ON public.scorecard_audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_scorecard_templates_created_by
  ON public.scorecard_templates (created_by);
