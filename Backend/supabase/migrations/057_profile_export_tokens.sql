-- =============================================================================
-- 057_profile_export_tokens.sql — Shareable Capability Record links
-- Dépend de : 050_identity_rework.sql
-- =============================================================================

CREATE TABLE profile_export_tokens (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_profile_id UUID        NOT NULL UNIQUE REFERENCES individual_profiles(id) ON DELETE CASCADE,
  token                 TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_tokens_individual ON profile_export_tokens(individual_profile_id);
CREATE INDEX idx_export_tokens_token      ON profile_export_tokens(token);

ALTER TABLE profile_export_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY export_tokens_owner ON profile_export_tokens
  FOR ALL USING (
    individual_profile_id IN (
      SELECT id FROM individual_profiles WHERE profile_id = auth.uid()
    )
  );
