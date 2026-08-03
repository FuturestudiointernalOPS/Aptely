-- 088: job_positions — defines roles/titles within a company
CREATE TABLE job_positions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  department_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  module_access  TEXT[] NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_positions_institution ON job_positions(institution_id);
CREATE INDEX idx_job_positions_department ON job_positions(department_id);

ALTER TABLE job_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view job positions"
  ON job_positions FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN', 'ACTIVE')
    )
  );

CREATE POLICY "Admins can manage job positions"
  ON job_positions FOR ALL
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN')
    )
  );
