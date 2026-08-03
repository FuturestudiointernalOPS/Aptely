-- Candidate/user profile photos are served via getPublicUrl() (the avatars bucket is
-- listed in PUBLIC_BUCKETS in storage.service.ts). On PROD the avatars bucket was
-- private, so every public URL 404'd and the photo rendered as a broken square with a
-- "?" — on both phone and desktop. Make it public and align the size/MIME limits with
-- the 5 MB JPG/PNG/WEBP the client allows.
UPDATE storage.buckets
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE name = 'avatars';
