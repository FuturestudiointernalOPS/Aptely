-- CV Studio: RLS policies for defense in depth

-- cv_analyses: candidates see own analyses
CREATE POLICY "cv_analyses_select_own" ON cv_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cv_analyses_delete_own" ON cv_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- cv_analysis_modules: candidates see modules for own analyses
CREATE POLICY "cv_modules_select_own" ON cv_analysis_modules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cv_analyses WHERE id = cv_analysis_modules.analysis_id AND user_id = auth.uid())
  );

-- cv_studio_exports: candidates see exports for own analyses
CREATE POLICY "cv_exports_select_own" ON cv_studio_exports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cv_analyses WHERE id = cv_studio_exports.analysis_id AND user_id = auth.uid())
  );
