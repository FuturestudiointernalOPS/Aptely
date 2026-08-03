-- =============================================================================
-- 051_status_triggers.sql
-- Phase 3 Sprint 1 — Application status change event log
-- Tracks every status transition on applications for audit + history display.
-- Email notifications on status change are handled in the Express backend
-- (applications.controller.ts: updateApplicationStatus) via Resend.
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_status_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status      TEXT        NOT NULL,
  changed_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ase_application ON application_status_events(application_id);
CREATE INDEX idx_ase_created_at  ON application_status_events(created_at DESC);

-- RLS: candidates read their own events; HR reads events for their institution
ALTER TABLE application_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ase_candidate_read"
  ON application_status_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_id
        AND a.candidate_id = auth.uid()
    )
  );

CREATE POLICY "ase_hr_read"
  ON application_status_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM applications a
      JOIN roles r ON r.id = a.role_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE a.id = application_id
        AND r.institution_id = p.institution_id
        AND p.role = 'HR'
    )
  );

-- Service role (backend) writes events
CREATE POLICY "ase_service_insert"
  ON application_status_events
  FOR INSERT
  WITH CHECK (true);

-- Postgres trigger: auto-insert an event row on every status update
CREATE OR REPLACE FUNCTION record_application_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO application_status_events (application_id, previous_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_application_status_change
  AFTER UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION record_application_status_change();
