-- Interviews.duration_minutes CHECK constraint only allowed (30,45,60,90),
-- rejecting the 15-min option exposed in the scheduler UI and any custom
-- duration typed by HR (the Zod schema already allows 15-180).
-- Insert failed silently at the DB layer -> generic 500 "Failed to create interview".
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_duration_minutes_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_duration_minutes_check
  CHECK (duration_minutes >= 15 AND duration_minutes <= 180);
