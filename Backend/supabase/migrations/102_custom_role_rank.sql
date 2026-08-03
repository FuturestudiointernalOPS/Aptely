-- =============================================================================
-- 102_custom_role_rank.sql
-- Each custom role carries its own authority rank (1..99). The actor's rank
-- must strictly exceed both the target's rank AND the assigned role's rank.
-- Built-in ranks live in code (ROLE_RANK). 100 is reserved for OWNER.
-- =============================================================================

ALTER TABLE institution_custom_roles
  ADD COLUMN IF NOT EXISTS rank int NOT NULL DEFAULT 15
    CHECK (rank BETWEEN 1 AND 99);
