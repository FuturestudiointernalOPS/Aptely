-- 113_missing_updated_at_triggers.sql
-- Add updated_at auto-update triggers on the 24 tables that had the column but no trigger.
-- Reuses the existing update_updated_at() function defined in early migrations.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'calendar_integrations',
    'decision_ratifications',
    'decision_recommendations',
    'departments',
    'employee_records',
    'institution_custom_roles',
    'institution_role_permissions',
    'institution_webhooks',
    'interview_participants',
    'interview_reminder_jobs',
    'interview_scorecards',
    'interviews',
    'job_positions',
    'leave_policies',
    'offboarding_checklists',
    'payroll_entries',
    'payroll_periods',
    'performance_reviews',
    'recruitment_waves',
    'scorecard_criteria',
    'scorecard_entries',
    'scorecard_templates',
    'wave_slots',
    'wave_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END $$;
