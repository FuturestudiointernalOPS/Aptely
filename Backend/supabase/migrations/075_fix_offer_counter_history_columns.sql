-- =============================================================================
-- 075_fix_offer_counter_history_columns.sql
-- Fix column names in offer_counter_history to match controller expectations
-- =============================================================================

ALTER TABLE offer_counter_history RENAME COLUMN counter_round TO round;
ALTER TABLE offer_counter_history RENAME COLUMN counter_status TO status;
ALTER TABLE offer_counter_history RENAME COLUMN counter_proposed_by TO proposed_by;
ALTER TABLE offer_counter_history RENAME COLUMN counter_proposed_at TO proposed_at;
ALTER TABLE offer_counter_history RENAME COLUMN counter_responded_by TO responded_by;
ALTER TABLE offer_counter_history RENAME COLUMN counter_responded_at TO responded_at;
ALTER TABLE offer_counter_history RENAME COLUMN counter_reason TO reason;
