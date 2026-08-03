-- 093_interview_availability_window.sql
-- HR can propose a time window; candidate picks their slot

ALTER TABLE interviews
  ADD COLUMN availability_window_json JSONB;
-- shape: { from: ISO, to: ISO, workingHoursStart: "09:00", workingHoursEnd: "18:00" }

-- Add PENDING_CANDIDATE_BOOKING status to existing enum
ALTER TYPE interview_status ADD VALUE IF NOT EXISTS 'PENDING_CANDIDATE_BOOKING' AFTER 'DRAFT';
