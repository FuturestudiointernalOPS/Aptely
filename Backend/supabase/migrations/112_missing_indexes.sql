-- 112_missing_indexes.sql
-- Add indexes on FK UUID columns that had none (verified via live DB query).
-- All use IF NOT EXISTS to be idempotent.

CREATE INDEX IF NOT EXISTS idx_app_audit_actor ON application_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_app_decisions_ratified_by ON application_decisions(ratified_by_user_id);
CREATE INDEX IF NOT EXISTS idx_app_decisions_recommendation_by ON application_decisions(recommendation_user_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_user ON document_signers(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_app ON employee_records(application_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_dept ON employee_records(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_pos ON employee_records(job_position_id);
CREATE INDEX IF NOT EXISTS idx_employee_records_manager ON employee_records(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_job_pos ON institution_invitations(job_position_id);
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_interview ON interview_reminder_jobs(interview_id);
CREATE INDEX IF NOT EXISTS idx_notifications_institution ON notifications(institution_id);
CREATE INDEX IF NOT EXISTS idx_offer_approvals_approver ON offer_approvals(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_offer_audit_actor ON offer_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_offer_negotiations_actor ON offer_negotiations(actor_id);
CREATE INDEX IF NOT EXISTS idx_offer_signing_signer ON offer_signing_steps(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_offer_versions_author ON offer_versions(author_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_candidate ON onboarding_documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_perf_reviews_reviewer ON performance_reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_waves_prerequisite ON recruitment_waves(prerequisite_wave_id);
CREATE INDEX IF NOT EXISTS idx_waves_template ON recruitment_waves(template_id);
CREATE INDEX IF NOT EXISTS idx_wave_candidates_booking ON wave_candidates(booking_id);
CREATE INDEX IF NOT EXISTS idx_work_evidence_skill_proof ON work_evidence(skill_proof_id);
