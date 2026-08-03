-- =============================================================================
-- 101_custom_roles.sql
-- Reusable custom roles per institution. A custom role is a named entity with its
-- own permission set (stored in institution_role_permissions keyed by the custom
-- role id, enabled by migration 100 which made role/permission free text).
--   1. institution_custom_roles  — the role definitions.
--   2. institution_members.custom_role_id — link a member to a custom role.
-- role_specialization='CUSTOM' + custom_role_id resolves permissions at runtime.
-- =============================================================================

CREATE TABLE IF NOT EXISTS institution_custom_roles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One role name per institution (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_roles_inst_name
  ON institution_custom_roles (institution_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_custom_roles_inst
  ON institution_custom_roles (institution_id);

-- Link a member to a custom role. ON DELETE SET NULL so deleting a role doesn't
-- delete members — the controller resets those members to MEMBER on deletion.
ALTER TABLE institution_members
  ADD COLUMN IF NOT EXISTS custom_role_id uuid
    REFERENCES institution_custom_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_institution_members_custom_role
  ON institution_members(custom_role_id);
