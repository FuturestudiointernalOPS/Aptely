-- 090: institution_modules — which modules are active per company
CREATE TABLE institution_modules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  module_key     TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  activated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, module_key)
);

CREATE INDEX idx_institution_modules_institution ON institution_modules(institution_id);

ALTER TABLE institution_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view modules"
  ON institution_modules FOR SELECT
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN', 'ACTIVE')
    )
  );

CREATE POLICY "Admins can manage modules"
  ON institution_modules FOR ALL
  USING (
    institution_id IN (
      SELECT institution_id FROM institution_members
      WHERE user_id = auth.uid() AND status IN ('OWNER', 'ADMIN')
    )
  );

-- Seed: all existing institutions get recruitment module active
INSERT INTO institution_modules (institution_id, module_key, is_active)
SELECT id, 'recruitment', true FROM institutions
ON CONFLICT (institution_id, module_key) DO NOTHING;
