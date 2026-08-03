-- Performance cleanup based on Supabase advisors

-- 1) Covering index for foreign key sorted_talents(candidate_id)
CREATE INDEX IF NOT EXISTS idx_sorted_talents_candidate_id
  ON public.sorted_talents(candidate_id);

-- 2) Remove duplicate indexes reported by advisor
DROP INDEX IF EXISTS public.idx_sorted_talents_application_id;

ALTER TABLE public.talent_dna
  DROP CONSTRAINT IF EXISTS talent_dna_candidate_id_unique;
