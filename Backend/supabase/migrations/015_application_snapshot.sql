-- =============================================================================
-- 015_application_snapshot.sql — Add dna_snapshot to applications
-- =============================================================================

ALTER TABLE applications ADD COLUMN dna_snapshot JSONB;
