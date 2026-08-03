-- =============================================================================
-- 039_owner_b_extensions.sql — Owner B (B1..B5) foundational schema
-- Communication engine, offer portal/negotiation, secure onboarding documents
-- =============================================================================

-- ─── Communication Templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_templates_type_institution
  ON communication_templates (type, institution_id);

-- ─── Communication Logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  recipient TEXT,
  subject TEXT,
  rendered_body TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, SENT, DELIVERED, OPENED, CLICKED, FAILED
  provider TEXT,
  provider_message_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_app_created
  ON communication_logs (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_logs_provider_message
  ON communication_logs (provider_message_id);

-- ─── Offer Documents (PDF/portal artifacts) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS offer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'PDF',
  public_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_documents_offer
  ON offer_documents (offer_id, created_at DESC);

-- ─── Offer Negotiations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offer_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('HR', 'CANDIDATE')),
  actor_id UUID,
  proposed_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_negotiations_offer_created
  ON offer_negotiations (offer_id, created_at DESC);

-- ─── Offer Audit Logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_audit_logs_offer_created
  ON offer_audit_logs (offer_id, created_at DESC);

-- ─── Secure Onboarding Documents ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES onboarding_checklists(id) ON DELETE CASCADE,
  task_id UUID REFERENCES onboarding_tasks(id) ON DELETE SET NULL,
  candidate_id UUID,
  uploaded_by UUID,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_UPLOAD', -- PENDING_UPLOAD, UPLOADED, VERIFIED, REJECTED
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_checklist_status
  ON onboarding_documents (checklist_id, status);

CREATE OR REPLACE FUNCTION update_onboarding_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_documents_updated_at ON onboarding_documents;
CREATE TRIGGER trg_onboarding_documents_updated_at
  BEFORE UPDATE ON onboarding_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_documents_updated_at();

-- ─── RLS (service role centric, aligned with existing architecture) ─────────
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "communication_templates_service_role_all" ON communication_templates;
CREATE POLICY "communication_templates_service_role_all"
ON communication_templates
FOR ALL
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "communication_logs_service_role_all" ON communication_logs;
CREATE POLICY "communication_logs_service_role_all"
ON communication_logs
FOR ALL
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "offer_documents_service_role_all" ON offer_documents;
CREATE POLICY "offer_documents_service_role_all"
ON offer_documents
FOR ALL
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "offer_negotiations_service_role_all" ON offer_negotiations;
CREATE POLICY "offer_negotiations_service_role_all"
ON offer_negotiations
FOR ALL
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "offer_audit_logs_service_role_all" ON offer_audit_logs;
CREATE POLICY "offer_audit_logs_service_role_all"
ON offer_audit_logs
FOR ALL
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS "onboarding_documents_service_role_all" ON onboarding_documents;
CREATE POLICY "onboarding_documents_service_role_all"
ON onboarding_documents
FOR ALL
USING ((select auth.role()) = 'service_role')
WITH CHECK ((select auth.role()) = 'service_role');

-- ─── Seed default communication templates (idempotent) ──────────────────────
INSERT INTO communication_templates (institution_id, type, title, subject_template, body_template, channel)
SELECT NULL, 'DECISION_ACCEPT', 'Decision Accept Template',
       'Great news for {{candidateName}} — {{roleTitle}}',
       'Bonjour {{candidateName}},\n\nVotre candidature pour {{roleTitle}} a été retenue. Nous revenons vers vous rapidement pour la suite.\n\n— {{institutionName}}',
       'EMAIL'
WHERE NOT EXISTS (
  SELECT 1 FROM communication_templates WHERE institution_id IS NULL AND type = 'DECISION_ACCEPT'
);

INSERT INTO communication_templates (institution_id, type, title, subject_template, body_template, channel)
SELECT NULL, 'DECISION_REJECT', 'Decision Reject Template',
       'Update on your application — {{roleTitle}}',
       'Bonjour {{candidateName}},\n\nMerci pour votre candidature au poste {{roleTitle}}. Après étude, nous poursuivons avec d''autres profils.\n\n— {{institutionName}}',
       'EMAIL'
WHERE NOT EXISTS (
  SELECT 1 FROM communication_templates WHERE institution_id IS NULL AND type = 'DECISION_REJECT'
);

INSERT INTO communication_templates (institution_id, type, title, subject_template, body_template, channel)
SELECT NULL, 'DECISION_HOLD', 'Decision Hold Template',
       'Your application is on hold — {{roleTitle}}',
       'Bonjour {{candidateName}},\n\nVotre candidature pour {{roleTitle}} est en attente de décision finale. Nous vous tiendrons informé(e).\n\n— {{institutionName}}',
       'EMAIL'
WHERE NOT EXISTS (
  SELECT 1 FROM communication_templates WHERE institution_id IS NULL AND type = 'DECISION_HOLD'
);
