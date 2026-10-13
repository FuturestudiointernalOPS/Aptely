-- =============================================================================
-- 142_email_otp_atomic_attempts.sql
-- Atomically record a failed signup-OTP attempt.
-- The app previously read the counter and wrote it back in two steps, so two
-- concurrent wrong guesses could both read the same value and lose an attempt
-- (letting a caller exceed the intended cap). This does the increment and the
-- lock in a single statement, serialized by the row lock.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_otp_failed_attempt(
  p_otp_id uuid,
  p_max_attempts integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
BEGIN
  UPDATE email_otps
  SET attempts = attempts + 1,
      used_at  = CASE WHEN attempts + 1 >= p_max_attempts THEN NOW() ELSE used_at END
  WHERE id = p_otp_id
    AND used_at IS NULL
  RETURNING attempts INTO v_attempts;

  -- NULL when no row matched: the code was already consumed or locked.
  RETURN v_attempts;
END;
$$;

COMMENT ON FUNCTION public.record_otp_failed_attempt(uuid, integer)
  IS 'Atomically increments the failed-attempt counter of an OTP and locks it once the cap is reached.';

GRANT EXECUTE ON FUNCTION public.record_otp_failed_attempt(uuid, integer) TO service_role;
