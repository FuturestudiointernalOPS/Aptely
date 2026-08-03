-- 097_interview_participants_weight.sql
-- Add individual weight + confirmed_secondary to interview_participants
-- Add secondary_collective_weight to interviews

-- weight (INTEGER): new canonical weight column for MANDATORY participants (NULL for SECONDARY).
-- evaluation_weight (NUMERIC): legacy column retained for backward compat with existing scorecard queries.
-- For MANDATORY: both columns receive the same value. For SECONDARY: both are NULL.

ALTER TABLE interview_participants
  ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT NULL
    CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
  ADD COLUMN IF NOT EXISTS confirmed_secondary BOOLEAN NOT NULL DEFAULT false;
-- weight NULL = secondary participant (weight shared collectively via interviews.secondary_collective_weight)
-- confirmed_secondary = true when HR validated this specific secondary for the interview

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS secondary_collective_weight INTEGER DEFAULT NULL
    CHECK (secondary_collective_weight IS NULL OR (secondary_collective_weight >= 0 AND secondary_collective_weight <= 100));
