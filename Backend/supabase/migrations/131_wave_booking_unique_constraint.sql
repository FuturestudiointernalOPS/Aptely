-- Prevent double-booking: one active booking per candidate per slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_wave_slot_bookings_unique_active
  ON wave_slot_bookings (slot_id, wave_candidate_id)
  WHERE cancelled_at IS NULL;
