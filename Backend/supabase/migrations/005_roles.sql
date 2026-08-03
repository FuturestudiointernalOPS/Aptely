-- =============================================================================
-- 005_roles.sql — Rôles (postes) et Role DNA
-- Dépend de : 001_enums.sql, 003_institutions.sql
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Table : roles — métadonnées du poste
-- ──────────────────────────────────────────────────────────────

CREATE TABLE roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  status         role_status NOT NULL DEFAULT 'DRAFT',
  location       TEXT,
  type           contract_type,
  end_date       TIMESTAMPTZ,
  -- Lien de partage unique généré par Express (generateShareLink('role'))
  share_link     TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roles_institution ON roles(institution_id);
CREATE INDEX idx_roles_status      ON roles(status);
-- Index pour la recherche full-text sur le titre
CREATE INDEX idx_roles_title       ON roles USING gin(to_tsvector('french', title));

CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Table : role_dna — contenu détaillé du Role DNA
-- Relation 1-1 avec roles via UNIQUE(role_id)
-- Séparé de roles pour que la liste des rôles soit rapide à charger
-- (on ne charge le DNA complet qu'à la demande du détail d'un rôle)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE role_dna (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id          UUID NOT NULL UNIQUE REFERENCES roles(id) ON DELETE CASCADE,

  -- Mission et succès attendus
  mission_90_days  TEXT,    -- ce que le candidat doit accomplir dans les 90 premiers jours
  success_6_months TEXT,    -- à quoi ressemble le succès à 6 mois

  -- Problèmes clés à résoudre (liste JSON)
  -- [{ problem: string, priority: "HIGH|MEDIUM|LOW" }]
  key_problems     JSONB,

  -- Contraintes du rôle (budget, équipe, stack imposée, etc.)
  -- { budget: string, teamSize: number, techStack: [], reportingTo: string }
  constraints      JSONB,

  -- Contexte de l'équipe
  -- { size: number, structure: string, dynamics: string, challenges: [] }
  team_context     JSONB,

  -- Profil recherché (traits, non-négociables)
  -- { mustHave: [], niceToHave: [], culture: string }
  candidate_profile JSONB,

  -- Éliminatoires absolus (texte libre, tableau)
  dealbreakers     TEXT[],

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_dna_role ON role_dna(role_id);

CREATE TRIGGER role_dna_updated_at
  BEFORE UPDATE ON role_dna
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Trigger : crée automatiquement un role_dna vide à chaque rôle créé
-- L'HR n'a pas à appeler un endpoint séparé pour initialiser le DNA
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_role_dna_on_role_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO role_dna (role_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_role_created
  AFTER INSERT ON roles
  FOR EACH ROW
  EXECUTE FUNCTION create_role_dna_on_role_insert();
