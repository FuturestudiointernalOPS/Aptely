-- =============================================================================
-- 038_onboarding_engine.sql — Tables pour Onboarding Tasks Engine (Owner A - Sprint 5)
-- =============================================================================

-- ─── Table onboarding_templates ───────────────────────────────────────────────
-- Templates de checklist réutilisables, créés par les RH pour leur institution.
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  tasks_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index par institution
CREATE INDEX idx_onboarding_templates_institution
  ON onboarding_templates (institution_id);

-- ─── Table onboarding_checklists ──────────────────────────────────────────────
-- Instance d'une checklist pour un candidat spécifique après acceptation de l'offre.
CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES onboarding_templates(id) ON DELETE SET NULL,
  status          onboarding_status NOT NULL DEFAULT 'NOT_STARTED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un seul checklist par candidature
CREATE UNIQUE INDEX idx_onboarding_checklists_application
  ON onboarding_checklists (application_id);

-- ─── Table onboarding_tasks ───────────────────────────────────────────────────
-- Tâches individuelles au sein d'une checklist d'onboarding.
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES onboarding_checklists(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  assignee_type   TEXT NOT NULL DEFAULT 'CANDIDATE',  -- 'CANDIDATE' | 'HR'
  position        INT NOT NULL DEFAULT 0,
  status          onboarding_task_status NOT NULL DEFAULT 'PENDING',
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour lister les tâches d'une checklist avec filtrage par statut
CREATE INDEX idx_onboarding_tasks_checklist_status
  ON onboarding_tasks (checklist_id, status);

-- ─── Trigger pour auto-update updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_onboarding_checklists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_onboarding_checklists_updated_at
  BEFORE UPDATE ON onboarding_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_checklists_updated_at();

CREATE OR REPLACE FUNCTION update_onboarding_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_onboarding_tasks_updated_at
  BEFORE UPDATE ON onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_tasks_updated_at();

CREATE OR REPLACE FUNCTION update_onboarding_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_onboarding_templates_updated_at
  BEFORE UPDATE ON onboarding_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_templates_updated_at();

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on onboarding_templates"
  ON onboarding_templates FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on onboarding_checklists"
  ON onboarding_checklists FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on onboarding_tasks"
  ON onboarding_tasks FOR ALL USING (true) WITH CHECK (true);
