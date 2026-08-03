-- =============================================================================
-- 059_role_specialization.sql
-- Phase A — Multi-workspace identity refactor
-- Adds role_specialization + role_custom_label to institution_members.
-- Backfills from existing status enum (OWNER/ADMIN → role; ACTIVE → STANDARD_HR).
-- =============================================================================

-- Predefined sub-roles within an institution.
-- Lifecycle stays in status (PENDING/ACTIVE/SUSPENDED); function-role goes here.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'institution_role_specialization') THEN
    CREATE TYPE institution_role_specialization AS ENUM (
      'OWNER',
      'ADMIN',
      'HR_LEAD',
      'HIRING_MANAGER',
      'RECRUITER',
      'STANDARD_HR',
      'MEMBER',
      'CUSTOM'
    );
  END IF;
END $$;

ALTER TABLE institution_members
  ADD COLUMN IF NOT EXISTS role_specialization institution_role_specialization,
  ADD COLUMN IF NOT EXISTS role_custom_label TEXT
    CHECK (role_custom_label IS NULL OR char_length(role_custom_label) BETWEEN 1 AND 80);

-- Backfill existing rows from status enum.
UPDATE institution_members
SET role_specialization = CASE
  WHEN status::text = 'OWNER'  THEN 'OWNER'::institution_role_specialization
  WHEN status::text = 'ADMIN'  THEN 'ADMIN'::institution_role_specialization
  WHEN status::text = 'ACTIVE' THEN 'STANDARD_HR'::institution_role_specialization
  ELSE NULL
END
WHERE role_specialization IS NULL;

CREATE INDEX IF NOT EXISTS idx_institution_members_specialization
  ON institution_members(role_specialization);
