-- =============================================================================
-- 042_institution_admin_role.sql
-- Add ADMIN status to membership enum and include it in RLS helper checks.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'membership_status'
      AND e.enumlabel = 'ADMIN'
  ) THEN
    ALTER TYPE membership_status ADD VALUE 'ADMIN' AFTER 'OWNER';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_institution_member(inst_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.institution_members
    WHERE user_id = auth.uid()
      AND institution_id = inst_id
      AND status IN ('OWNER', 'ADMIN', 'ACTIVE')
  );
END;
$$;
