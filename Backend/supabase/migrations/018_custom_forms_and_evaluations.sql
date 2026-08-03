-- Add custom application form structure to roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS application_form JSONB;

-- Add evaluation instructions to role_dna
ALTER TABLE role_dna ADD COLUMN IF NOT EXISTS evaluation_context TEXT;

-- Add form answers to applications tracking
ALTER TABLE applications ADD COLUMN IF NOT EXISTS answers JSONB;
