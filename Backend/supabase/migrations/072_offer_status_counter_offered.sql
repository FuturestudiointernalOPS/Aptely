-- =============================================================================
-- 072_offer_status_counter_offered.sql
-- Phase F — Add COUNTER_OFFERED status to offer_status enum
-- Allows tracking offers awaiting HR response to candidate counter-proposal
-- =============================================================================

ALTER TYPE offer_status ADD VALUE 'COUNTER_OFFERED' BEFORE 'REJECTED';
