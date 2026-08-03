-- 043_interview_meeting_location.sql
-- Adds a dedicated location field for in-person interviews.

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS meeting_location text;
