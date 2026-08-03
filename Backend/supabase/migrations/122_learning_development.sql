-- Migration 122: Learning & Development
-- Phase 4 — Module 04: L&D Tracking

DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('assigned', 'in_progress', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('course', 'book', 'mentor', 'project', 'certification', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Learning Plans (one per employee, can have multiple)
CREATE TABLE IF NOT EXISTS learning_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title             TEXT,
  status            VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Individual learning activities within a plan
CREATE TABLE IF NOT EXISTS learning_activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  type             activity_type NOT NULL DEFAULT 'course',
  provider         TEXT,
  url              TEXT,
  estimated_hours  SMALLINT,
  status           activity_status NOT NULL DEFAULT 'assigned',
  due_date         DATE,
  completed_at     TIMESTAMPTZ,
  skill_tags       TEXT[],
  sort_order       SMALLINT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Skill gaps (compared to role requirements)
CREATE TABLE IF NOT EXISTS skill_gaps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_name        TEXT NOT NULL,
  current_level     SMALLINT CHECK (current_level >= 0 AND current_level <= 5),
  required_level    SMALLINT CHECK (required_level >= 0 AND required_level <= 5),
  gap_priority      VARCHAR(10) CHECK (gap_priority IN ('LOW', 'MEDIUM', 'HIGH')),
  role_id           UUID REFERENCES roles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, employee_user_id, skill_name)
);

CREATE INDEX IF NOT EXISTS learning_plans_institution_idx ON learning_plans(institution_id);
CREATE INDEX IF NOT EXISTS learning_plans_employee_idx ON learning_plans(employee_user_id);
CREATE INDEX IF NOT EXISTS learning_activities_plan_idx ON learning_activities(plan_id);
CREATE INDEX IF NOT EXISTS learning_activities_status_idx ON learning_activities(status);
CREATE INDEX IF NOT EXISTS skill_gaps_employee_idx ON skill_gaps(employee_user_id);
CREATE INDEX IF NOT EXISTS skill_gaps_institution_idx ON skill_gaps(institution_id);

DROP TRIGGER IF EXISTS learning_plans_updated_at ON learning_plans;
CREATE TRIGGER learning_plans_updated_at BEFORE UPDATE ON learning_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS learning_activities_updated_at ON learning_activities;
CREATE TRIGGER learning_activities_updated_at BEFORE UPDATE ON learning_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_gaps ENABLE ROW LEVEL SECURITY;

-- HR sees all plans in institution; employee sees own
CREATE POLICY "learning_plans_read" ON learning_plans FOR SELECT
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status != 'SUSPENDED'
  ));

CREATE POLICY "learning_plans_write" ON learning_plans FOR ALL
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));

CREATE POLICY "learning_activities_via_plan" ON learning_activities FOR ALL
  USING (plan_id IN (
    SELECT id FROM learning_plans WHERE institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  ));

CREATE POLICY "skill_gaps_read" ON skill_gaps FOR SELECT
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status != 'SUSPENDED'
  ));

CREATE POLICY "skill_gaps_write" ON skill_gaps FOR ALL
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));
