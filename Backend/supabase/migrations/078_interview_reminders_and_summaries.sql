-- Migration 078: Interview auto-reminders flags + AI summary table
-- Phase: T4 (reminders) + T6 (AI summary)

-- T4: Add reminder sent flags to interviews table
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS reminder_sent_48h boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_2h  boolean NOT NULL DEFAULT false;

-- T6: AI post-interview summary table
CREATE TABLE IF NOT EXISTS interview_summaries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  version      int  NOT NULL DEFAULT 1,
  content      text NOT NULL,
  model        text NOT NULL DEFAULT 'gemini-2.5-flash',
  recommendation varchar(20) CHECK (recommendation IN ('STRONG_YES','YES','MIXED','NO')),
  created_by   uuid NOT NULL REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_summaries_interview_id ON interview_summaries(interview_id);

-- RLS: HR members of institution can read summaries for their institution's interviews
ALTER TABLE interview_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can read summaries of their institution interviews"
  ON interview_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interviews i
      JOIN applications a ON a.id = i.application_id
      JOIN roles r ON r.id = a.role_id
      JOIN institution_memberships im ON im.institution_id = r.institution_id
      WHERE i.id = interview_summaries.interview_id
        AND im.user_id = auth.uid()
    )
  );

CREATE POLICY "HR can insert summaries for their institution interviews"
  ON interview_summaries FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM interviews i
      JOIN applications a ON a.id = i.application_id
      JOIN roles r ON r.id = a.role_id
      JOIN institution_memberships im ON im.institution_id = r.institution_id
      WHERE i.id = interview_summaries.interview_id
        AND im.user_id = auth.uid()
    )
  );
