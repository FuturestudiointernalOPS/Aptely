-- =============================================================================
-- 143_email_otp_purge.sql
-- Housekeeping for signup OTP codes.
-- Codes only live ~10 minutes and are single-use; keep the table small and avoid
-- storing stale secrets. The original table comment mentioned a cleanup job that
-- was never implemented — this provides it.
-- =============================================================================

-- Helps the cleanup scan find old rows without touching the lookup index.
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON email_otps(expires_at);

CREATE OR REPLACE FUNCTION public.purge_email_otps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Only remove rows that are comfortably past use: the 1-hour grace window
  -- keeps the anti-abuse request history (last hour) intact.
  WITH removed AS (
    DELETE FROM email_otps
    WHERE expires_at < NOW() - INTERVAL '1 hour'
       OR used_at    < NOW() - INTERVAL '1 hour'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM removed;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.purge_email_otps()
  IS 'Deletes expired/used OTP codes older than 1 hour. Returns the number removed.';

GRANT EXECUTE ON FUNCTION public.purge_email_otps() TO service_role;

-- Best-effort hourly schedule when pg_cron is available (Supabase). If the
-- extension is absent, this is a no-op and the app-side purge still runs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-email-otps') THEN
      PERFORM cron.schedule('purge-email-otps', '0 * * * *', 'SELECT public.purge_email_otps();');
    END IF;
  END IF;
END;
$$;
