-- ─── Offer Signing Chain ──────────────────────────────────────────────────────
-- Sequential signing workflow for offer letters.
-- Candidate → Hiring Manager → HR chain (configurable).

CREATE TABLE IF NOT EXISTS offer_signing_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL CHECK (position >= 1),
  signer_type     TEXT NOT NULL CHECK (signer_type IN ('CANDIDATE', 'HR')),
  signer_role     TEXT,                                     -- e.g. 'OWNER', 'HR_LEAD' (HR only)
  signer_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'SIGNED', 'REJECTED')),
  signature_token TEXT UNIQUE,                              -- public token for candidate
  signed_at       TIMESTAMPTZ,
  rejected_at     TIMESTAMPTZ,
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(offer_id, position)
);

CREATE INDEX IF NOT EXISTS idx_offer_signing_offer ON offer_signing_steps(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_signing_token ON offer_signing_steps(signature_token)
  WHERE signature_token IS NOT NULL;

ALTER TABLE offer_signing_steps ENABLE ROW LEVEL SECURITY;

-- HR can manage signing chains for their institution's offers
CREATE POLICY offer_signing_hr ON offer_signing_steps
  FOR ALL USING (
    offer_id IN (
      SELECT o.id FROM offers o
      JOIN applications a ON a.id = o.application_id
      JOIN roles r ON r.id = a.role_id
      JOIN profiles p ON p.institution_id = r.institution_id
      WHERE p.id = auth.uid()
    )
  );

-- Public read via signature_token (candidate signing)
CREATE POLICY offer_signing_public_read ON offer_signing_steps
  FOR SELECT USING (signature_token IS NOT NULL);
