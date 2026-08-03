-- Align the institution logo bucket size limit with the 5 MB the client allows.
-- It was 2 MB, so logos between 2–5 MB passed the client-side check but were
-- rejected at the storage layer, making "upload logo" appear broken.
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE name = 'logos';
