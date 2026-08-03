-- =============================================================================
-- 065_calendar_integrations_institution.sql
-- Phase E — OAuth tokens (calendar) become institution-scoped instead of user-scoped.
-- Members of the institution share the same calendar (e.g. "Acme HR Calendar").
-- user_id stays as audit "connected_by".
-- =============================================================================

ALTER TABLE calendar_integrations
  ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE;

-- Backfill: link each existing integration to the user's institution_id.
UPDATE calendar_integrations ci
SET institution_id = p.institution_id
FROM profiles p
WHERE ci.user_id = p.id
  AND ci.institution_id IS NULL
  AND p.institution_id IS NOT NULL;

-- Drop old (user_id, provider) unique to allow institution-level ones.
ALTER TABLE calendar_integrations
  DROP CONSTRAINT IF EXISTS calendar_integrations_user_provider_unique;

-- New unique: one integration per (institution, provider) when institution-scoped.
-- Personal integrations (institution_id IS NULL) keep the old (user, provider) uniqueness via partial index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_integrations_inst_provider
  ON calendar_integrations(institution_id, provider)
  WHERE institution_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_integrations_user_provider_personal
  ON calendar_integrations(user_id, provider)
  WHERE institution_id IS NULL;

-- New RLS: members of the institution can see/manage shared integrations; owners of personal ones still have access.
DROP POLICY IF EXISTS calendar_integrations_select_own ON calendar_integrations;
DROP POLICY IF EXISTS calendar_integrations_insert_own ON calendar_integrations;
DROP POLICY IF EXISTS calendar_integrations_update_own ON calendar_integrations;
DROP POLICY IF EXISTS calendar_integrations_delete_own ON calendar_integrations;

CREATE POLICY calendar_integrations_member_or_owner
  ON calendar_integrations
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      institution_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM institution_members im
        WHERE im.institution_id = calendar_integrations.institution_id
          AND im.user_id = auth.uid()
          AND im.status IN ('OWNER','ADMIN','ACTIVE')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      institution_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM institution_members im
        WHERE im.institution_id = calendar_integrations.institution_id
          AND im.user_id = auth.uid()
          AND im.status IN ('OWNER','ADMIN','ACTIVE')
      )
    )
  );
