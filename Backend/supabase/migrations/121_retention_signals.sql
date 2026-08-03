-- Migration 121: Retention Risk Signals
-- Phase 4 — Module 03: Retention & Churn Risk

CREATE TABLE IF NOT EXISTS retention_signals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signal_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  perf_trend            SMALLINT,          -- -2 (fort déclin) à +2 (progression)
  goal_alignment_score  SMALLINT,          -- 0-100
  ld_inactive_days      SMALLINT,          -- jours sans activité L&D
  comp_gap_pct          SMALLINT,          -- % sous la médiane de la bande
  tenure_months         SMALLINT,
  peer_departures       SMALLINT,          -- départs dans l'équipe sur 90j
  feedback_sentiment    NUMERIC(4,3),      -- -1.000 à 1.000
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retention_risk_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score             SMALLINT NOT NULL CHECK (score >= 0 AND score <= 100),
  level             VARCHAR(10) NOT NULL CHECK (level IN ('LOW', 'MEDIUM', 'HIGH')),
  computed_at       TIMESTAMPTZ DEFAULT NOW(),
  flags             JSONB,
  UNIQUE(institution_id, employee_user_id)
);

CREATE INDEX IF NOT EXISTS retention_signals_institution_idx ON retention_signals(institution_id);
CREATE INDEX IF NOT EXISTS retention_signals_employee_idx ON retention_signals(employee_user_id);
CREATE INDEX IF NOT EXISTS retention_signals_date_idx ON retention_signals(signal_date);
CREATE INDEX IF NOT EXISTS retention_risk_institution_idx ON retention_risk_scores(institution_id);
CREATE INDEX IF NOT EXISTS retention_risk_level_idx ON retention_risk_scores(level);

ALTER TABLE retention_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_risk_scores ENABLE ROW LEVEL SECURITY;

-- HR sees all signals in their institution; employee sees own
CREATE POLICY "retention_signals_hr_read" ON retention_signals FOR SELECT
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status != 'SUSPENDED'
  ));

CREATE POLICY "retention_signals_insert" ON retention_signals FOR INSERT
  WITH CHECK (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));

CREATE POLICY "retention_risk_scores_hr_read" ON retention_risk_scores FOR SELECT
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status != 'SUSPENDED'
  ));

CREATE POLICY "retention_risk_scores_upsert" ON retention_risk_scores FOR ALL
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));
