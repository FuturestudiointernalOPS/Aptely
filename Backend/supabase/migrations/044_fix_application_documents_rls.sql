-- =============================================================================
-- 044_fix_application_documents_rls.sql
-- Fix: Missing HR read policy for application_documents table
-- 
-- Problem:
--   Migration 011 created candidate-only policies for application_documents
--   but didn't explicitly add a policy for HR to read documents.
--   The old app_docs_access policy should still work, but let's be explicit.
--
-- Solution:
--   Add explicit HR read policy for application_documents
-- =============================================================================

-- ─── HR read access to application_documents ──────────────────────────────────
-- HR can read documents for applications within their institution

DROP POLICY IF EXISTS app_docs_select_hr ON application_documents;
CREATE POLICY app_docs_select_hr ON application_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      WHERE a.id = application_documents.application_id
        AND (SELECT is_institution_member(r.institution_id))
    )
  );

-- ─── Ensure DELETE is allowed for candidates (cleanup) ───────────────────────
DROP POLICY IF EXISTS app_docs_delete_candidate ON application_documents;
CREATE POLICY app_docs_delete_candidate ON application_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_documents.application_id
        AND a.candidate_id = (SELECT auth.uid())
    )
  );
