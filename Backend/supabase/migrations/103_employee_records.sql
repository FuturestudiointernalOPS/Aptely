-- 103: employee records table — post-hire employee lifecycle
-- Created when application.status → HIRED (auto-hook in applications.controller.ts)

CREATE TYPE employment_type AS ENUM ('CDI', 'CDD', 'FREELANCE', 'INTERNSHIP', 'PART_TIME');
CREATE TYPE employment_status AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

CREATE TABLE employee_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id    UUID        REFERENCES applications(id) ON DELETE SET NULL,
  job_position_id   UUID        REFERENCES job_positions(id) ON DELETE SET NULL,
  department_id     UUID        REFERENCES departments(id) ON DELETE SET NULL,
  manager_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  employment_type   employment_type NOT NULL DEFAULT 'CDI',
  employment_status employment_status NOT NULL DEFAULT 'ACTIVE',
  start_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE,
  salary_amount     NUMERIC(12,2),
  salary_currency   TEXT        NOT NULL DEFAULT 'EUR',
  contract_notes    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, user_id)
);

CREATE INDEX idx_employee_records_institution ON employee_records(institution_id);
CREATE INDEX idx_employee_records_user ON employee_records(user_id);
CREATE INDEX idx_employee_records_status ON employee_records(institution_id, employment_status);

ALTER TABLE employee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view employees in their institution"
  ON employee_records FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN', 'ACTIVE')
    )
  );

CREATE POLICY "Admins can manage employee records"
  ON employee_records FOR ALL
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN')
    )
  );
