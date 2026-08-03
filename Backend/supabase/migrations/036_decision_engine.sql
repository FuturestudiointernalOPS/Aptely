-- =============================================================================
-- 036_decision_engine.sql — Tables pour le Decision Engine (Owner A - Sprint 3)
-- =============================================================================

-- ─── Table application_decisions ──────────────────────────────────────────────
-- Chaque décision RH est un enregistrement immutable.
-- Une même candidature peut avoir plusieurs décisions (HOLD → ACCEPT), mais
-- la state machine contrôle les transitions côté backend.
CREATE TABLE IF NOT EXISTS application_decisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  action        decision_action NOT NULL,
  reason        TEXT,
  actor_id      UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index composite pour requêtes "dernière décision d'une candidature"
CREATE INDEX idx_app_decisions_app_created
  ON application_decisions (application_id, created_at DESC);

-- Index pour filtrer par acteur (queue RH)
CREATE INDEX idx_app_decisions_actor
  ON application_decisions (actor_id);

-- ─── Table application_audit_logs ─────────────────────────────────────────────
-- Journal d'audit universel pour toutes les mutations sur les candidatures.
-- Utilisé aussi par les modules Offer et Onboarding (events communs).
CREATE TABLE IF NOT EXISTS application_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  payload_json   JSONB DEFAULT '{}'::jsonb,
  actor_id       UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index composite pour historique d'une candidature
CREATE INDEX idx_app_audit_app_created
  ON application_audit_logs (application_id, created_at DESC);

-- Index pour recherche par type d'événement
CREATE INDEX idx_app_audit_event_type
  ON application_audit_logs (event_type);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE application_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role (backend) a un accès complet via supabaseAdmin, donc pas de policy
-- restrictive nécessaire. On crée une policy permissive pour le service role uniquement.
CREATE POLICY "Service role full access on application_decisions"
  ON application_decisions
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on application_audit_logs"
  ON application_audit_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
