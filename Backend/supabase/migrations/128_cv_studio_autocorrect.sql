-- CV Studio: Auto-correction module + export table

-- 1. Update module_key CHECK to add 'auto_correction'
ALTER TABLE cv_analysis_modules DROP CONSTRAINT IF EXISTS cv_analysis_modules_module_key_check;
ALTER TABLE cv_analysis_modules ADD CONSTRAINT cv_analysis_modules_module_key_check
  CHECK (module_key IN (
    'visual', 'coherence', 'linguistic', 'impact',
    'completeness', 'job_fit', 'country', 'ats', 'credibility',
    'auto_correction'
  ));

-- 2. Exports table for corrected CV files (PDF/DOCX)
CREATE TABLE IF NOT EXISTS cv_studio_exports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id       UUID NOT NULL REFERENCES cv_analyses(id) ON DELETE CASCADE,
  export_type       VARCHAR(10) NOT NULL CHECK (export_type IN ('pdf', 'docx')),
  storage_path      TEXT NOT NULL,
  original_text     TEXT,
  corrected_text    TEXT NOT NULL,
  corrections_json  JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_studio_exports_analysis ON cv_studio_exports(analysis_id);
ALTER TABLE cv_studio_exports ENABLE ROW LEVEL SECURITY;
