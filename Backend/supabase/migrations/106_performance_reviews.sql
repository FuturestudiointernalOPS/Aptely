-- 106: performance reviews — employee evaluations

CREATE TYPE review_period AS ENUM ('Q1','Q2','Q3','Q4','ANNUAL','PROBATION');
CREATE TYPE review_status AS ENUM ('DRAFT','SUBMITTED','ACKNOWLEDGED');

CREATE TABLE performance_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  employee_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period              review_period NOT NULL,
  year                SMALLINT NOT NULL,
  overall_rating      SMALLINT CHECK (overall_rating BETWEEN 1 AND 5),
  strengths           TEXT,
  improvements        TEXT,
  goals_next_period   TEXT,
  status              review_status NOT NULL DEFAULT 'DRAFT',
  submitted_at        TIMESTAMPTZ,
  acknowledged_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_perf_reviews_institution ON performance_reviews(institution_id);
CREATE INDEX idx_perf_reviews_employee ON performance_reviews(employee_user_id);

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_reviews_select_own_or_hr"
  ON performance_reviews FOR SELECT
  USING (
    employee_user_id = auth.uid()
    OR reviewer_user_id = auth.uid()
    OR institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER','ADMIN')
    )
  );
