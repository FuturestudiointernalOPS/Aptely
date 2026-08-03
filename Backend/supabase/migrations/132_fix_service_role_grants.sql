-- Fix: service_role missing table-level GRANTs on PROD
-- Root cause: default privileges were not set when these tables were created.
-- PostgREST respects table privileges even for BYPASSRLS roles like service_role.

-- Set default privileges so all future tables auto-grant to service_role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- Grant on all existing tables missing service_role access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_status_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compensation_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cv_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cv_analysis_modules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cv_studio_exports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_ratifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_recommendations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_signers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.endorsements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_commitments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_session_responses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_validations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.individual_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_custom_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_modules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_webhooks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_reflections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_positions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.key_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_activities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_policies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_availabilities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_threads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offboarding_checklists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_approvals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_counter_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_signing_steps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prep_briefs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_export_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruitment_waves TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_risk_scores TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_signals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_bands TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_gaps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_proofs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_references TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wave_candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wave_slot_bookings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wave_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wave_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_evidence TO service_role;
