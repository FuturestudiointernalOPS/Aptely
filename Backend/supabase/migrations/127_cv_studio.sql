-- CV Studio: AI-powered CV analysis center (modules 1-9)

CREATE TABLE IF NOT EXISTS cv_analyses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id             UUID,
  file_name           TEXT NOT NULL,
  file_storage_path   TEXT NOT NULL,
  extracted_text      TEXT,
  target_country      VARCHAR(80),
  target_job_title    TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  overall_score       SMALLINT CHECK (overall_score >= 0 AND overall_score <= 100),
  initiated_by        VARCHAR(12) NOT NULL DEFAULT 'candidate'
                      CHECK (initiated_by IN ('candidate', 'hr')),
  initiated_by_user   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_analyses_user_id ON cv_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_status ON cv_analyses(status);

CREATE TABLE IF NOT EXISTS cv_analysis_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID NOT NULL REFERENCES cv_analyses(id) ON DELETE CASCADE,
  module_key      VARCHAR(30) NOT NULL
                  CHECK (module_key IN (
                    'visual', 'coherence', 'linguistic', 'impact',
                    'completeness', 'job_fit', 'country', 'ats', 'credibility'
                  )),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  score           SMALLINT CHECK (score >= 0 AND score <= 100),
  result_json     JSONB,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (analysis_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_cv_analysis_modules_analysis_id ON cv_analysis_modules(analysis_id);

ALTER TABLE cv_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_analysis_modules ENABLE ROW LEVEL SECURITY;
