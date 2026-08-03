-- 030_interview_participants.sql
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_type') THEN
        CREATE TYPE interview_type AS ENUM ('TECH_REVIEW', 'PERSONALITY_TEST', 'CULTURE_FIT', 'CUSTOM');
    END IF;
END $$;

ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS interview_type interview_type DEFAULT 'CUSTOM';

CREATE TABLE IF NOT EXISTS public.interview_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  profile_text text,
  evaluation_weight numeric CHECK (evaluation_weight >= 0 AND evaluation_weight <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_interview_id ON public.interview_participants(interview_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.interview_participants(user_id);
