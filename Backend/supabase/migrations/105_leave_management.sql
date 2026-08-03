-- 105: leave management — policies + requests

CREATE TYPE leave_type AS ENUM ('VACATION','SICK','UNPAID','PARENTAL','OTHER');
CREATE TYPE leave_status AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');

CREATE TABLE leave_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  leave_type        leave_type NOT NULL,
  days_per_year     NUMERIC(5,1) NOT NULL DEFAULT 25,
  carry_over_days   NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, leave_type)
);

CREATE TABLE leave_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type          leave_type NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  days_count          NUMERIC(5,1) NOT NULL,
  reason              TEXT,
  status              leave_status NOT NULL DEFAULT 'PENDING',
  reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_note         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_institution ON leave_requests(institution_id);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_user_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(institution_id, status);

ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_policies_select_member"
  ON leave_policies FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER','ADMIN','ACTIVE')
    )
  );

CREATE POLICY "leave_requests_select_own_or_hr"
  ON leave_requests FOR SELECT
  USING (
    employee_user_id = auth.uid()
    OR institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER','ADMIN')
    )
  );
