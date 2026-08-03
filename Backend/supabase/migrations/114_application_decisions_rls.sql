-- Fix missing RLS policy on application_decisions
-- decision_recommendations and decision_ratifications already have institution-scoped policies
-- application_decisions was missed in the security fix (edff1b3)

CREATE POLICY application_decisions_institution_member ON application_decisions
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
