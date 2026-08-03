-- 111_rls_tenant_isolation.sql
-- Fix: remove overly permissive USING(true) policies that allow any authenticated user
-- to read/write data from ALL institutions.
-- Backend uses supabaseAdmin (service_role) which bypasses RLS regardless of policies.
-- Frontend never calls Supabase directly — always goes through the Express backend.
-- Dropping these policies denies direct JWT-based Supabase access (correct behavior).

-- offers: drop USING(true) ALL
DROP POLICY IF EXISTS "Service role full access on offers" ON offers;

-- offer_versions: drop USING(true) ALL
DROP POLICY IF EXISTS "Service role full access on offer_versions" ON offer_versions;

-- application_decisions: drop USING(true) ALL
DROP POLICY IF EXISTS "Service role full access on application_decisions" ON application_decisions;

-- application_audit_logs: drop USING(true) ALL
DROP POLICY IF EXISTS "Service role full access on application_audit_logs" ON application_audit_logs;

-- interview_participants: drop BOTH conflicting USING(true) policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON interview_participants;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON interview_participants;

-- onboarding_checklists: drop USING(true) ALL
DROP POLICY IF EXISTS "Service role full access on onboarding_checklists" ON onboarding_checklists;

-- onboarding_tasks: drop USING(true) ALL
DROP POLICY IF EXISTS "Service role full access on onboarding_tasks" ON onboarding_tasks;

-- onboarding_templates: drop USING(true) ALL, replace with institution-scoped policy
DROP POLICY IF EXISTS "Service role full access on onboarding_templates" ON onboarding_templates;
CREATE POLICY onboarding_templates_institution ON onboarding_templates
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  );

-- wave_slots: drop public SELECT (backend uses supabaseAdmin for booking flow)
DROP POLICY IF EXISTS "wave_slots_public_read" ON wave_slots;

-- wave_slot_bookings: drop public SELECT
DROP POLICY IF EXISTS "wave_slot_bookings_public" ON wave_slot_bookings;
