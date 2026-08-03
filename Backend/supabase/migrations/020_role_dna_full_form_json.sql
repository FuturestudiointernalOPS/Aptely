ALTER TABLE public.role_dna
ADD COLUMN IF NOT EXISTS full_form_json jsonb;

COMMENT ON COLUMN public.role_dna.full_form_json IS 'Full role creation form snapshot for exact edit replay';
