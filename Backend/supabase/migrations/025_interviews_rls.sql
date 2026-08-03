-- 025_interviews_rls.sql
-- RLS policies for interviews + interviewers

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviewers ENABLE ROW LEVEL SECURITY;

-- Clean re-run safety
DROP POLICY IF EXISTS interviews_select_scope ON public.interviews;
DROP POLICY IF EXISTS interviews_hr_insert ON public.interviews;
DROP POLICY IF EXISTS interviews_hr_update ON public.interviews;
DROP POLICY IF EXISTS interviews_hr_delete ON public.interviews;

DROP POLICY IF EXISTS interviewers_select_scope ON public.interviewers;
DROP POLICY IF EXISTS interviewers_hr_manage ON public.interviewers;

-- Interviews visibility:
-- 1) HR members of role institution
-- 2) Candidate owner of linked application
-- 3) Assigned interviewer
CREATE POLICY interviews_select_scope
  ON public.interviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.roles r ON r.id = a.role_id
      WHERE a.id = interviews.application_id
        AND is_institution_member(r.institution_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.id = interviews.application_id
        AND a.candidate_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.interviewers i
      WHERE i.interview_id = interviews.id
        AND i.user_id = auth.uid()
    )
  );

-- HR institution can create/update/delete interview
CREATE POLICY interviews_hr_insert
  ON public.interviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.roles r ON r.id = a.role_id
      WHERE a.id = interviews.application_id
        AND is_institution_member(r.institution_id)
    )
    AND created_by = auth.uid()
  );

CREATE POLICY interviews_hr_update
  ON public.interviews
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.roles r ON r.id = a.role_id
      WHERE a.id = interviews.application_id
        AND is_institution_member(r.institution_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.roles r ON r.id = a.role_id
      WHERE a.id = interviews.application_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interviews_hr_delete
  ON public.interviews
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.roles r ON r.id = a.role_id
      WHERE a.id = interviews.application_id
        AND is_institution_member(r.institution_id)
    )
  );

-- Interviewers visibility:
-- 1) HR members of linked role institution
-- 2) Candidate owner of linked application
-- 3) interviewer row owner
CREATE POLICY interviewers_select_scope
  ON public.interviewers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interviewers.interview_id
        AND is_institution_member(r.institution_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      WHERE it.id = interviewers.interview_id
        AND a.candidate_id = auth.uid()
    )
    OR interviewers.user_id = auth.uid()
  );

-- HR institution manages interviewer assignment
CREATE POLICY interviewers_hr_manage
  ON public.interviewers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interviewers.interview_id
        AND is_institution_member(r.institution_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interviewers.interview_id
        AND is_institution_member(r.institution_id)
    )
  );
