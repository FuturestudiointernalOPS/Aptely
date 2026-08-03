-- 048_add_calendar_integrations_unique_constraint.sql
-- Fix: Add missing unique constraint on calendar_integrations table
-- The 026 migration may have failed to apply the constraint completely

-- Check if the constraint already exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'calendar_integrations'
    AND constraint_name = 'calendar_integrations_user_provider_unique'
    AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_user_provider_unique UNIQUE (user_id, provider);
    
    RAISE NOTICE 'Added missing unique constraint on calendar_integrations(user_id, provider)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on calendar_integrations(user_id, provider)';
  END IF;
END
$$;
