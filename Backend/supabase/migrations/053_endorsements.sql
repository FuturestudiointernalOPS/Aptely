-- =============================================================================
-- 053_endorsements.sql
-- Phase 3 Sprint 2 — Références & Endorsements
-- An individual can request a third-party endorsement on specific dimensions.
-- The endorser receives an email with a magic-link token to submit their rating.
-- =============================================================================

CREATE TABLE IF NOT EXISTS endorsements (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_profile_id UUID        NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  endorser_email        TEXT        NOT NULL CHECK (char_length(endorser_email) <= 254),
  endorser_name         TEXT        CHECK (char_length(endorser_name) <= 200),
  dimension             TEXT        NOT NULL CHECK (char_length(dimension) BETWEEN 1 AND 200),
  rating                SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  comment               TEXT        CHECK (char_length(comment) <= 2000),
  token                 UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status                TEXT        NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'SUBMITTED', 'EXPIRED')),
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_endorsements_individual ON endorsements(individual_profile_id);
CREATE INDEX idx_endorsements_token      ON endorsements(token);

ALTER TABLE endorsements ENABLE ROW LEVEL SECURITY;

-- Owner sees all their endorsements
CREATE POLICY "endorsements_owner_all"
  ON endorsements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM individual_profiles ip
      WHERE ip.id = individual_profile_id AND ip.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_profiles ip
      WHERE ip.id = individual_profile_id AND ip.profile_id = auth.uid()
    )
  );

-- Service role handles token-based public access (backend bypasses RLS)
-- HR can read submitted endorsements
CREATE POLICY "endorsements_hr_read"
  ON endorsements FOR SELECT
  USING (
    status = 'SUBMITTED' AND
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'HR'
    )
  );
