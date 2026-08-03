-- Drop NOT NULL constraints to allow guest applications
ALTER TABLE applications ALTER COLUMN candidate_id DROP NOT NULL;
ALTER TABLE match_results ALTER COLUMN candidate_id DROP NOT NULL;
ALTER TABLE sorted_talents ALTER COLUMN candidate_id DROP NOT NULL;

-- Add Guest metadata tracking to applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guest_cv_url TEXT;

-- Ensure an email can only apply once to a role (if they apply as guest)
CREATE UNIQUE INDEX IF NOT EXISTS unique_guest_email_per_role ON applications (guest_email, role_id) WHERE guest_email IS NOT NULL;

-- Fix uniqueness (application_id should be strictly unique on its own anyway)
ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_application_id_candidate_id_key;
ALTER TABLE match_results ADD CONSTRAINT match_results_application_id_key UNIQUE (application_id);

ALTER TABLE sorted_talents DROP CONSTRAINT IF EXISTS sorted_talents_application_id_candidate_id_key;
ALTER TABLE sorted_talents ADD CONSTRAINT sorted_talents_application_id_key UNIQUE (application_id);
