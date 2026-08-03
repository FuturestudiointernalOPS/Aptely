-- 049_calendar_integration_upsert_rpc.sql
-- Create stored procedure to handle calendar integration upsert
-- This bypasses the Supabase.js client's upsert() method which doesn't properly
-- format the onConflict parameter, causing error 42P10

CREATE OR REPLACE FUNCTION public.insert_calendar_integration_upsert(
  p_user_id uuid,
  p_provider calendar_provider,
  p_access_token_enc text,
  p_refresh_token_enc text,
  p_expires_at timestamptz,
  p_scope text[],
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.calendar_integrations (
    user_id,
    provider,
    access_token_enc,
    refresh_token_enc,
    expires_at,
    scope,
    is_active,
    updated_at
  ) VALUES (
    p_user_id,
    p_provider,
    p_access_token_enc,
    p_refresh_token_enc,
    p_expires_at,
    p_scope,
    p_is_active,
    now()
  )
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token_enc = EXCLUDED.access_token_enc,
    refresh_token_enc = EXCLUDED.refresh_token_enc,
    expires_at = EXCLUDED.expires_at,
    scope = EXCLUDED.scope,
    is_active = EXCLUDED.is_active,
    updated_at = now();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_calendar_integration_upsert(uuid, calendar_provider, text, text, timestamptz, text[], boolean) TO authenticated, anon;
