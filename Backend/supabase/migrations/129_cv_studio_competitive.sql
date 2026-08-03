-- CV Studio: Add competitive analysis module key

ALTER TABLE cv_analysis_modules DROP CONSTRAINT IF EXISTS cv_analysis_modules_module_key_check;
ALTER TABLE cv_analysis_modules ADD CONSTRAINT cv_analysis_modules_module_key_check
  CHECK (module_key IN (
    'visual', 'coherence', 'linguistic', 'impact',
    'completeness', 'job_fit', 'country', 'ats', 'credibility',
    'competitive', 'auto_correction'
  ));
