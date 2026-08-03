-- =============================================================================
-- 058_applications_notes_and_aliases.sql
-- Adds notes column to applications (referenced in code but missing from schema)
-- =============================================================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT;
