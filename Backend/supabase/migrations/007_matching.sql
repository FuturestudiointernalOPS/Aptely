-- =============================================================================
-- 007_matching.sql — Résultats IA et journal d'activité
-- Dépend de : 002_profiles.sql, 003_institutions.sql, 006_applications.sql
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Table : match_results — scores détaillés par dimension IA
-- Une ligne par (application, candidate) après chaque évaluation
-- Exposé via GET /applications/:id/report
-- ──────────────────────────────────────────────────────────────

CREATE TABLE match_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Les 8 dimensions de score (0.000 - 1.000)
  -- NUMERIC(4,3) = 4 chiffres au total, 3 après la virgule → ex: 0.923
  role_fit            NUMERIC(4,3) CHECK (role_fit IS NULL OR (role_fit >= 0 AND role_fit <= 1)),
  skill_validity      NUMERIC(4,3) CHECK (skill_validity IS NULL OR (skill_validity >= 0 AND skill_validity <= 1)),
  capability_strength NUMERIC(4,3) CHECK (capability_strength IS NULL OR (capability_strength >= 0 AND capability_strength <= 1)),
  environment_fit     NUMERIC(4,3) CHECK (environment_fit IS NULL OR (environment_fit >= 0 AND environment_fit <= 1)),
  motivation_fit      NUMERIC(4,3) CHECK (motivation_fit IS NULL OR (motivation_fit >= 0 AND motivation_fit <= 1)),
  constraint_fit      NUMERIC(4,3) CHECK (constraint_fit IS NULL OR (constraint_fit >= 0 AND constraint_fit <= 1)),
  reliability_index   NUMERIC(4,3) CHECK (reliability_index IS NULL OR (reliability_index >= 0 AND reliability_index <= 1)),
  final_score         NUMERIC(4,3) CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 1)),

  -- Explications IA générées par GPT-4o
  -- {
  --   whySelected: string[],
  --   evidenceUsed: [{ type, text?, url?, signal?, contact? }],
  --   riskFlags: [{ risk, impact }],
  --   tradeoffs: string[],
  --   alignmentWithRole: { mission90Days, success6Months, keyProblems: [{ problem, fit, proof }] }
  -- }
  ai_explanation      JSONB,

  -- Niveau de confiance de l'IA dans son analyse (0.000 - 1.000)
  ai_confidence       NUMERIC(4,3) CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),

  -- Snapshot du Talent DNA au moment du matching (pour historique)
  -- Évite que des modifications ultérieures du DNA altèrent les anciens résultats
  talent_dna_snapshot JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un seul résultat par (application, candidat)
  UNIQUE(application_id, candidate_id)
);

CREATE INDEX idx_match_results_application ON match_results(application_id);
CREATE INDEX idx_match_results_candidate   ON match_results(candidate_id);
CREATE INDEX idx_match_results_final_score ON match_results(final_score DESC);

-- ──────────────────────────────────────────────────────────────
-- Table : activity_logs — journal des actions HR
-- Toutes les actions importantes sont loggées ici pour le dashboard
-- Exemples de types : ROLE_CREATED, APPLICATION_VALIDATED, HR_JOINED, HR_REMOVED
-- ──────────────────────────────────────────────────────────────

CREATE TABLE activity_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Type d'action (voir constantes dans src/modules/hr-dashboard/)
  type           TEXT NOT NULL,
  -- Message lisible par un humain (ex: "Sarah a validé Alex Rivera pour Lead Dev")
  message        TEXT NOT NULL,
  -- Données supplémentaires (roleId, applicationId pour créer des liens dans l'UI)
  -- { roleId?, applicationId?, targetUserId? }
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_institution ON activity_logs(institution_id);
CREATE INDEX idx_activity_logs_created     ON activity_logs(institution_id, created_at DESC);
