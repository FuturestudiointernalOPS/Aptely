-- Migration 083: Fix recommendation CHECK constraint to match application values
-- Adds NEUTRAL and STRONG_NO which the AI service uses

ALTER TABLE interview_summaries
  DROP CONSTRAINT IF EXISTS interview_summaries_recommendation_check;

ALTER TABLE interview_summaries
  ADD CONSTRAINT interview_summaries_recommendation_check
  CHECK (recommendation IN ('STRONG_YES', 'YES', 'NEUTRAL', 'MIXED', 'NO', 'STRONG_NO'));
