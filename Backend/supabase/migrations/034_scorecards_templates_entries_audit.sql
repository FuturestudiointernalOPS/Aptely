-- 034_scorecards_templates_entries_audit.sql
-- Interview scorecards v2: templates, criteria, entries, audit log, frozen snapshot

-- ---------------------------------------------------------------------------
-- Template models (linked to role/job post)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scorecard_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scorecard_templates_role_id
  ON public.scorecard_templates(role_id);

CREATE INDEX IF NOT EXISTS idx_scorecard_templates_role_active
  ON public.scorecard_templates(role_id, is_active);

CREATE TABLE IF NOT EXISTS public.scorecard_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.scorecard_templates(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  label text NOT NULL,
  weight numeric(6,2),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scorecard_criteria_template_key_unique UNIQUE (template_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_scorecard_criteria_template
  ON public.scorecard_criteria(template_id, position);

-- ---------------------------------------------------------------------------
-- Freeze template snapshot on interview planning
-- ---------------------------------------------------------------------------

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS scorecard_template_snapshot_json jsonb,
  ADD COLUMN IF NOT EXISTS scorecard_template_frozen_at timestamptz;

-- ---------------------------------------------------------------------------
-- InterviewScorecard model (extend existing table)
-- ---------------------------------------------------------------------------

ALTER TABLE public.interview_scorecards
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS template_snapshot_json jsonb,
  ADD COLUMN IF NOT EXISTS is_modified_after_submit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_modified_after_submit_at timestamptz;

ALTER TABLE public.interview_scorecards
  ALTER COLUMN submitted_at DROP NOT NULL,
  ALTER COLUMN submitted_at DROP DEFAULT,
  ALTER COLUMN global_score DROP NOT NULL,
  ALTER COLUMN recommendation DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'interview_scorecards_status_check'
      AND conrelid = 'public.interview_scorecards'::regclass
  ) THEN
    ALTER TABLE public.interview_scorecards
      ADD CONSTRAINT interview_scorecards_status_check
      CHECK (status IN ('DRAFT', 'SUBMITTED', 'ARCHIVED'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_interview_scorecards_status
  ON public.interview_scorecards(interview_id, status);

CREATE INDEX IF NOT EXISTS idx_interview_scorecards_reviewer
  ON public.interview_scorecards(reviewer_id);

-- ---------------------------------------------------------------------------
-- ScorecardEntry model
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scorecard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id uuid NOT NULL REFERENCES public.interview_scorecards(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  criterion_label text NOT NULL,
  weight numeric(6,2),
  score numeric(4,2),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scorecard_entries_scorecard_criterion_unique UNIQUE (scorecard_id, criterion_key),
  CONSTRAINT scorecard_entries_score_check CHECK (score IS NULL OR (score >= 1 AND score <= 5))
);

CREATE INDEX IF NOT EXISTS idx_scorecard_entries_scorecard
  ON public.scorecard_entries(scorecard_id);

-- ---------------------------------------------------------------------------
-- ScorecardAuditLog model
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scorecard_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id uuid NOT NULL REFERENCES public.interview_scorecards(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  field_path text NOT NULL,
  old_value_json jsonb,
  new_value_json jsonb,
  event_type text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scorecard_audit_logs_event_type_check CHECK (
    event_type IN ('UPDATE_AFTER_SUBMIT', 'STATUS_CHANGE', 'ARCHIVE')
  )
);

CREATE INDEX IF NOT EXISTS idx_scorecard_audit_logs_scorecard
  ON public.scorecard_audit_logs(scorecard_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.scorecard_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scorecard_templates_select_scope ON public.scorecard_templates;
DROP POLICY IF EXISTS scorecard_templates_manage_scope ON public.scorecard_templates;
DROP POLICY IF EXISTS scorecard_criteria_select_scope ON public.scorecard_criteria;
DROP POLICY IF EXISTS scorecard_criteria_manage_scope ON public.scorecard_criteria;
DROP POLICY IF EXISTS scorecard_entries_select_scope ON public.scorecard_entries;
DROP POLICY IF EXISTS scorecard_entries_manage_scope ON public.scorecard_entries;
DROP POLICY IF EXISTS scorecard_audit_logs_select_scope ON public.scorecard_audit_logs;
DROP POLICY IF EXISTS scorecard_audit_logs_insert_scope ON public.scorecard_audit_logs;

CREATE POLICY scorecard_templates_select_scope
  ON public.scorecard_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = scorecard_templates.role_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY scorecard_templates_manage_scope
  ON public.scorecard_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = scorecard_templates.role_id
        AND is_institution_member(r.institution_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = scorecard_templates.role_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY scorecard_criteria_select_scope
  ON public.scorecard_criteria
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scorecard_templates st
      JOIN public.roles r ON r.id = st.role_id
      WHERE st.id = scorecard_criteria.template_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY scorecard_criteria_manage_scope
  ON public.scorecard_criteria
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.scorecard_templates st
      JOIN public.roles r ON r.id = st.role_id
      WHERE st.id = scorecard_criteria.template_id
        AND is_institution_member(r.institution_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.scorecard_templates st
      JOIN public.roles r ON r.id = st.role_id
      WHERE st.id = scorecard_criteria.template_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY scorecard_entries_select_scope
  ON public.scorecard_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_scorecards sc
      JOIN public.interviews it ON it.id = sc.interview_id
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE sc.id = scorecard_entries.scorecard_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY scorecard_entries_manage_scope
  ON public.scorecard_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_scorecards sc
      WHERE sc.id = scorecard_entries.scorecard_id
        AND sc.reviewer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interview_scorecards sc
      WHERE sc.id = scorecard_entries.scorecard_id
        AND sc.reviewer_id = auth.uid()
    )
  );

CREATE POLICY scorecard_audit_logs_select_scope
  ON public.scorecard_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interview_scorecards sc
      JOIN public.interviews it ON it.id = sc.interview_id
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE sc.id = scorecard_audit_logs.scorecard_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY scorecard_audit_logs_insert_scope
  ON public.scorecard_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());
