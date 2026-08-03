-- =============================================================================
-- 055_prep_reflections.sql — AI Prep Briefs + Interview Reflections
-- Dépend de : 050_identity_rework.sql, 024_interviews_core.sql, 006_applications.sql
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Table : prep_briefs — cached AI prep guide per application
-- ──────────────────────────────────────────────────────────────
CREATE TABLE prep_briefs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  individual_profile_id UUID        NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  application_id        UUID        NOT NULL REFERENCES applications(id)         ON DELETE CASCADE,
  role_title            TEXT        NOT NULL,
  institution_name      TEXT        NOT NULL,
  brief                 JSONB       NOT NULL DEFAULT '{}',
  questions             JSONB       NOT NULL DEFAULT '[]',
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(individual_profile_id, application_id)
);

CREATE INDEX idx_prep_briefs_individual ON prep_briefs(individual_profile_id);
CREATE INDEX idx_prep_briefs_application ON prep_briefs(application_id);

-- ──────────────────────────────────────────────────────────────
-- Table : interview_reflections — post-interview self-assessment
-- ──────────────────────────────────────────────────────────────
CREATE TABLE interview_reflections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id          UUID        NOT NULL REFERENCES interviews(id)           ON DELETE CASCADE,
  individual_profile_id UUID        NOT NULL REFERENCES individual_profiles(id)  ON DELETE CASCADE,
  overall_rating        SMALLINT    CHECK (overall_rating BETWEEN 1 AND 5),
  strengths_displayed   TEXT,
  areas_to_improve      TEXT,
  key_takeaways         TEXT,
  follow_up_actions     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(interview_id, individual_profile_id)
);

CREATE INDEX idx_reflections_interview   ON interview_reflections(interview_id);
CREATE INDEX idx_reflections_individual  ON interview_reflections(individual_profile_id);

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────
ALTER TABLE prep_briefs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_reflections ENABLE ROW LEVEL SECURITY;

-- prep_briefs: owner only
CREATE POLICY prep_briefs_owner ON prep_briefs
  FOR ALL USING (
    individual_profile_id IN (
      SELECT id FROM individual_profiles WHERE profile_id = auth.uid()
    )
  );

-- interview_reflections: owner only
CREATE POLICY reflections_owner ON interview_reflections
  FOR ALL USING (
    individual_profile_id IN (
      SELECT id FROM individual_profiles WHERE profile_id = auth.uid()
    )
  );
