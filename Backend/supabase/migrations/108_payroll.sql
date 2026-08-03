-- 108_payroll.sql
CREATE TYPE payroll_status AS ENUM ('DRAFT','VALIDATED','PAID');

CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year SMALLINT NOT NULL,
  status payroll_status DEFAULT 'DRAFT',
  total_gross NUMERIC(12,2),
  total_net NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(institution_id, period_month, period_year)
);

CREATE TABLE payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_salary NUMERIC(12,2) NOT NULL,
  deductions NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL,
  notes TEXT,
  payslip_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, employee_user_id)
);

CREATE INDEX ON payroll_periods(institution_id, period_year DESC, period_month DESC);
CREATE INDEX ON payroll_entries(period_id);
