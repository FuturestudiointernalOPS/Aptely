-- 095_invitations_role.sql
-- Add role_specialization + job_position_id to invite tokens
-- so inviter can pre-define the role/function of the invitee

ALTER TABLE institution_invitations
  ADD COLUMN role_specialization institution_role_specialization,
  ADD COLUMN job_position_id      UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  ADD COLUMN custom_label         TEXT CHECK (custom_label IS NULL OR (char_length(custom_label) BETWEEN 1 AND 80));
