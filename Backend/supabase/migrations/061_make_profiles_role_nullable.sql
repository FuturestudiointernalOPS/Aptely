-- =============================================================================
-- 061_make_profiles_role_nullable.sql
-- Phase B — Register-as-user refactor.
-- profiles.role becomes nullable. New signups have role = NULL (workspace-less).
-- Existing HR/CANDIDATE rows untouched. Drop in Phase F after audit.
-- =============================================================================

ALTER TABLE profiles
  ALTER COLUMN role DROP NOT NULL;

-- Update default to NULL so the trigger handle_new_user (if it sets default) doesn't force CANDIDATE.
ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT NULL;
