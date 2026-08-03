-- Enable RLS on 7 tables flagged by scripts/check-rls.js audit
ALTER TABLE email_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_reminder_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

-- Policies: all these tables are accessed via supabaseAdmin (service role)
-- which bypasses RLS. RLS enabled here as defense-in-depth so anon/user
-- JWTs cannot read them even if a code path accidentally uses req.db.
