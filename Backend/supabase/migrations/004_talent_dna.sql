-- =============================================================================
-- 004_talent_dna.sql — Talent DNA : les 8 sections candidat
-- Dépend de : 001_enums.sql, 002_profiles.sql
-- =============================================================================

-- Une seule table avec toutes les sections en JSONB.
-- Relation 1-1 avec profiles via UNIQUE(candidate_id).
-- Toutes les sections sont NULL jusqu'à ce que le candidat les remplisse.

CREATE TABLE talent_dna (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Section 1 — Identité & logistique
  -- { name, location, timezone, workAuth, availability, contracts: [], salaryExpectation, links: { cv, linkedin, portfolio } }
  talent_identity  JSONB,

  -- Section 2 — Snapshot professionnel
  -- { primaryRole, secondarySkills: [], yearsExp, experienceMix: [], trustedProblemSolving }
  talent_snapshot  JSONB,

  -- Section 3 — Expériences (liste)
  -- [{ company, role, period, context, keyAchievements: [] }]
  talent_experience JSONB,

  -- Section 4 — Skills (liste avec preuves)
  -- [{ skillName, yearsUsed, context: [], ownership, proofLink, explanation: { what, role, difficulty, outcome } }]
  talent_skills    JSONB,

  -- Section 5 — Real work evidence (2-5 entrées)
  -- [{ projectName, problemSolved, personalContribution, toolsUsed: [], result, hardship, link }]
  talent_evidence  JSONB,

  -- Section 6 — Scenario & jugement
  -- { difficultProblem, failedProject, approachToChallenges }
  talent_scenario  JSONB,

  -- Section 7a — Operating style (sliders 0-100)
  -- { chaosVsStructure, speedVsQuality, autonomyVsGuidance, depthVsVariety, pressureComfort, struggleEnvironment, thriveEnvironment }
  talent_style     JSONB,

  -- Section 7b — Motivation & trajectoire
  -- { growthGoals, excitementTriggers, threeYearVision, meaningfulProblems }
  talent_motivation JSONB,

  -- Score de complétion calculé (0-100), mis à jour par Express à chaque PATCH
  completion_score INTEGER NOT NULL DEFAULT 0 CHECK (completion_score >= 0 AND completion_score <= 100),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_talent_dna_candidate ON talent_dna(candidate_id);

CREATE TRIGGER talent_dna_updated_at
  BEFORE UPDATE ON talent_dna
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
