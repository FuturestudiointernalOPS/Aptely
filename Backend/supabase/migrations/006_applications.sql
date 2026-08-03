-- =============================================================================
-- 006_applications.sql — Candidatures, documents, ranking IA
-- Dépend de : 001_enums.sql, 002_profiles.sql, 005_roles.sql
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Table : applications — une candidature = un candidat → un rôle
-- ──────────────────────────────────────────────────────────────

CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  status        application_status NOT NULL DEFAULT 'PENDING',
  -- Score final IA (0.00 - 100.00), NULL avant que le matching soit exécuté
  match_score   NUMERIC(5,2) CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
  -- Lien de partage unique généré par Express (generateShareLink('app'))
  share_link    TEXT UNIQUE,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un candidat ne postule qu'une SEULE fois à un rôle donné
  UNIQUE(candidate_id, role_id)
);

CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_role      ON applications(role_id);
CREATE INDEX idx_applications_status    ON applications(status);

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Table : application_documents — fichiers liés à une candidature
-- Les fichiers physiques sont dans le bucket "documents" (Storage)
-- storage_path = chemin dans le bucket (ex: "{candidate_id}/{application_id}/cv.pdf")
-- url n'est PAS stocké : on génère une URL signée à la demande (expire après 1h)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE application_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,      -- nom original du fichier (ex: "cv_alice.pdf")
  file_type      document_type NOT NULL,
  storage_path   TEXT NOT NULL,      -- chemin dans Supabase Storage
  file_size      INTEGER,            -- taille en octets (optionnel, pour affichage)
  mime_type      TEXT,               -- ex: "application/pdf", "image/png"
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_docs_application ON application_documents(application_id);
CREATE INDEX idx_app_docs_type        ON application_documents(file_type);

-- ──────────────────────────────────────────────────────────────
-- Table : sorted_talents — classement IA des candidats pour un rôle
-- Remplie après POST /roles/:id/evaluate
-- L'HR peut approuver/désapprouver chaque talent (approved)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE sorted_talents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  candidate_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rank           INTEGER NOT NULL CHECK (rank > 0),   -- 1 = meilleur
  score          NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  -- NULL = pas encore décidé | true = approuvé | false = désapprouvé
  approved       BOOLEAN DEFAULT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(application_id, candidate_id)
);

CREATE INDEX idx_sorted_talents_application ON sorted_talents(application_id);
CREATE INDEX idx_sorted_talents_rank        ON sorted_talents(application_id, rank);

CREATE TRIGGER sorted_talents_updated_at
  BEFORE UPDATE ON sorted_talents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
