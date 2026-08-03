-- =============================================================================
-- 099_transfer_ownership.sql
-- Atomic transfer of institution ownership: the current OWNER hands over to a
-- member, who becomes OWNER; the current OWNER is demoted to ADMIN.
-- Keeps exactly one OWNER. Updates BOTH the legacy `status` field and the
-- `role_specialization` field so the UI (which reads either) stays consistent.
-- =============================================================================

CREATE OR REPLACE FUNCTION transfer_institution_ownership(
  p_institution uuid,
  p_current     uuid,
  p_new         uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status membership_status;
  v_new_status     membership_status;
BEGIN
  IF p_current = p_new THEN
    RAISE EXCEPTION 'Cannot transfer ownership to yourself';
  END IF;

  -- Caller must currently be OWNER of this institution
  SELECT status INTO v_current_status
  FROM institution_members
  WHERE institution_id = p_institution AND user_id = p_current;

  IF v_current_status IS NULL OR v_current_status <> 'OWNER' THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;

  -- Target must be an active member of this institution
  SELECT status INTO v_new_status
  FROM institution_members
  WHERE institution_id = p_institution AND user_id = p_new;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this institution';
  END IF;
  IF v_new_status IN ('PENDING', 'SUSPENDED') THEN
    RAISE EXCEPTION 'Target member must be active to receive ownership';
  END IF;

  -- Promote the new owner
  UPDATE institution_members
  SET status = 'OWNER', role_specialization = 'OWNER'
  WHERE institution_id = p_institution AND user_id = p_new;

  -- Demote the previous owner to ADMIN
  UPDATE institution_members
  SET status = 'ADMIN', role_specialization = 'ADMIN'
  WHERE institution_id = p_institution AND user_id = p_current;
END;
$$;
