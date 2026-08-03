-- =============================================================================
-- 008_rls.sql — Row Level Security : toutes les policies
-- À exécuter APRÈS toutes les tables (007).
--
-- Principe : ALTER TABLE ... ENABLE ROW LEVEL SECURITY bloque TOUT.
-- Ensuite, CREATE POLICY autorise des cas précis.
-- auth.uid() = UUID de l'utilisateur connecté (extrait de son JWT Supabase)
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Helper : fonction pour vérifier si un user est membre actif d'une institution
-- Utilisé dans plusieurs policies pour éviter la répétition
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_institution_member(inst_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE  -- résultat stable pour une même transaction (optimisation)
AS $$
  SELECT EXISTS (
    SELECT 1 FROM institution_members
    WHERE user_id = auth.uid()
      AND institution_id = inst_id
      AND status IN ('OWNER', 'ACTIVE')
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- PROFILES
-- ──────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur gère uniquement son propre profil
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Les HR peuvent voir les profils des candidats qui ont postulé à leurs rôles
CREATE POLICY "hr_view_candidate_profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      WHERE a.candidate_id = profiles.id
        AND is_institution_member(r.institution_id)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- INSTITUTIONS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifié peut lire les institutions (pour les demandes d'adhésion)
CREATE POLICY "institutions_select_authenticated"
  ON institutions FOR SELECT TO authenticated
  USING (TRUE);

-- Seuls les membres actifs/owner peuvent modifier leur institution
CREATE POLICY "institutions_update_members"
  ON institutions FOR UPDATE TO authenticated
  USING (is_institution_member(id))
  WITH CHECK (is_institution_member(id));

-- Tout utilisateur HR peut créer une institution (au register)
CREATE POLICY "institutions_insert_hr"
  ON institutions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'HR')
  );

-- ──────────────────────────────────────────────────────────────
-- INSTITUTION_MEMBERS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE institution_members ENABLE ROW LEVEL SECURITY;

-- Membres peuvent voir leur institution
CREATE POLICY "inst_members_select"
  ON institution_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_institution_member(institution_id)
  );

-- Seuls les owners peuvent gérer les membres
CREATE POLICY "inst_members_manage_by_owner"
  ON institution_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM institution_members im
      WHERE im.user_id = auth.uid()
        AND im.institution_id = institution_members.institution_id
        AND im.status = 'OWNER'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- JOIN_REQUESTS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- Un user voit ses propres demandes + les owners voient celles de leur institution
CREATE POLICY "join_requests_select"
  ON join_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_institution_member(institution_id)
  );

CREATE POLICY "join_requests_insert_self"
  ON join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "join_requests_update_owner"
  ON join_requests FOR UPDATE TO authenticated
  USING (is_institution_member(institution_id));

CREATE POLICY "join_requests_delete"
  ON join_requests FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_institution_member(institution_id)
  );

-- ──────────────────────────────────────────────────────────────
-- TALENT_DNA
-- ──────────────────────────────────────────────────────────────

ALTER TABLE talent_dna ENABLE ROW LEVEL SECURITY;

-- Le candidat gère uniquement son propre DNA
CREATE POLICY "talent_dna_own_candidate"
  ON talent_dna FOR ALL TO authenticated
  USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());

-- Les HR peuvent lire le DNA des candidats qui ont postulé à leurs rôles
CREATE POLICY "hr_reads_talent_dna_applicants"
  ON talent_dna FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      WHERE a.candidate_id = talent_dna.candidate_id
        AND is_institution_member(r.institution_id)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- ROLES
-- ──────────────────────────────────────────────────────────────

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Lecture publique des rôles ACTIVE (candidats sans compte, via share_link)
CREATE POLICY "roles_public_read_active"
  ON roles FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE');

-- Les membres HR voient TOUS les rôles de leur institution (brouillons inclus)
CREATE POLICY "roles_hr_read_own_institution"
  ON roles FOR SELECT TO authenticated
  USING (is_institution_member(institution_id));

-- Les membres HR gèrent les rôles de leur institution
CREATE POLICY "roles_hr_manage_own_institution"
  ON roles FOR INSERT TO authenticated
  WITH CHECK (is_institution_member(institution_id));

CREATE POLICY "roles_hr_update_own_institution"
  ON roles FOR UPDATE TO authenticated
  USING (is_institution_member(institution_id))
  WITH CHECK (is_institution_member(institution_id));

CREATE POLICY "roles_hr_delete_own_institution"
  ON roles FOR DELETE TO authenticated
  USING (is_institution_member(institution_id));

-- ──────────────────────────────────────────────────────────────
-- ROLE_DNA
-- ──────────────────────────────────────────────────────────────

ALTER TABLE role_dna ENABLE ROW LEVEL SECURITY;

-- Lecture publique si le rôle parent est ACTIVE
CREATE POLICY "role_dna_public_read_active"
  ON role_dna FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM roles WHERE id = role_dna.role_id AND status = 'ACTIVE')
  );

-- Les HR membres voient et modifient le DNA de leurs rôles
CREATE POLICY "role_dna_hr_manage"
  ON role_dna FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles WHERE id = role_dna.role_id
        AND is_institution_member(institution_id)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- APPLICATIONS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Un candidat voit et gère ses propres candidatures
CREATE POLICY "applications_candidate_own"
  ON applications FOR ALL TO authenticated
  USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());

-- Les HR voient et gèrent les candidatures de leur institution
CREATE POLICY "applications_hr_institution"
  ON applications FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles WHERE id = applications.role_id
        AND is_institution_member(institution_id)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- APPLICATION_DOCUMENTS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

-- Accès par candidat propriétaire ou HR de l'institution
CREATE POLICY "app_docs_access"
  ON application_documents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      WHERE a.id = application_documents.application_id
        AND (
          a.candidate_id = auth.uid()
          OR is_institution_member(r.institution_id)
        )
    )
  );

-- ──────────────────────────────────────────────────────────────
-- SORTED_TALENTS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE sorted_talents ENABLE ROW LEVEL SECURITY;

-- Uniquement les HR de l'institution voient et gèrent le ranking
CREATE POLICY "sorted_talents_hr_only"
  ON sorted_talents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      WHERE a.id = sorted_talents.application_id
        AND is_institution_member(r.institution_id)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- MATCH_RESULTS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

-- Uniquement les HR de l'institution voient les résultats IA
CREATE POLICY "match_results_hr_only"
  ON match_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      WHERE a.id = match_results.application_id
        AND is_institution_member(r.institution_id)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- ACTIVITY_LOGS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Uniquement les membres HR voient les logs de leur institution
CREATE POLICY "activity_logs_hr_only"
  ON activity_logs FOR SELECT TO authenticated
  USING (is_institution_member(institution_id));

-- Seul le service_role (supabaseAdmin côté Express) peut insérer des logs
-- Les users ne peuvent pas se créer des logs eux-mêmes
CREATE POLICY "activity_logs_service_only_insert"
  ON activity_logs FOR INSERT TO service_role
  WITH CHECK (TRUE);
