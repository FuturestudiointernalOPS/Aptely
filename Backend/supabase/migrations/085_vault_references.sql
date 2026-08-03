-- 085_vault_references.sql — Reference Manager for Verification Vault

CREATE TABLE IF NOT EXISTS vault_references (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_profile_id UUID        NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  email                 TEXT,
  company               TEXT,
  relationship          TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_references_profile ON vault_references(individual_profile_id);

ALTER TABLE vault_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_references_owner ON vault_references
  FOR ALL USING (
    individual_profile_id IN (
      SELECT id FROM individual_profiles WHERE profile_id = auth.uid()
    )
  );
