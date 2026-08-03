-- Login OTP challenges (email 2FA)

CREATE TABLE IF NOT EXISTS public.login_otp_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  code_salt text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_otp_user_id ON public.login_otp_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_login_otp_expires_at ON public.login_otp_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_otp_created_at ON public.login_otp_challenges(created_at);

ALTER TABLE public.login_otp_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_otp_service_role_all"
ON public.login_otp_challenges
AS PERMISSIVE
FOR ALL
TO public
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

COMMENT ON TABLE public.login_otp_challenges IS 'Short-lived email OTP challenges for login 2FA.';
COMMENT ON COLUMN public.login_otp_challenges.refresh_token IS 'Refresh token stored temporarily until OTP verification.';
COMMENT ON COLUMN public.login_otp_challenges.code_hash IS 'SHA-256 of code_salt:code (raw code never stored).';
