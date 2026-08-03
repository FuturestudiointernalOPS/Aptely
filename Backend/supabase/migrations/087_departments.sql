-- 087: departments table for company org structure
CREATE TABLE departments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  parent_department_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  manager_user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_institution ON departments(institution_id);
CREATE INDEX idx_departments_parent ON departments(parent_department_id);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view departments"
  ON departments FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN', 'ACTIVE')
    )
  );

CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN')
    )
  );
