-- =============================================================================
-- 003_institutions.sql — Institutions, membres, demandes d'adhésion
-- Dépend de : 001_enums.sql, 002_profiles.sql
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Table : institutions
-- ──────────────────────────────────────────────────────────────

CREATE TABLE institutions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  website     TEXT,
  sector      TEXT,
  team_size   TEXT,        -- ex: "10-50", "50-200", "200+"
  stage       TEXT,        -- ex: "Startup", "Scale-up", "Enterprise"
  location    TEXT,
  description TEXT,
  logo_url    TEXT,        -- URL publique dans le bucket "logos" (Storage)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_institutions_name ON institutions(name);

CREATE TRIGGER institutions_updated_at
  BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Ajout de institution_id sur profiles (FK vers institutions)
-- Fait ici plutôt que dans 002 pour éviter la dépendance circulaire
-- ──────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_institution ON profiles(institution_id);

-- ──────────────────────────────────────────────────────────────
-- Table : institution_members
-- Représente l'appartenance d'un HR à une institution
-- ──────────────────────────────────────────────────────────────

CREATE TABLE institution_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status         membership_status NOT NULL DEFAULT 'PENDING',
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un user ne peut appartenir qu'une seule fois à une institution
  UNIQUE(user_id, institution_id)
);

CREATE INDEX idx_institution_members_user     ON institution_members(user_id);
CREATE INDEX idx_institution_members_inst     ON institution_members(institution_id);
CREATE INDEX idx_institution_members_status   ON institution_members(status);

-- ──────────────────────────────────────────────────────────────
-- Table : join_requests
-- Demandes d'un HR pour rejoindre une institution
-- ──────────────────────────────────────────────────────────────

CREATE TABLE join_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status         join_request_status NOT NULL DEFAULT 'PENDING',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un user ne peut avoir qu'une demande active par institution
  UNIQUE(user_id, institution_id)
);

CREATE INDEX idx_join_requests_inst   ON join_requests(institution_id);
CREATE INDEX idx_join_requests_user   ON join_requests(user_id);
CREATE INDEX idx_join_requests_status ON join_requests(status);

CREATE TRIGGER join_requests_updated_at
  BEFORE UPDATE ON join_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
