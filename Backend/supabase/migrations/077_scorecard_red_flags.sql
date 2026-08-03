-- Migration 077: Add red_flag column to scorecard_entries
-- Phase: T5 — Red flag tagging on interview scorecard criteria

ALTER TABLE scorecard_entries
  ADD COLUMN IF NOT EXISTS red_flag boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN scorecard_entries.red_flag IS 'HR/interviewer can flag a criterion as a red flag (e.g. vague answers, role mismatch)';
