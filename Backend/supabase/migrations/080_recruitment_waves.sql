-- ─── Recruitment Waves ──────────────────────────────────────────────────────
-- Wave: group of candidates for a given role, organized in timed batches
-- Each wave has N slots; candidates book one slot via public token

-- Wave templates (reusable wave configs per institution)
CREATE TABLE IF NOT EXISTS wave_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  default_duration_minutes INT NOT NULL DEFAULT 60,
  default_slot_capacity    INT NOT NULL DEFAULT 1,
  criteria_json   JSONB,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Main recruitment wave
CREATE TABLE IF NOT EXISTS recruitment_waves (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id          UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  template_id      UUID REFERENCES wave_templates(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','ACTIVE','CLOSED','CANCELLED')),
  wave_order       INT NOT NULL DEFAULT 1,
  -- prerequisites: null = no prerequisite wave required
  prerequisite_wave_id UUID REFERENCES recruitment_waves(id) ON DELETE SET NULL,
  force_add_allowed    BOOLEAN NOT NULL DEFAULT true,
  auto_place_on_match  BOOLEAN NOT NULL DEFAULT false,
  auto_place_threshold NUMERIC(5,2),
  booking_open_at      TIMESTAMPTZ,
  booking_close_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidates assigned to a wave
CREATE TABLE IF NOT EXISTS wave_candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id         UUID NOT NULL REFERENCES recruitment_waves(id) ON DELETE CASCADE,
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'INVITED'
                  CHECK (status IN ('INVITED','BOOKED','NO_SHOW','PASSED','FAILED','WITHDRAWN')),
  force_added     BOOLEAN NOT NULL DEFAULT false,
  invite_token    TEXT UNIQUE,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  booking_id      UUID,
  notes           TEXT,
  UNIQUE(wave_id, application_id)
);

-- Time slots within a wave
CREATE TABLE IF NOT EXISTS wave_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id         UUID NOT NULL REFERENCES recruitment_waves(id) ON DELETE CASCADE,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  capacity        INT NOT NULL DEFAULT 1,
  meeting_provider TEXT NOT NULL DEFAULT 'MANUAL'
                   CHECK (meeting_provider IN ('GOOGLE_MEET','TEAMS','MANUAL')),
  meeting_link    TEXT,
  meeting_location TEXT,
  interviewer_ids JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings: one candidate → one slot
CREATE TABLE IF NOT EXISTS wave_slot_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id         UUID NOT NULL REFERENCES wave_slots(id) ON DELETE CASCADE,
  wave_candidate_id UUID NOT NULL REFERENCES wave_candidates(id) ON DELETE CASCADE,
  booked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at    TIMESTAMPTZ,
  cancelled_reason TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  reminder_sent_at     TIMESTAMPTZ,
  UNIQUE(slot_id, wave_candidate_id)
);

-- FK: wave_candidates.booking_id → wave_slot_bookings.id (deferred to avoid circular)
ALTER TABLE wave_candidates
  ADD CONSTRAINT fk_wave_candidates_booking
  FOREIGN KEY (booking_id) REFERENCES wave_slot_bookings(id) ON DELETE SET NULL;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_recruitment_waves_role_id ON recruitment_waves(role_id);
CREATE INDEX IF NOT EXISTS idx_wave_candidates_wave_id ON wave_candidates(wave_id);
CREATE INDEX IF NOT EXISTS idx_wave_candidates_application_id ON wave_candidates(application_id);
CREATE INDEX IF NOT EXISTS idx_wave_candidates_invite_token ON wave_candidates(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wave_slots_wave_id ON wave_slots(wave_id);
CREATE INDEX IF NOT EXISTS idx_wave_slot_bookings_slot_id ON wave_slot_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_wave_slot_bookings_candidate_id ON wave_slot_bookings(wave_candidate_id);
CREATE INDEX IF NOT EXISTS idx_wave_templates_institution_id ON wave_templates(institution_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE wave_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_slot_bookings ENABLE ROW LEVEL SECURITY;

-- HR can manage waves for their institution (via role→institution)
CREATE POLICY wave_templates_hr ON wave_templates
  FOR ALL USING (institution_id IN (
    SELECT institution_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY recruitment_waves_hr ON recruitment_waves
  FOR ALL USING (role_id IN (
    SELECT r.id FROM roles r
    JOIN profiles p ON p.institution_id = r.institution_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY wave_candidates_hr ON wave_candidates
  FOR ALL USING (wave_id IN (
    SELECT rw.id FROM recruitment_waves rw
    JOIN roles r ON r.id = rw.role_id
    JOIN profiles p ON p.institution_id = r.institution_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY wave_slots_hr ON wave_slots
  FOR ALL USING (wave_id IN (
    SELECT rw.id FROM recruitment_waves rw
    JOIN roles r ON r.id = rw.role_id
    JOIN profiles p ON p.institution_id = r.institution_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY wave_slot_bookings_hr ON wave_slot_bookings
  FOR ALL USING (slot_id IN (
    SELECT ws.id FROM wave_slots ws
    JOIN recruitment_waves rw ON rw.id = ws.wave_id
    JOIN roles r ON r.id = rw.role_id
    JOIN profiles p ON p.institution_id = r.institution_id
    WHERE p.id = auth.uid()
  ));

-- Public read on wave_candidates via invite_token (for candidate booking)
CREATE POLICY wave_candidates_public_by_token ON wave_candidates
  FOR SELECT USING (invite_token IS NOT NULL);

-- Public read on wave_slot_bookings via join (for candidate to see their booking)
CREATE POLICY wave_slot_bookings_public ON wave_slot_bookings
  FOR SELECT USING (true);

-- Public read on wave_slots (candidates need to see available slots)
CREATE POLICY wave_slots_public_read ON wave_slots
  FOR SELECT USING (true);
