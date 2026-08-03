-- =============================================================================
-- 052_skill_vault.sql
-- Phase 3 Sprint 2 — Verification Vault
-- skill_proofs: tangible evidence linked to a skill (file upload or URL link)
-- work_evidence: structured STAR-style log (Problem / Tools / Result)
-- =============================================================================

-- ─── skill_proofs ─────────────────────────────────────────────────────────────

CREATE TYPE skill_proof_type AS ENUM ('FILE', 'LINK');

CREATE TABLE IF NOT EXISTS skill_proofs (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_profile_id UUID            NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  skill_name            TEXT            NOT NULL CHECK (char_length(skill_name) BETWEEN 1 AND 100),
  proof_type            skill_proof_type NOT NULL,
  file_url              TEXT,
  link_url              TEXT,
  title                 TEXT            NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description           TEXT            CHECK (char_length(description) <= 2000),
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT skill_proofs_url_check CHECK (
    (proof_type = 'FILE' AND file_url IS NOT NULL) OR
    (proof_type = 'LINK' AND link_url IS NOT NULL)
  )
);

CREATE INDEX idx_skill_proofs_individual ON skill_proofs(individual_profile_id);
CREATE INDEX idx_skill_proofs_skill      ON skill_proofs(individual_profile_id, skill_name);

ALTER TABLE skill_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_proofs_owner_all"
  ON skill_proofs FOR ALL
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

CREATE POLICY "skill_proofs_hr_read"
  ON skill_proofs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'HR'
    )
  );

-- ─── work_evidence ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_evidence (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_profile_id UUID        NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  skill_proof_id        UUID        REFERENCES skill_proofs(id) ON DELETE SET NULL,
  title                 TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  problem               TEXT        NOT NULL CHECK (char_length(problem) BETWEEN 1 AND 3000),
  tools                 JSONB       NOT NULL DEFAULT '[]',
  result                TEXT        NOT NULL CHECK (char_length(result) BETWEEN 1 AND 3000),
  impact_score          SMALLINT    CHECK (impact_score BETWEEN 1 AND 5),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_evidence_individual ON work_evidence(individual_profile_id);

CREATE OR REPLACE FUNCTION update_work_evidence_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_work_evidence_updated_at
  BEFORE UPDATE ON work_evidence
  FOR EACH ROW EXECUTE FUNCTION update_work_evidence_updated_at();

ALTER TABLE work_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_evidence_owner_all"
  ON work_evidence FOR ALL
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

CREATE POLICY "work_evidence_hr_read"
  ON work_evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'HR'
    )
  );
