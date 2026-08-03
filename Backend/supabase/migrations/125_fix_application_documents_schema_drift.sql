-- Fix application_documents schema drift in DEV vs canonical (006_applications.sql / PROD)
-- DEV had columns renamed to type/created_at and missing file_size/mime_type — caused
-- getDocuments() controller query to fail silently → "Aucun document téléchargé trouvé"
-- and broken CV links in CandidateApplicationModal. This migration is a no-op on
-- environments that already match the canonical schema (PROD).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'type'
  ) THEN
    ALTER TABLE application_documents RENAME COLUMN type TO file_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE application_documents RENAME COLUMN created_at TO uploaded_at;
  END IF;
END $$;

ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

CREATE INDEX IF NOT EXISTS idx_app_docs_type ON application_documents(file_type);
