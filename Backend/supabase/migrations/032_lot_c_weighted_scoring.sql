-- 032_lot_c_weighted_scoring.sql
-- Sprint 2 Lot C: multi-interviewer scoring + weighted summary

CREATE TABLE IF NOT EXISTS public.interview_interviewer_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  interviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  global_score_over_10 numeric(4,2) NOT NULL CHECK (global_score_over_10 >= 0 AND global_score_over_10 <= 10),
  criteria_scores_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_interviewer_scores_unique UNIQUE (interview_id, interviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_interviewer_scores_interview
  ON public.interview_interviewer_scores(interview_id);

CREATE INDEX IF NOT EXISTS idx_interview_interviewer_scores_interviewer
  ON public.interview_interviewer_scores(interviewer_id);

CREATE TABLE IF NOT EXISTS public.interview_score_summaries (
  interview_id uuid PRIMARY KEY REFERENCES public.interviews(id) ON DELETE CASCADE,
  weighted_score_over_10 numeric(5,2) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.interview_interviewer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_score_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interview_interviewer_scores_select_scope ON public.interview_interviewer_scores;
DROP POLICY IF EXISTS interview_interviewer_scores_insert_scope ON public.interview_interviewer_scores;
DROP POLICY IF EXISTS interview_score_summaries_select_scope ON public.interview_score_summaries;
DROP POLICY IF EXISTS interview_score_summaries_upsert_scope ON public.interview_score_summaries;

CREATE POLICY interview_interviewer_scores_select_scope
  ON public.interview_interviewer_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_interviewer_scores.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_interviewer_scores_insert_scope
  ON public.interview_interviewer_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_interviewer_scores.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_score_summaries_select_scope
  ON public.interview_score_summaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_score_summaries.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_score_summaries_upsert_scope
  ON public.interview_score_summaries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_score_summaries.interview_id
        AND is_institution_member(r.institution_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_score_summaries.interview_id
        AND is_institution_member(r.institution_id)
    )
  );
