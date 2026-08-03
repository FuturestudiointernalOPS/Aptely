-- =============================================================================
-- 010_fix_search_paths.sql
-- Fixes "Function Search Path Mutable" security warnings (Supabase lint 0011)
-- by adding SET search_path = public to all custom functions.
-- =============================================================================

-- Fix 1: update_updated_at (trigger called by all tables with updated_at)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix 2: create_role_dna_on_role_insert (trigger: auto-creates empty role_dna on role INSERT)
CREATE OR REPLACE FUNCTION public.create_role_dna_on_role_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.role_dna (role_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Fix 3: is_institution_member (RLS helper used by all institution-scoped policies)
CREATE OR REPLACE FUNCTION public.is_institution_member(inst_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.institution_members
    WHERE user_id = auth.uid()
      AND institution_id = inst_id
      AND status IN ('OWNER', 'ACTIVE')
  );
END;
$$;
