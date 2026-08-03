-- =============================================================================
-- 066_offer_approvals.sql
-- Phase F — Multi-step offer approval chain (Standard HR drafts → HR Lead approves → Owner signs).
-- Each row represents one approval step in the chain. State machine lives in the controller.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_approval_status') THEN
    CREATE TYPE offer_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS offer_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  step            INTEGER NOT NULL CHECK (step BETWEEN 1 AND 10),
  required_role   TEXT NOT NULL,            -- e.g. 'HR_LEAD', 'OWNER', or a custom role label
  approver_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status          offer_approval_status NOT NULL DEFAULT 'PENDING',
  comment         TEXT CHECK (comment IS NULL OR char_length(comment) <= 2000),
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(offer_id, step)
);

CREATE INDEX IF NOT EXISTS idx_offer_approvals_offer ON offer_approvals(offer_id, step);
CREATE INDEX IF NOT EXISTS idx_offer_approvals_status ON offer_approvals(status);

ALTER TABLE offer_approvals ENABLE ROW LEVEL SECURITY;

-- Members of the institution that owns the offer can read/write.
CREATE POLICY offer_approvals_institution_member ON offer_approvals
  FOR ALL USING (
    offer_id IN (
      SELECT o.id FROM offers o
      JOIN applications a ON a.id = o.application_id
      JOIN roles r ON r.id = a.role_id
      JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
        AND im.status IN ('OWNER','ADMIN','ACTIVE')
    )
  );
