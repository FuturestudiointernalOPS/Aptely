import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";

// ─── Multi-step offer approval chain ─────────────────────────────────────────
// State machine driven by `offer_approvals` rows (one per step).
// An offer can only move DRAFT → SENT once all steps in its approval chain are APPROVED.
// Approval chain is OPTIONAL — institutions without an approval policy bypass it entirely.

interface CreateApprovalChainBody {
  steps: Array<{
    required_role: string; // 'HR_LEAD' | 'OWNER' | custom
  }>;
}

interface ApprovalDecisionBody {
  comment?: string;
}

async function assertOfferInWorkspace(
  offerId: string,
  institutionId: string
): Promise<{ offer_id: string; status: string }> {
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select(`
      id, status,
      applications!inner ( role_id, roles!inner ( institution_id ) )
    `)
    .eq("id", offerId)
    .maybeSingle();

  if (error || !data) throw new AppError(404, "Offer not found");

  const apps = data.applications as unknown as { roles?: { institution_id: string } | { institution_id: string }[] };
  const roles = Array.isArray(apps?.roles) ? apps.roles[0] : apps?.roles;
  if (!roles || roles.institution_id !== institutionId) {
    throw new AppError(403, "Offer does not belong to this workspace");
  }

  return { offer_id: data.id as string, status: data.status as string };
}

async function getApproverRole(userId: string, institutionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("institution_members")
    .select("role_specialization, role_custom_label, status")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) return null;
  if (data.status === "SUSPENDED" || data.status === "PENDING") return null;

  if (data.role_specialization === "CUSTOM" && data.role_custom_label) {
    return data.role_custom_label;
  }
  return (data.role_specialization as string | null) ?? (data.status as string | null);
}

// ─── POST /offers/:id/approval-chain ─────────────────────────────────────────
// Initialize the approval chain. Only members with `offers.manage` can call.
// Idempotent: returns existing chain if already created.

export const createApprovalChain = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const offerId = req.params["id"] as string;
    const institutionId = req.workspace?.institutionId ?? req.user!.activeInstitutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Workspace context required");

    const offer = await assertOfferInWorkspace(offerId, institutionId);
    if (offer.status !== "DRAFT") {
      throw new AppError(409, "Approval chain can only be created on DRAFT offers");
    }

    const body = req.body as CreateApprovalChainBody;
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      throw new AppError(400, "At least one approval step is required");
    }
    if (body.steps.length > 10) {
      throw new AppError(400, "Maximum 10 approval steps allowed");
    }

    // Check existing chain.
    const { data: existing } = await supabaseAdmin
      .from("offer_approvals")
      .select("id, step, required_role, approver_user_id, status, comment, decided_at")
      .eq("offer_id", offerId)
      .order("step", { ascending: true });

    if (existing && existing.length > 0) {
      res.status(200).json({ data: existing });
      return;
    }

    const rows = body.steps.map((s, i) => ({
      offer_id: offerId,
      step: i + 1,
      required_role: s.required_role,
      status: "PENDING" as const,
    }));

    const { data: created, error } = await supabaseAdmin
      .from("offer_approvals")
      .insert(rows)
      .select("id, step, required_role, status, comment, decided_at")
      .order("step", { ascending: true });

    if (error || !created) {
      throw new AppError(500, "Failed to create approval chain");
    }

    res.status(201).json({ data: created });
  }
);

// ─── GET /offers/:id/approvals ───────────────────────────────────────────────

export const getApprovalChain = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const offerId = req.params["id"] as string;
    const institutionId = req.workspace?.institutionId ?? req.user!.activeInstitutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Workspace context required");

    await assertOfferInWorkspace(offerId, institutionId);

    const { data, error } = await supabaseAdmin
      .from("offer_approvals")
      .select(`
        id, step, required_role, approver_user_id, status, comment, decided_at, created_at,
        profiles:approver_user_id ( full_name, email )
      `)
      .eq("offer_id", offerId)
      .order("step", { ascending: true });

    if (error) throw new AppError(500, "Failed to load approval chain");

    res.status(200).json({ data: data ?? [] });
  }
);

// ─── POST /offers/:id/approvals/:step/approve|reject ─────────────────────────

async function decideOnStep(
  req: AuthenticatedRequest,
  res: Response,
  decision: "APPROVED" | "REJECTED"
): Promise<void> {
  const userId = req.user!.id;
  const offerId = req.params["id"] as string;
  const step = parseInt(req.params["step"] as string, 10);
  if (!Number.isFinite(step) || step < 1) throw new AppError(400, "Invalid step");

  const institutionId = req.workspace?.institutionId ?? req.user!.activeInstitutionId ?? req.user!.institutionId;
  if (!institutionId) throw new AppError(403, "Workspace context required");

  await assertOfferInWorkspace(offerId, institutionId);

  // Load the step.
  const { data: stepRow, error: stepErr } = await supabaseAdmin
    .from("offer_approvals")
    .select("id, step, required_role, status, offer_id")
    .eq("offer_id", offerId)
    .eq("step", step)
    .maybeSingle();

  if (stepErr || !stepRow) throw new AppError(404, "Approval step not found");
  if (stepRow.status !== "PENDING") {
    throw new AppError(409, `Step already ${stepRow.status.toLowerCase()}`);
  }

  // Earlier steps must all be APPROVED before this one.
  const { data: earlierSteps } = await supabaseAdmin
    .from("offer_approvals")
    .select("step, status")
    .eq("offer_id", offerId)
    .lt("step", step);

  const blocked = (earlierSteps ?? []).find((s) => s.status !== "APPROVED");
  if (blocked) {
    throw new AppError(409, `Earlier step ${blocked.step} must be approved first`);
  }

  // Verify approver's role matches required_role.
  const approverRole = await getApproverRole(userId, institutionId);
  if (!approverRole) throw new AppError(403, "Not a member of this institution");

  // OWNER can approve any step.
  if (approverRole !== "OWNER" && approverRole !== stepRow.required_role) {
    throw new AppError(403, `This step requires role: ${stepRow.required_role}`);
  }

  const body = req.body as ApprovalDecisionBody;

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("offer_approvals")
    .update({
      status: decision,
      approver_user_id: userId,
      comment: body.comment?.trim() || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", stepRow.id)
    .select("id, step, required_role, status, comment, decided_at, approver_user_id")
    .single();

  if (updateErr || !updated) throw new AppError(500, "Failed to record decision");

  res.status(200).json({ data: updated });
}

export const approveStep = asyncHandler(
  (req: AuthenticatedRequest, res: Response) => decideOnStep(req, res, "APPROVED")
);

export const rejectStep = asyncHandler(
  (req: AuthenticatedRequest, res: Response) => decideOnStep(req, res, "REJECTED")
);

// ─── Helper exposed to offers.controller for state-machine integration ───────
// Returns true if the offer's approval chain is fully approved (or has no chain).
// Called by `updateOfferStatus` before allowing DRAFT → SENT.

export async function isApprovalChainCleared(offerId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("offer_approvals")
    .select("status")
    .eq("offer_id", offerId);

  if (error) throw new AppError(500, "Failed to check approval chain");
  if (!data || data.length === 0) return true; // No chain = no gate

  return data.every((s) => s.status === "APPROVED");
}
