-- JSON-only migration for role form data and application guest identity payloads

-- Roles: drop structured form columns (kept in role_dna.full_form_json)
DROP INDEX IF EXISTS idx_roles_title;

ALTER TABLE public.roles
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS application_form,
  DROP COLUMN IF EXISTS auto_evaluate;

-- Role DNA: keep only full_form_json for role form payload
ALTER TABLE public.role_dna
  DROP COLUMN IF EXISTS mission_90_days,
  DROP COLUMN IF EXISTS success_6_months,
  DROP COLUMN IF EXISTS key_problems,
  DROP COLUMN IF EXISTS constraints,
  DROP COLUMN IF EXISTS team_context,
  DROP COLUMN IF EXISTS candidate_profile,
  DROP COLUMN IF EXISTS dealbreakers,
  DROP COLUMN IF EXISTS evaluation_context;

-- Applications: guest identity remains in dna_snapshot.talent_identity
DROP INDEX IF EXISTS unique_guest_email_per_role;

ALTER TABLE public.applications
  DROP COLUMN IF EXISTS guest_email,
  DROP COLUMN IF EXISTS guest_name,
  DROP COLUMN IF EXISTS guest_cv_url;
