-- =============================================================================
-- 068_onboarding_signing_chain.sql
-- Phase F — Multi-signer document workflow.
-- A document moves through an ordered chain of signers (HR → HR Lead → Owner → Candidate).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_signer_status') THEN
    CREATE TYPE document_signer_status AS ENUM ('PENDING', 'SIGNED', 'REJECTED', 'SKIPPED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS document_signers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES onboarding_documents(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  signer_role     TEXT NOT NULL,        -- 'STANDARD_HR', 'HR_LEAD', 'OWNER', 'CANDIDATE', or custom
  signer_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status          document_signer_status NOT NULL DEFAULT 'PENDING',
  signature_token UUID UNIQUE DEFAULT gen_random_uuid(),
  signed_at       TIMESTAMPTZ,
  signature_meta  JSONB,                -- IP, user-agent, signed payload hash, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, position)
);

CREATE INDEX IF NOT EXISTS idx_document_signers_document ON document_signers(document_id, position);
CREATE INDEX IF NOT EXISTS idx_document_signers_token ON document_signers(signature_token) WHERE signature_token IS NOT NULL;

ALTER TABLE document_signers ENABLE ROW LEVEL SECURITY;

-- Institution members of the doc owner can read/write.
-- Note: candidate signers access via signature_token (public route, bypasses RLS via supabaseAdmin).
CREATE POLICY document_signers_institution ON document_signers
  FOR ALL USING (
    document_id IN (
      SELECT od.id FROM onboarding_documents od
      JOIN onboarding_checklists oc ON oc.id = od.checklist_id
      JOIN applications a ON a.id = oc.application_id
      JOIN roles r ON r.id = a.role_id
      JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
        AND im.status IN ('OWNER','ADMIN','ACTIVE')
    )
  );
