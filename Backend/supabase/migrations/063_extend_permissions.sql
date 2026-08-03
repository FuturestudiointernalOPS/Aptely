-- =============================================================================
-- 063_extend_permissions.sql
-- Phase C — Adds interviews.manage + onboarding.manage to institution_permission enum.
-- Allows fine-grained control over interview booking and onboarding doc workflows.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'institution_permission' AND e.enumlabel = 'interviews.manage'
  ) THEN
    ALTER TYPE institution_permission ADD VALUE 'interviews.manage';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'institution_permission' AND e.enumlabel = 'onboarding.manage'
  ) THEN
    ALTER TYPE institution_permission ADD VALUE 'onboarding.manage';
  END IF;
END $$;
