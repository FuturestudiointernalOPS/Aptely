-- =============================================================================
-- 050_identity_rework.sql
-- Phase 3 Sprint 1 — Individual profile extension
-- Adds individual_profiles table to store extended talent data (bio, skills,
-- experience, education) without touching existing profiles / applications FK.
-- =============================================================================

CREATE TABLE IF NOT EXISTS individual_profiles (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  headline          TEXT,
  bio               TEXT,
  location          TEXT,
  website_url       TEXT,
  linkedin_url      TEXT,
  github_url        TEXT,
  availability      TEXT        CHECK (availability IN ('IMMEDIATE', 'ONE_MONTH', 'THREE_MONTHS', 'NOT_LOOKING')),
  skills            JSONB       NOT NULL DEFAULT '[]',
  experience        JSONB       NOT NULL DEFAULT '[]',
  education         JSONB       NOT NULL DEFAULT '[]',
  certifications    JSONB       NOT NULL DEFAULT '[]',
  languages         JSONB       NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_individual_profiles_profile ON individual_profiles(profile_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_individual_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_individual_profiles_updated_at
  BEFORE UPDATE ON individual_profiles
  FOR EACH ROW EXECUTE FUNCTION update_individual_profiles_updated_at();

-- RLS
ALTER TABLE individual_profiles ENABLE ROW LEVEL SECURITY;

-- Owner can read and write their own record
CREATE POLICY "individual_profiles_owner_all"
  ON individual_profiles
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- HR can read individual profiles (for candidate review)
CREATE POLICY "individual_profiles_hr_read"
  ON individual_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'HR'
    )
  );
