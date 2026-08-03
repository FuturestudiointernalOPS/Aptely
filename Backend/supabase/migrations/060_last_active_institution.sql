-- =============================================================================
-- 060_last_active_institution.sql
-- Phase A — Remember the workspace the user was last using so login restores it.
-- Used by auth.controller to populate JWT app_metadata.active_institution_id.
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_last_active_institution
  ON profiles(last_active_institution_id);

-- Backfill: set last_active to current institution_id for existing HR users.
UPDATE profiles
SET last_active_institution_id = institution_id
WHERE institution_id IS NOT NULL
  AND last_active_institution_id IS NULL;
