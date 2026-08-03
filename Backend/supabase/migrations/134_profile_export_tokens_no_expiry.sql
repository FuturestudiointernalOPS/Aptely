-- Bug fix: candidate public profile share links must not expire.
-- Push existing tokens' expiry far into the future so already-shared links keep working.
UPDATE profile_export_tokens
SET expires_at = '2099-12-31T00:00:00.000Z'
WHERE expires_at < '2099-12-31T00:00:00.000Z';
