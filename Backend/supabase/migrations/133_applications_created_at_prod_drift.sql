-- Fix: PROD applications table has `submitted_at` but backend code queries `created_at`
-- DEV has `created_at`. This migration aligns PROD by adding created_at from submitted_at.
-- Safe to run on both environments (ADD COLUMN IF NOT EXISTS, conditional backfill).

DO $$
BEGIN
  -- Add created_at if missing (PROD case)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

    -- Backfill from submitted_at if it exists (PROD has submitted_at)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'submitted_at'
    ) THEN
      UPDATE public.applications SET created_at = submitted_at WHERE created_at IS NULL;
    END IF;
  END IF;
END $$;

-- Index for ORDER BY and range queries (safe on both envs)
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications(created_at);
