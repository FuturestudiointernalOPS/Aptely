-- 109_rejection_feedback.sql
-- Add structured rejection feedback to applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejection_feedback_json JSONB;
