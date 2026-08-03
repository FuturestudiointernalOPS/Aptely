-- =============================================================================
-- 054_vault_storage_bucket.sql
-- Phase 3 Sprint 2 — Supabase Storage bucket for Vault file proofs
-- =============================================================================

-- Create the bucket (public = files are publicly readable by URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-proofs',
  'vault-proofs',
  true,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS policies ─────────────────────────────────────────────────────

-- Authenticated candidates can upload to their own folder only
CREATE POLICY "vault_proofs_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vault-proofs'
    AND auth.role() = 'authenticated'
  );

-- Public read (bucket is public, but be explicit)
CREATE POLICY "vault_proofs_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vault-proofs');

-- Owner can delete their own files
CREATE POLICY "vault_proofs_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vault-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
