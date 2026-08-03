-- 029_interview_scorecards.sql
-- Lot C: interviewer scorecards + summary signals

CREATE TABLE IF NOT EXISTS public.interview_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
  criteria_scores_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  global_score numeric(4,2) NOT NULL CHECK (global_score >= 1 AND global_score <= 5),
  recommendation text NOT NULL CHECK (recommendation IN ('STRONG_YES', 'YES', 'MIXED', 'NO')),
  comment text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_scorecards_interview_reviewer_unique UNIQUE (interview_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_scorecards_interview_id
  ON public.interview_scorecards(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_scorecards_interview_submitted
  ON public.interview_scorecards(interview_id, submitted_at DESC);

ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interview_scorecards_select_scope ON public.interview_scorecards;
DROP POLICY IF EXISTS interview_scorecards_insert_scope ON public.interview_scorecards;

CREATE POLICY interview_scorecards_select_scope
  ON public.interview_scorecards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_scorecards.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_scorecards_insert_scope
  ON public.interview_scorecards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_scorecards.interview_id
        AND is_institution_member(r.institution_id)
    )
  );
