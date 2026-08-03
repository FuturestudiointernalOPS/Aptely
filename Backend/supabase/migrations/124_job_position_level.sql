-- Migration 124: Add level field to job_positions
-- Required for salary bands (Phase 4 Module 06)
-- Levels: junior / mid / senior / lead / principal / director

ALTER TABLE job_positions
  ADD COLUMN IF NOT EXISTS level VARCHAR(20);

-- Optional: add check constraint for valid levels
DO $$ BEGIN
  ALTER TABLE job_positions ADD CONSTRAINT job_positions_level_check
    CHECK (level IS NULL OR level IN ('junior', 'mid', 'senior', 'lead', 'principal', 'director', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS job_positions_level_idx ON job_positions(level);
