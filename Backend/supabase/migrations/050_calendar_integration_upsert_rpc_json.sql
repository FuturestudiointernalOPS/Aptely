-- 050_calendar_integration_upsert_rpc_json.sql
-- Add JSON overload for insert_calendar_integration_upsert to support Supabase RPC
-- Accept a single json/jsonb parameter so PostgREST can match the function signature

CREATE OR REPLACE FUNCTION public.insert_calendar_integration_upsert(p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := NULL;
  v_provider calendar_provider := NULL;
  v_access_token_enc text := NULL;
  v_refresh_token_enc text := NULL;
  v_expires_at timestamptz := NULL;
  v_scope text[] := NULL;
  v_is_active boolean := true;
  _scope_json jsonb;
BEGIN
  -- support keys with or without p_ prefix
  IF (p ? 'p_user_id') THEN
    v_user_id := (p->>'p_user_id')::uuid;
  ELSIF (p ? 'user_id') THEN
    v_user_id := (p->>'user_id')::uuid;
  END IF;

  IF (p ? 'p_provider') THEN
    v_provider := (p->>'p_provider')::calendar_provider;
  ELSIF (p ? 'provider') THEN
    v_provider := (p->>'provider')::calendar_provider;
  END IF;

  IF (p ? 'p_access_token_enc') THEN
    v_access_token_enc := p->>'p_access_token_enc';
  ELSIF (p ? 'access_token_enc') THEN
    v_access_token_enc := p->>'access_token_enc';
  END IF;

  IF (p ? 'p_refresh_token_enc') THEN
    v_refresh_token_enc := p->>'p_refresh_token_enc';
  ELSIF (p ? 'refresh_token_enc') THEN
    v_refresh_token_enc := p->>'refresh_token_enc';
  END IF;

  IF (p ? 'p_expires_at') THEN
    v_expires_at := (p->>'p_expires_at')::timestamptz;
  ELSIF (p ? 'expires_at') THEN
    v_expires_at := (p->>'expires_at')::timestamptz;
  END IF;

  IF (p ? 'p_scope') THEN
    _scope_json := p->'p_scope';
  ELSIF (p ? 'scope') THEN
    _scope_json := p->'scope';
  END IF;

  IF _scope_json IS NOT NULL THEN
    v_scope := ARRAY(SELECT jsonb_array_elements_text(_scope_json));
  END IF;

  IF (p ? 'p_is_active') THEN
    v_is_active := (p->>'p_is_active')::boolean;
  ELSIF (p ? 'is_active') THEN
    v_is_active := (p->>'is_active')::boolean;
  END IF;

  IF v_user_id IS NULL OR v_provider IS NULL OR v_access_token_enc IS NULL THEN
    RAISE EXCEPTION 'Missing required fields for insert_calendar_integration_upsert';
  END IF;

  INSERT INTO public.calendar_integrations (
    user_id, provider, access_token_enc, refresh_token_enc, expires_at, scope, is_active, updated_at
  ) VALUES (
    v_user_id, v_provider, v_access_token_enc, v_refresh_token_enc, v_expires_at, v_scope, v_is_active, now()
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

-- Grant execute permission to authenticated and anon
GRANT EXECUTE ON FUNCTION public.insert_calendar_integration_upsert(jsonb) TO authenticated, anon;
