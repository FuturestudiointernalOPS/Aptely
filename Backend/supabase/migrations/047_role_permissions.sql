-- =============================================================================
-- 047_role_permissions.sql
-- Custom permissions per role within an institution
-- =============================================================================

-- Permissions enum
CREATE TYPE institution_permission AS ENUM (
  'roles.create',
  'roles.update',
  'roles.delete',
  'applications.view',
  'applications.decide',
  'offers.manage',
  'communications.send',
  'analytics.view',
  'members.manage'
);

-- One row per (institution, role, permission)
CREATE TABLE institution_role_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role           TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','MEMBER')),
  permission     institution_permission NOT NULL,
  granted        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, role, permission)
);

CREATE INDEX idx_irp_institution ON institution_role_permissions(institution_id, role);

ALTER TABLE institution_role_permissions ENABLE ROW LEVEL SECURITY;

-- HR members of the institution can read
CREATE POLICY irp_select ON institution_role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM institution_members m
      WHERE m.institution_id = institution_role_permissions.institution_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status IN ('ACTIVE','OWNER','ADMIN')
    )
  );

-- Only OWNER can write
CREATE POLICY irp_write ON institution_role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM institution_members m
      WHERE m.institution_id = institution_role_permissions.institution_id
        AND m.user_id = (SELECT auth.uid())
        AND m.status = 'OWNER'
    )
  );
