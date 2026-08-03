-- Migration 079: Add role (MANDATORY/SECONDARY) column to interview_participants
-- Phase: T2 — Mandatory vs Secondary interviewer logic

ALTER TABLE interview_participants
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'MANDATORY'
  CHECK (role IN ('MANDATORY', 'SECONDARY'));

COMMENT ON COLUMN interview_participants.role IS 'MANDATORY: must be free for slot to appear. SECONDARY: at least 1 must be free.';
