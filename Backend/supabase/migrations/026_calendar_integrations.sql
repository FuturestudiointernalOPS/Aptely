-- 026_calendar_integrations.sql
-- Calendar integration tokens (encrypted in app layer)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_provider') THEN
    CREATE TYPE calendar_provider AS ENUM ('GOOGLE', 'OUTLOOK');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  expires_at timestamptz,
  scope text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_integrations_user_provider_unique UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_provider
  ON public.calendar_integrations(user_id, provider);

ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_integrations_select_own ON public.calendar_integrations;
DROP POLICY IF EXISTS calendar_integrations_insert_own ON public.calendar_integrations;
DROP POLICY IF EXISTS calendar_integrations_update_own ON public.calendar_integrations;
DROP POLICY IF EXISTS calendar_integrations_delete_own ON public.calendar_integrations;

CREATE POLICY calendar_integrations_select_own
  ON public.calendar_integrations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY calendar_integrations_insert_own
  ON public.calendar_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY calendar_integrations_update_own
  ON public.calendar_integrations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY calendar_integrations_delete_own
  ON public.calendar_integrations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
