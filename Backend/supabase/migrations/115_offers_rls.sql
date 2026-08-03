-- Fix missing RLS policies on offers and offer_versions tables
-- Same pattern as migration 114 (application_decisions)

CREATE POLICY offers_institution_member ON offers
  FOR ALL USING (
    application_id IN (
      SELECT a.id
      FROM applications a
        JOIN roles r ON r.id = a.role_id
        JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
        AND im.status = ANY (ARRAY['OWNER'::membership_status, 'ADMIN'::membership_status, 'ACTIVE'::membership_status])
    )
  );

CREATE POLICY offer_versions_institution_member ON offer_versions
  FOR ALL USING (
    offer_id IN (
      SELECT o.id FROM offers o
      JOIN applications a ON a.id = o.application_id
        JOIN roles r ON r.id = a.role_id
        JOIN institution_members im ON im.institution_id = r.institution_id
      WHERE im.user_id = auth.uid()
        AND im.status = ANY (ARRAY['OWNER'::membership_status, 'ADMIN'::membership_status, 'ACTIVE'::membership_status])
    )
  );
