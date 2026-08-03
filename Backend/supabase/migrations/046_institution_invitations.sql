-- =============================================================================
-- 046_institution_invitations.sql
-- Reusable invite tokens for joining institutions
-- =============================================================================

CREATE TABLE institution_invitations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  token          TEXT UNIQUE NOT NULL,
  created_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ
);

CREATE INDEX idx_inst_invitations_token   ON institution_invitations(token) WHERE revoked_at IS NULL;
CREATE INDEX idx_inst_invitations_inst_id ON institution_invitations(institution_id);

-- HR members can view their institution's invitations
ALTER TABLE institution_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invite_select_hr ON institution_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM institution_members m
      WHERE m.institution_id = institution_invitations.institution_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status IN ('ACTIVE','OWNER','ADMIN')
    )
  );

CREATE POLICY invite_insert_hr ON institution_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM institution_members m
      WHERE m.institution_id = institution_invitations.institution_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status IN ('OWNER','ADMIN')
    )
  );

CREATE POLICY invite_delete_hr ON institution_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM institution_members m
      WHERE m.institution_id = institution_invitations.institution_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status IN ('OWNER','ADMIN')
    )
  );
