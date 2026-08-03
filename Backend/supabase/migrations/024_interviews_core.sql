-- 024_interviews_core.sql
-- Core interview scheduling schema (JSON-only compatible)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_status') THEN
    CREATE TYPE interview_status AS ENUM ('DRAFT', 'SCHEDULED', 'CANCELLED', 'COMPLETED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_provider') THEN
    CREATE TYPE meeting_provider AS ENUM ('GOOGLE_MEET', 'TEAMS', 'MANUAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interviewer_role') THEN
    CREATE TYPE interviewer_role AS ENUM ('PRIMARY', 'PANEL');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  role_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status interview_status NOT NULL DEFAULT 'DRAFT',
  scheduled_at timestamptz,
  duration_minutes int NOT NULL DEFAULT 60 CHECK (duration_minutes IN (30, 45, 60, 90)),
  timezone text NOT NULL DEFAULT 'UTC',
  meeting_provider meeting_provider,
  meeting_link text,
  booking_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role interviewer_role NOT NULL DEFAULT 'PRIMARY',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interviewers_interview_user_unique UNIQUE (interview_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_interviews_status_scheduled_at
  ON public.interviews(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_interviewers_interview_id
  ON public.interviewers(interview_id);

CREATE INDEX IF NOT EXISTS idx_interviewers_user_id
  ON public.interviewers(user_id);
