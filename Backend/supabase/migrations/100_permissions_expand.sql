-- =============================================================================
-- 100_permissions_expand.sql
-- Make the per-role permission store flexible enough for the expanded permission
-- set and for all role_specialization values + custom roles.
--   1. permission column: enum `institution_permission` (9 stale values) → TEXT.
--      The app is the source of truth for the permission list; this avoids an
--      ALTER TYPE ADD VALUE migration every time a permission is added.
--   2. role column: drop the CHECK that limited it to OWNER/ADMIN/MEMBER so the
--      8 built-in role_specialization values AND custom-role ids can be stored.
-- =============================================================================

-- 1. permission → text (keeps existing rows, drops enum dependency)
ALTER TABLE institution_role_permissions
  ALTER COLUMN permission TYPE text USING permission::text;

-- 2. allow any role key (built-in role_specialization or custom role id)
ALTER TABLE institution_role_permissions
  DROP CONSTRAINT IF EXISTS institution_role_permissions_role_check;
