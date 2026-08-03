-- Migration 120: Goals & OKRs
-- Phase 4 — Module 02: Goal Setting (OKRs / KPIs)
-- Inspired by Lovable MVP "Kickoff OS" pattern

-- ─── Enum types ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE goal_scope AS ENUM ('company', 'team', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE paci_role AS ENUM ('pilote', 'approbateur', 'contributeur', 'informe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE goal_task_status AS ENUM ('todo', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kr_status AS ENUM ('on_track', 'at_risk', 'off_track', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Goals ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  objective         TEXT NOT NULL,
  description       TEXT,
  scope             goal_scope NOT NULL DEFAULT 'individual',
  owner_user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_goal_id    UUID REFERENCES goals(id) ON DELETE SET NULL,
  start_date        DATE,
  due_date          DATE,
  status            goal_status NOT NULL DEFAULT 'draft',
  icebreaker_theme  TEXT,
  session_code      VARCHAR(8) UNIQUE,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Key Results ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS key_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  kpi           TEXT NOT NULL,
  target_value  TEXT,
  current_value TEXT,
  status        kr_status NOT NULL DEFAULT 'on_track',
  sort_order    SMALLINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Goal Tasks ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goal_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  key_result_id   UUID REFERENCES key_results(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  owner_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status          goal_task_status NOT NULL DEFAULT 'todo',
  start_date      DATE,
  due_date        DATE,
  sort_order      SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PACI Roles ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goal_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        paci_role NOT NULL,
  focus_area  TEXT,
  UNIQUE(goal_id, user_id, role)
);

-- ─── Commitments & Validations ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goal_commitments (
  goal_id       UUID REFERENCES goals(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  committed_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (goal_id, user_id)
);

CREATE TABLE IF NOT EXISTS goal_validations (
  goal_id       UUID REFERENCES goals(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  validated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (goal_id, user_id)
);

-- ─── Live Sessions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS goal_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  facilitator_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_step    TEXT DEFAULT 'icebreaker',
  status          VARCHAR(20) DEFAULT 'live',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_session_responses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES goal_sessions(id) ON DELETE CASCADE,
  participant_name  TEXT NOT NULL,
  step              TEXT NOT NULL,
  response_text     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS goals_institution_id_idx ON goals(institution_id);
CREATE INDEX IF NOT EXISTS goals_owner_user_id_idx ON goals(owner_user_id);
CREATE INDEX IF NOT EXISTS goals_parent_goal_id_idx ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS goals_status_idx ON goals(status);
CREATE INDEX IF NOT EXISTS key_results_goal_id_idx ON key_results(goal_id);
CREATE INDEX IF NOT EXISTS goal_tasks_goal_id_idx ON goal_tasks(goal_id);
CREATE INDEX IF NOT EXISTS goal_tasks_owner_id_idx ON goal_tasks(owner_id);
CREATE INDEX IF NOT EXISTS goal_roles_goal_id_idx ON goal_roles(goal_id);
CREATE INDEX IF NOT EXISTS goal_roles_user_id_idx ON goal_roles(user_id);
CREATE INDEX IF NOT EXISTS goal_sessions_goal_id_idx ON goal_sessions(goal_id);

-- ─── updated_at triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS key_results_updated_at ON key_results;
CREATE TRIGGER key_results_updated_at BEFORE UPDATE ON key_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS goal_tasks_updated_at ON goal_tasks;
CREATE TRIGGER goal_tasks_updated_at BEFORE UPDATE ON goal_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_session_responses ENABLE ROW LEVEL SECURITY;

-- Institution members can read goals in their institution
CREATE POLICY "goals_institution_read" ON goals FOR SELECT
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status != 'SUSPENDED'
  ));

CREATE POLICY "goals_institution_insert" ON goals FOR INSERT
  WITH CHECK (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));

CREATE POLICY "goals_institution_update" ON goals FOR UPDATE
  USING (institution_id IN (
    SELECT institution_id FROM institution_members
    WHERE user_id = auth.uid() AND status NOT IN ('SUSPENDED', 'PENDING')
  ));

-- Key results: scoped via goal
CREATE POLICY "key_results_via_goal" ON key_results FOR ALL
  USING (goal_id IN (
    SELECT id FROM goals WHERE institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  ));

-- Goal tasks: scoped via goal
CREATE POLICY "goal_tasks_via_goal" ON goal_tasks FOR ALL
  USING (goal_id IN (
    SELECT id FROM goals WHERE institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  ));

-- Goal roles: scoped via goal
CREATE POLICY "goal_roles_via_goal" ON goal_roles FOR ALL
  USING (goal_id IN (
    SELECT id FROM goals WHERE institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  ));

-- Sessions: scoped via goal
CREATE POLICY "goal_sessions_via_goal" ON goal_sessions FOR ALL
  USING (goal_id IN (
    SELECT id FROM goals WHERE institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  ));

-- Responses: anyone with session access
CREATE POLICY "goal_session_responses_via_session" ON goal_session_responses FOR ALL
  USING (session_id IN (
    SELECT gs.id FROM goal_sessions gs
    JOIN goals g ON g.id = gs.goal_id
    JOIN institution_members im ON im.institution_id = g.institution_id
    WHERE im.user_id = auth.uid() AND im.status != 'SUSPENDED'
  ));

-- Commitments/validations: scoped via goal
CREATE POLICY "goal_commitments_via_goal" ON goal_commitments FOR ALL
  USING (goal_id IN (
    SELECT id FROM goals WHERE institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  ));

CREATE POLICY "goal_validations_via_goal" ON goal_validations FOR ALL
  USING (goal_id IN (
    SELECT id FROM goals WHERE institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status != 'SUSPENDED'
    )
  ));
