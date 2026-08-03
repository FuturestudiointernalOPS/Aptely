-- 028_interview_guides.sql
-- AI-generated interview guides with version history

CREATE TABLE IF NOT EXISTS public.interview_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  version int NOT NULL CHECK (version > 0),
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_guides_interview_version_unique UNIQUE (interview_id, version)
);

CREATE INDEX IF NOT EXISTS idx_interview_guides_interview_version
  ON public.interview_guides(interview_id, version DESC);

ALTER TABLE public.interview_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interview_guides_select_scope ON public.interview_guides;
DROP POLICY IF EXISTS interview_guides_insert_scope ON public.interview_guides;

CREATE POLICY interview_guides_select_scope
  ON public.interview_guides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_guides.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_guides_insert_scope
  ON public.interview_guides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_guides.interview_id
        AND is_institution_member(r.institution_id)
    )
  );
