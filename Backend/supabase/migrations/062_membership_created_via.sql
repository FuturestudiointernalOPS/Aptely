-- =============================================================================
-- 062_membership_created_via.sql
-- Phase B — Audit trail for how a membership was created.
-- Useful for analytics and to distinguish legacy HR backfill from new flows.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_creation_source') THEN
    CREATE TYPE membership_creation_source AS ENUM (
      'OWNER_CREATED',  -- user created the institution; auto-OWNER
      'INVITED',        -- invited via invitation link
      'JOIN_REQUEST',   -- approved join request
      'LEGACY_HR'       -- pre-refactor HR with profiles.role = 'HR'
    );
  END IF;
END $$;

ALTER TABLE institution_members
  ADD COLUMN IF NOT EXISTS created_via membership_creation_source;

UPDATE institution_members
SET created_via = 'LEGACY_HR'::membership_creation_source
WHERE created_via IS NULL;
