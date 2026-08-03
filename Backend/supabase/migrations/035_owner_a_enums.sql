-- =============================================================================
-- 035_owner_a_enums.sql — Enums métier pour Owner A (Decision, Offer, Onboarding)
-- =============================================================================

-- Action de décision RH sur une candidature
CREATE TYPE decision_action AS ENUM (
  'ACCEPT',
  'REJECT',
  'HOLD'
);

-- Statut d'une offre contractuelle
CREATE TYPE offer_status AS ENUM (
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED'
);

-- Statut d'avancement de l'onboarding
CREATE TYPE onboarding_status AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED'
);

-- Statut individuel d'une tâche onboarding
CREATE TYPE onboarding_task_status AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED'
);
