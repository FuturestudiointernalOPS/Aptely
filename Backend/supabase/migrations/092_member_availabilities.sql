-- Sprint 2: Native member availability slots
CREATE TABLE IF NOT EXISTS member_availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, user_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_member_availabilities_institution ON member_availabilities(institution_id);
CREATE INDEX IF NOT EXISTS idx_member_availabilities_user ON member_availabilities(user_id);
