-- Role share links never expired or rotated once generated — a leaked/scraped
-- public apply link stayed valid forever. Add a rotation timestamp so the
-- backend can regenerate the link periodically (see rotateShareLinkIfStale
-- in roles.controller.ts) without needing a scheduled job.
ALTER TABLE roles ADD COLUMN IF NOT EXISTS share_link_rotated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE roles SET share_link_rotated_at = created_at;
