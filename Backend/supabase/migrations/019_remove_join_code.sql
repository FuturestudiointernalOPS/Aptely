-- =============================================================================
-- 019_remove_join_code.sql — Remove join_code from institutions
-- =============================================================================

ALTER TABLE institutions DROP COLUMN IF EXISTS join_code;