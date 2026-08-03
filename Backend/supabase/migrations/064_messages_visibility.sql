-- =============================================================================
-- 064_messages_visibility.sql
-- Phase D — Internal vs External message threads.
-- - external (default): candidate ↔ institution conversation
-- - internal: institution-only (members discuss candidate privately)
-- =============================================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'external'
  CHECK (visibility IN ('internal', 'external'));

CREATE INDEX IF NOT EXISTS idx_messages_thread_visibility
  ON messages(thread_id, visibility, sent_at DESC);

-- Drop existing combined RLS policy and replace with split ones.
DROP POLICY IF EXISTS messages_participant ON messages;

-- External messages: candidate (via applications.candidate_id) OR institution member can read/write.
CREATE POLICY messages_external ON messages
  FOR ALL USING (
    visibility = 'external' AND (
      thread_id IN (
        SELECT mt.id FROM message_threads mt
        WHERE mt.application_id IN (
          SELECT id FROM applications WHERE candidate_id = auth.uid()
        )
      )
      OR thread_id IN (
        SELECT mt.id FROM message_threads mt
        WHERE mt.application_id IN (
          SELECT a.id FROM applications a
          JOIN roles r ON r.id = a.role_id
          JOIN institution_members im ON im.institution_id = r.institution_id
          WHERE im.user_id = auth.uid()
            AND im.status IN ('OWNER','ADMIN','ACTIVE')
        )
      )
    )
  )
  WITH CHECK (
    visibility = 'external' AND (
      thread_id IN (
        SELECT mt.id FROM message_threads mt
        WHERE mt.application_id IN (
          SELECT id FROM applications WHERE candidate_id = auth.uid()
        )
      )
      OR thread_id IN (
        SELECT mt.id FROM message_threads mt
        WHERE mt.application_id IN (
          SELECT a.id FROM applications a
          JOIN roles r ON r.id = a.role_id
          JOIN institution_members im ON im.institution_id = r.institution_id
          WHERE im.user_id = auth.uid()
            AND im.status IN ('OWNER','ADMIN','ACTIVE')
        )
      )
    )
  );

-- Internal messages: institution members ONLY. Candidate cannot see or write.
CREATE POLICY messages_internal ON messages
  FOR ALL USING (
    visibility = 'internal' AND
    thread_id IN (
      SELECT mt.id FROM message_threads mt
      WHERE mt.application_id IN (
        SELECT a.id FROM applications a
        JOIN roles r ON r.id = a.role_id
        JOIN institution_members im ON im.institution_id = r.institution_id
        WHERE im.user_id = auth.uid()
          AND im.status IN ('OWNER','ADMIN','ACTIVE')
      )
    )
  )
  WITH CHECK (
    visibility = 'internal' AND
    thread_id IN (
      SELECT mt.id FROM message_threads mt
      WHERE mt.application_id IN (
        SELECT a.id FROM applications a
        JOIN roles r ON r.id = a.role_id
        JOIN institution_members im ON im.institution_id = r.institution_id
        WHERE im.user_id = auth.uid()
          AND im.status IN ('OWNER','ADMIN','ACTIVE')
      )
    )
  );
