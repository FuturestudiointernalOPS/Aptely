-- =============================================================================
-- 011_rls_performance.sql
-- Fixes Supabase performance advisor warnings:
--
-- 1. auth_rls_initplan (14 warnings): Replace auth.uid() with (SELECT auth.uid())
--    in all RLS policies to avoid per-row re-evaluation.
--
-- 2. unindexed_foreign_keys (1 warning): Add index on sorted_talents.application_id
-- =============================================================================

-- ─── Fix 1: sorted_talents — missing index ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sorted_talents_application_id
  ON sorted_talents (application_id);

-- ─── Fix 2: profiles — profiles_select_own ────────────────────────────────────
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING     ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ─── Fix 3: applications ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS applications_select_candidate ON applications;
CREATE POLICY applications_select_candidate ON applications
  FOR SELECT USING (candidate_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS applications_insert_candidate ON applications;
CREATE POLICY applications_insert_candidate ON applications
  FOR INSERT WITH CHECK (candidate_id = (SELECT auth.uid()));

-- ─── Fix 4: application_documents ────────────────────────────────────────────
DROP POLICY IF EXISTS app_docs_select_candidate ON application_documents;
CREATE POLICY app_docs_select_candidate ON application_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_documents.application_id
        AND a.candidate_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS app_docs_insert_candidate ON application_documents;
CREATE POLICY app_docs_insert_candidate ON application_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_documents.application_id
        AND a.candidate_id = (SELECT auth.uid())
    )
  );

-- ─── Fix 5: institution_members ───────────────────────────────────────────────
DROP POLICY IF EXISTS institution_members_select_own ON institution_members;
CREATE POLICY institution_members_select_own ON institution_members
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- ─── Fix 6: institutions ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS institutions_update_admin ON institutions;
CREATE POLICY institutions_update_admin ON institutions
  FOR UPDATE USING (
    (SELECT auth.uid()) IN (
      SELECT im.user_id
      FROM institution_members im
      JOIN profiles p ON p.id = im.user_id
      WHERE im.institution_id = institutions.id
        AND p.role = 'HR'
        AND im.status = 'ACTIVE'
    )
  );

-- ─── Fix 7: join_requests ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS join_requests_select_own ON join_requests;
CREATE POLICY join_requests_select_own ON join_requests
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS join_requests_insert_own ON join_requests;
CREATE POLICY join_requests_insert_own ON join_requests
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- ─── Fix 8: match_results ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS match_results_select_candidate ON match_results;
CREATE POLICY match_results_select_candidate ON match_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = match_results.application_id
        AND a.candidate_id = (SELECT auth.uid())
    )
  );

-- ─── Fix 9: talent_dna ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS talent_dna_select_own ON talent_dna;
CREATE POLICY talent_dna_select_own ON talent_dna
  FOR SELECT USING (candidate_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS talent_dna_update_own ON talent_dna;
CREATE POLICY talent_dna_update_own ON talent_dna
  FOR UPDATE
  USING     (candidate_id = (SELECT auth.uid()))
  WITH CHECK (candidate_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS talent_dna_select_hr ON talent_dna;
CREATE POLICY talent_dna_select_hr ON talent_dna
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN institution_members im ON (
        im.user_id = (SELECT auth.uid())
        AND im.institution_id = p.institution_id
      )
      WHERE p.id = talent_dna.candidate_id
        AND im.status = 'ACTIVE'
    )
  );
