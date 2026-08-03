-- =============================================================================
-- 069_drop_profiles_role.sql
-- Phase F — Drop the legacy `profiles.role` column after 14-day audit confirms
-- zero reads in production logs.
--
-- ⚠ DEFERRED — Do NOT apply this migration until:
--   1. `profiles.role` log audit shows 0 reads for 14 consecutive days.
--   2. All auth.middleware fallback paths have been removed.
--   3. JWT `app_metadata.role` is no longer written by syncUserClaims().
--
-- To apply when ready:
--   supabase db push  (or run manually in SQL editor)
-- =============================================================================

-- Step 1: Remove the fallback default so new inserts don't silently set role.
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;

-- Step 2: Make nullable (Phase B migration 061 already did this).
ALTER TABLE profiles ALTER COLUMN role DROP NOT NULL;

-- Step 3: Drop the column entirely.
ALTER TABLE profiles DROP COLUMN IF EXISTS role;

-- Step 4: Remove the enum type if no longer used elsewhere.
DROP TYPE IF EXISTS user_role;
