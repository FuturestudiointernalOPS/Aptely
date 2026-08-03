-- 089: enrich institution_members with org hierarchy fields
ALTER TABLE institution_members
  ADD COLUMN IF NOT EXISTS department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_institution_members_department  ON institution_members(department_id);
CREATE INDEX idx_institution_members_job_position ON institution_members(job_position_id);
CREATE INDEX idx_institution_members_manager     ON institution_members(manager_user_id);
