-- 033_lot_d_timeline_and_reminders.sql
-- Sprint 2 Lot D: interview timeline activity feed + 24h reminder jobs

CREATE TABLE IF NOT EXISTS public.interview_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_activity_events_interview_created
  ON public.interview_activity_events(interview_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_activity_events_type
  ON public.interview_activity_events(event_type);

CREATE TABLE IF NOT EXISTS public.interview_reminder_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL,
  channel text NOT NULL CHECK (channel IN ('EMAIL', 'PUSH')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_reminder_jobs_send_status
  ON public.interview_reminder_jobs(send_at, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_reminder_jobs_idempotent
  ON public.interview_reminder_jobs(interview_id, send_at, channel);

ALTER TABLE public.interview_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_reminder_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interview_activity_events_select_scope ON public.interview_activity_events;
DROP POLICY IF EXISTS interview_activity_events_insert_scope ON public.interview_activity_events;
DROP POLICY IF EXISTS interview_reminder_jobs_select_scope ON public.interview_reminder_jobs;
DROP POLICY IF EXISTS interview_reminder_jobs_manage_scope ON public.interview_reminder_jobs;

CREATE POLICY interview_activity_events_select_scope
  ON public.interview_activity_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_activity_events.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_activity_events_insert_scope
  ON public.interview_activity_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_activity_events.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_reminder_jobs_select_scope
  ON public.interview_reminder_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_reminder_jobs.interview_id
        AND is_institution_member(r.institution_id)
    )
  );

CREATE POLICY interview_reminder_jobs_manage_scope
  ON public.interview_reminder_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_reminder_jobs.interview_id
        AND is_institution_member(r.institution_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.interviews it
      JOIN public.applications a ON a.id = it.application_id
      JOIN public.roles r ON r.id = a.role_id
      WHERE it.id = interview_reminder_jobs.interview_id
        AND is_institution_member(r.institution_id)
    )
  );
