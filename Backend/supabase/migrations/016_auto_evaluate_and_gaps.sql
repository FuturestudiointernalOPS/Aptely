-- Migration for auto-screening and feedback
ALTER TABLE roles ADD COLUMN IF NOT EXISTS auto_evaluate BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS feedback_sent BOOLEAN DEFAULT false;
