-- Migration 082: Interview reminder jobs table + reminder flags on interviews

-- Table: interview_reminder_jobs
CREATE TABLE IF NOT EXISTS interview_reminder_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  send_at     TIMESTAMPTZ NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'EMAIL',
  status      TEXT NOT NULL DEFAULT 'PENDING',
  attempts    INT NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminder_jobs_status_send_at
  ON interview_reminder_jobs(status, send_at)
  WHERE status = 'PENDING';

-- Add reminder sent flags to interviews
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS reminder_sent_48h BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_2h  BOOLEAN NOT NULL DEFAULT false;
