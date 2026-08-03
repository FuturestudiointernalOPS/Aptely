-- =============================================================================
-- 009_storage.sql — Supabase Storage : buckets et policies
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Création des buckets
-- ──────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'documents',
    'documents',
    FALSE,            -- privé : nécessite une URL signée pour accéder
    10485760,         -- max 10 MB par fichier (CV, lettres)
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    ]
  ),
  (
    'logos',
    'logos',
    TRUE,             -- public : URL directe accessible sans auth
    2097152,          -- max 2 MB par logo
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  );

-- ──────────────────────────────────────────────────────────────
-- Policies Storage — bucket "documents" (privé)
-- Convention de nommage des fichiers :
--   documents/{candidate_id}/{application_id}/cv.pdf
--   documents/{candidate_id}/{application_id}/motivation.pdf
-- ──────────────────────────────────────────────────────────────

-- Un candidat peut uploader ses propres documents
-- Le premier segment du chemin DOIT être son UID
CREATE POLICY "docs_candidates_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Un candidat peut lire ses propres documents
CREATE POLICY "docs_candidates_read_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Un candidat peut supprimer ses propres documents
CREATE POLICY "docs_candidates_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Les HR de l'institution peuvent lire les docs des candidatures de leur institution
-- Vérifie que le candidat (1er segment du chemin) a posé une candidature à leur institution
CREATE POLICY "docs_hr_read_institution_applicants"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      JOIN profiles p ON p.id = a.candidate_id
      WHERE p.id::TEXT = (storage.foldername(name))[1]
        AND is_institution_member(r.institution_id)
    )
  );

-- Les HR peuvent supprimer des documents de candidatures de leur institution
CREATE POLICY "docs_hr_delete_institution_applicants"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM applications a
      JOIN roles r ON r.id = a.role_id
      JOIN profiles p ON p.id = a.candidate_id
      WHERE p.id::TEXT = (storage.foldername(name))[1]
        AND is_institution_member(r.institution_id)
    )
  );

-- ──────────────────────────────────────────────────────────────
-- Policies Storage — bucket "logos" (public)
-- Convention : logos/{institution_id}/logo.png
-- ──────────────────────────────────────────────────────────────

-- Tout le monde peut lire les logos (bucket public)
CREATE POLICY "logos_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'logos');

-- Seuls les membres HR peuvent uploader/modifier le logo de leur institution
CREATE POLICY "logos_hr_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND is_institution_member(
      (storage.foldername(name))[1]::UUID
    )
  );

CREATE POLICY "logos_hr_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND is_institution_member(
      (storage.foldername(name))[1]::UUID
    )
  );

CREATE POLICY "logos_hr_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND is_institution_member(
      (storage.foldername(name))[1]::UUID
    )
  );
