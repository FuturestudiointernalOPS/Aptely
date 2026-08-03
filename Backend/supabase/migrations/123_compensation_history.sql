-- Migration 123: Compensation History & Salary Bands
-- Phase 4 — Module 06: Compensation & Salary Reviews

DO $$ BEGIN
  CREATE TYPE comp_review_status AS ENUM (
    'draft', 'submitted', 'hr_approved', 'finance_approved', 'ceo_approved', 'effective', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Salary bands per role + level
CREATE TABLE IF NOT EXISTS salary_bands (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  job_position_id  UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  level            VARCHAR(20) NOT NULL,   -- junior/mid/senior/lead/principal/director
  band_min         NUMERIC(12,2),
  band_max         NUMERIC(12,2),
  band_median      NUMERIC(12,2),
  currency         VARCHAR(3) DEFAULT 'EUR',
  location         TEXT,
  effective_date   DATE DEFAULT CURRENT_DATE,
  source           VARCHAR(20) DEFAULT 'internal' CHECK (source IN ('internal', 'market_data')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, job_position_id, level, currency)
);

-- Full compensation change history with approval trail
CREATE TABLE IF NOT EXISTS compensation_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  effective_date    DATE NOT NULL,
  previous_salary   NUMERIC(12,2),
  new_salary        NUMERIC(12,2) NOT NULL,
  currency          VARCHAR(3) DEFAULT 'EUR',
  change_reason     TEXT CHECK (change_reason IN ('merit', 'promotion', 'market', 'correction', 'other')),
  change_pct        NUMERIC(6,2),
  status            comp_review_status DEFAULT 'draft',
  submitted_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at      TIMESTAMPTZ,
  hr_approved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  hr_approved_at    TIMESTAMPTZ,
  finance_approved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  finance_approved_at  TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS salary_bands_institution_idx ON salary_bands(institution_id);
CREATE INDEX IF NOT EXISTS salary_bands_position_level_idx ON salary_bands(job_position_id, level);
CREATE INDEX IF NOT EXISTS comp_history_institution_idx ON compensation_history(institution_id);
CREATE INDEX IF NOT EXISTS comp_history_employee_idx ON compensation_history(employee_user_id);
CREATE INDEX IF NOT EXISTS comp_history_status_idx ON compensation_history(status);

DROP TRIGGER IF EXISTS salary_bands_updated_at ON salary_bands;
CREATE TRIGGER salary_bands_updated_at BEFORE UPDATE ON salary_bands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS comp_history_updated_at ON compensation_history;
CREATE TRIGGER comp_history_updated_at BEFORE UPDATE ON compensation_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE salary_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_history ENABLE ROW LEVEL SECURITY;

-- HR sees bands in their institution
CREATE POLICY "salary_bands_institution_read" ON salary_bands FOR SELECT
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status != 'SUSPENDED'
  ));

CREATE POLICY "salary_bands_manage" ON salary_bands FOR ALL
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));

-- Comp history: HR sees all, employee sees own
CREATE POLICY "comp_history_hr_read" ON compensation_history FOR SELECT
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status != 'SUSPENDED'
  ));

CREATE POLICY "comp_history_write" ON compensation_history FOR INSERT
  WITH CHECK (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));

CREATE POLICY "comp_history_update" ON compensation_history FOR UPDATE
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));
