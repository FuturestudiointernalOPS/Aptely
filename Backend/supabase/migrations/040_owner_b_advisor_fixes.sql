-- =============================================================================
-- 040_owner_b_advisor_fixes.sql
-- Targeted fixes after advisors scan (Bloc B related)
-- =============================================================================

-- ─── Foreign key covering indexes (performance) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comm_templates_institution_id
  ON communication_templates (institution_id);

CREATE INDEX IF NOT EXISTS idx_comm_logs_template_id
  ON communication_logs (template_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_task_id
  ON onboarding_documents (task_id);

-- ─── Function search_path hardening (security lint) ─────────────────────────
ALTER FUNCTION public.update_onboarding_documents_updated_at()
  SET search_path = public, pg_temp;

-- Optional consistency with existing trigger helpers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_offers_updated_at'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_offers_updated_at() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_onboarding_checklists_updated_at'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_onboarding_checklists_updated_at() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_onboarding_tasks_updated_at'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_onboarding_tasks_updated_at() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_onboarding_templates_updated_at'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.update_onboarding_templates_updated_at() SET search_path = public, pg_temp';
  END IF;
END $$;
