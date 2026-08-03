-- 104_notifications.sql
-- In-app notification system (shared HR + candidate)

CREATE TYPE notification_type AS ENUM (
  'OFFER_RECEIVED',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_COUNTERED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_REMINDER',
  'INTERVIEW_CANCELLED',
  'DECISION_MADE',
  'APPLICATION_STATUS_CHANGED',
  'ONBOARDING_TASK_ASSIGNED',
  'ONBOARDING_TASK_COMPLETED',
  'TEAM_MEMBER_JOINED',
  'GENERAL'
);

CREATE TABLE notifications (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id  UUID         REFERENCES institutions(id) ON DELETE CASCADE,
  type            notification_type NOT NULL,
  title           TEXT         NOT NULL,
  body            TEXT,
  link            TEXT,
  is_read         BOOLEAN      NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Backend service_role inserts freely (supabaseAdmin)
-- No INSERT/UPDATE/DELETE policy needed for authenticated users — service_role bypasses RLS
