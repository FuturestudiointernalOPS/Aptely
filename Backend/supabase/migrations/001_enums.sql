-- =============================================================================
-- 001_enums.sql — Tous les types énumérés d'Aptely
-- À exécuter EN PREMIER : les autres tables dépendent de ces types.
-- =============================================================================

-- Rôle utilisateur
CREATE TYPE user_role AS ENUM (
  'HR',
  'CANDIDATE'
);

-- Statut d'appartenance à une institution
CREATE TYPE membership_status AS ENUM (
  'OWNER',       -- créateur de l'institution, droits complets
  'ACTIVE',      -- membre actif
  'PENDING',     -- en attente d'approbation
  'SUSPENDED'    -- accès suspendu par un OWNER
);

-- Statut d'une demande d'adhésion à une institution
CREATE TYPE join_request_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REFUSED'
);

-- Statut d'un rôle (poste)
CREATE TYPE role_status AS ENUM (
  'ACTIVE',      -- ouvert aux candidatures
  'DRAFT',       -- brouillon, non visible publiquement
  'CLOSED',      -- fermé, plus de candidatures
  'CANCELLED'    -- annulé définitivement
);

-- Type de contrat pour un rôle
CREATE TYPE contract_type AS ENUM (
  'FULL_TIME',
  'PART_TIME',
  'FREELANCE',
  'INTERNSHIP'
);

-- Statut d'une candidature
CREATE TYPE application_status AS ENUM (
  'PENDING',    -- soumise, pas encore traitée
  'ANALYSING',  -- analyse IA en cours (POST /roles/:id/evaluate déclenché)
  'FINISHED',   -- analyse terminée, résultats disponibles
  'VALIDATED',  -- candidat retenu par l'HR
  'REJECTED',   -- candidat rejeté
  'STOPPED'     -- processus arrêté manuellement
);

-- Type de document attaché à une candidature
CREATE TYPE document_type AS ENUM (
  'CV',
  'MOTIVATION_LETTER',
  'OTHER'
);
