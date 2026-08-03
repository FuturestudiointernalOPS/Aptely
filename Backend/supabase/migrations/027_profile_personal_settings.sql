-- 027_profile_personal_settings.sql
-- Store user-level personal preferences in profiles

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS personal_settings_json jsonb NOT NULL DEFAULT '{}'::jsonb;
