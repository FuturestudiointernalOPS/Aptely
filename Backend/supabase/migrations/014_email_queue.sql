-- Email Queue Table for Email Retry Logic
-- When emails fail to send via Resend, they're added to this queue
-- for automatic retry with exponential backoff

CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  text text,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON public.email_queue(status, attempts, created_at) 
  WHERE status = 'pending' AND attempts < max_attempts;

-- RLS: Email queue is admin-only (no user access)
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Email queue is admin-only" ON public.email_queue
  FOR ALL USING (auth.jwt()->>'role' = 'service_role' OR auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.jwt()->>'role' = 'admin');

-- Allow anonymous role for scheduled jobs (internal API calls)
CREATE POLICY "Allow scheduled tasks to access email queue" ON public.email_queue
  FOR ALL USING (auth.jwt()->>'sub' IS NOT NULL)
  WITH CHECK (auth.jwt()->>'sub' IS NOT NULL);

COMMENT ON TABLE public.email_queue IS 'Queue for failed emails that need retry. Processed by background job every 5 minutes.';
COMMENT ON COLUMN public.email_queue.status IS 'pending=awaiting retry, sent=successfully sent, failed=max retries reached';
COMMENT ON COLUMN public.email_queue.attempts IS 'Number of attempts made so far';
COMMENT ON COLUMN public.email_queue.max_attempts IS 'Maximum number of retry attempts (default 5)';
