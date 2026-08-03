-- 107: offboarding checklists

CREATE TYPE offboarding_reason AS ENUM (
  'RESIGNATION','TERMINATION','END_OF_CONTRACT','RETIREMENT','OTHER'
);

CREATE TABLE offboarding_checklists (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason              offboarding_reason NOT NULL,
  last_day            DATE,
  exit_interview_done BOOLEAN NOT NULL DEFAULT false,
  tasks_json          JSONB NOT NULL DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, employee_user_id)
);

CREATE INDEX idx_offboarding_institution ON offboarding_checklists(institution_id);

ALTER TABLE offboarding_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offboarding_select_own_or_hr"
  ON offboarding_checklists FOR SELECT
  USING (
    employee_user_id = auth.uid()
    OR institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER','ADMIN')
    )
  );
