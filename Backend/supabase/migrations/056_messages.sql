-- =============================================================================
-- 056_messages.sql — In-platform messaging (Individual ↔ Institution)
-- One thread per application. Supabase Realtime enabled.
-- Dépend de : 006_applications.sql, 002_profiles.sql
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- Table : message_threads — one per application
-- ──────────────────────────────────────────────────────────────
CREATE TABLE message_threads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  UNIQUE(application_id)
);

CREATE INDEX idx_threads_application ON message_threads(application_id);

-- ──────────────────────────────────────────────────────────────
-- Table : messages
-- ──────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID        NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID        NOT NULL REFERENCES profiles(id),
  content   TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at   TIMESTAMPTZ
);

CREATE INDEX idx_messages_thread  ON messages(thread_id, sent_at);
CREATE INDEX idx_messages_sender  ON messages(sender_id);

-- ──────────────────────────────────────────────────────────────
-- Keep last_message_at in sync
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE message_threads SET last_message_at = NEW.sent_at WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_update_thread
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_thread_last_message();

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;

-- Thread visible to: candidate (via applications.candidate_id) OR institution member (via applications.role_id → roles.institution_id → institution_members)
CREATE POLICY threads_participant ON message_threads
  FOR ALL USING (
    application_id IN (
      SELECT id FROM applications WHERE candidate_id = auth.uid()
    )
    OR
    application_id IN (
      SELECT a.id FROM applications a
      JOIN roles r ON r.id = a.role_id
      JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
    )
  );

-- Messages: same as thread participant
CREATE POLICY messages_participant ON messages
  FOR ALL USING (
    thread_id IN (
      SELECT mt.id FROM message_threads mt
      WHERE mt.application_id IN (
        SELECT id FROM applications WHERE candidate_id = auth.uid()
      )
      OR mt.application_id IN (
        SELECT a.id FROM applications a
        JOIN roles r ON r.id = a.role_id
        JOIN institution_members im ON im.institution_id = r.institution_id
        WHERE im.user_id = auth.uid()
      )
    )
  );

-- ──────────────────────────────────────────────────────────────
-- Realtime publication
-- ──────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
