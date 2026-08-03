-- Add role_id to sorted_talents so matching can be scoped per role.
-- The matching engine inserts role_id; without this column the insert fails silently.

ALTER TABLE sorted_talents ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE CASCADE;

-- Ensure uniqueness per role+rank — prevents duplicate entries on re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sorted_talents_role_rank ON sorted_talents (role_id, rank);
