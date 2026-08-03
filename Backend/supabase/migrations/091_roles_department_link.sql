-- 091: link roles to departments and assign hiring manager
-- Enables org-chart-aware signing chain resolution:
-- offer → application → role → department → manager_user_id

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS department_id        UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hiring_manager_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roles_department        ON roles(department_id);
CREATE INDEX IF NOT EXISTS idx_roles_hiring_manager    ON roles(hiring_manager_user_id);
