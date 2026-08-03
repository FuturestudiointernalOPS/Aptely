import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import type {
  CreateLeaveRequestInput,
  ReviewLeaveRequestInput,
  UpdatePoliciesInput,
  ListRequestsQuery,
} from "./leave.schema";

// ─── List requests ────────────────────────────────────────────────────────────

export const listLeaveRequests = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { status, employee_user_id, page = 1, limit = 50 } = req.query as unknown as ListRequestsQuery;
    const from = (page - 1) * limit;

    let query = supabaseAdmin
      .from("leave_requests")
      .select(`
        id, leave_type, start_date, end_date, days_count, reason, status,
        reviewed_at, review_note, created_at,
        employee_user_id,
        profiles!leave_requests_employee_user_id_fkey(id, full_name, avatar_url),
        reviewer:profiles!leave_requests_reviewed_by_fkey(id, full_name)
      `)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (status) query = query.eq("status", status);
    if (employee_user_id) query = query.eq("employee_user_id", employee_user_id);

    const { data, error } = await query;
    if (error) throw new AppError(500, "Failed to fetch leave requests");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── My requests (employee self-service) ─────────────────────────────────────

export const listMyLeaveRequests = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days_count, reason, status, reviewed_at, review_note, created_at")
      .eq("institution_id", institutionId)
      .eq("employee_user_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch leave requests");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── Submit request ───────────────────────────────────────────────────────────

export const createLeaveRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const body = req.body as CreateLeaveRequestInput;

    if (new Date(body.start_date) > new Date(body.end_date)) {
      throw new AppError(400, "start_date must be before end_date");
    }

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .insert({
        institution_id: institutionId,
        employee_user_id: req.user!.id,
        leave_type: body.leave_type,
        start_date: body.start_date,
        end_date: body.end_date,
        days_count: body.days_count,
        reason: body.reason ?? null,
        status: "PENDING",
      })
      .select("id, leave_type, start_date, end_date, days_count, reason, status, created_at")
      .single();

    if (error) throw new AppError(500, "Failed to create leave request");
    res.status(201).json({ data });
  }
);

// ─── Approve ──────────────────────────────────────────────────────────────────

export const approveLeaveRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { id } = req.params;
    const { review_note } = req.body as ReviewLeaveRequestInput;

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .update({
        status: "APPROVED",
        reviewed_by: req.user!.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note ?? null,
      })
      .eq("id", id)
      .eq("institution_id", institutionId)
      .eq("status", "PENDING")
      .select("id, status, reviewed_at")
      .single();

    if (error || !data) throw new AppError(404, "Leave request not found or not pending");
    res.status(200).json({ data });
  }
);

// ─── Reject ───────────────────────────────────────────────────────────────────

export const rejectLeaveRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { id } = req.params;
    const { review_note } = req.body as ReviewLeaveRequestInput;

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .update({
        status: "REJECTED",
        reviewed_by: req.user!.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note ?? null,
      })
      .eq("id", id)
      .eq("institution_id", institutionId)
      .eq("status", "PENDING")
      .select("id, status, reviewed_at")
      .single();

    if (error || !data) throw new AppError(404, "Leave request not found or not pending");
    res.status(200).json({ data });
  }
);

// ─── Cancel (employee, PENDING only) ─────────────────────────────────────────

export const cancelLeaveRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .eq("institution_id", institutionId)
      .eq("employee_user_id", req.user!.id)
      .eq("status", "PENDING")
      .select("id, status")
      .single();

    if (error || !data) throw new AppError(404, "Leave request not found or not cancellable");
    res.status(200).json({ data });
  }
);

// ─── Balance ──────────────────────────────────────────────────────────────────

export const getLeaveBalance = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;
    const currentYear = new Date().getFullYear();

    const [policiesResult, requestsResult] = await Promise.all([
      supabaseAdmin
        .from("leave_policies")
        .select("leave_type, days_per_year, carry_over_days")
        .eq("institution_id", institutionId),
      supabaseAdmin
        .from("leave_requests")
        .select("leave_type, days_count, status")
        .eq("institution_id", institutionId)
        .eq("employee_user_id", userId)
        .eq("status", "APPROVED")
        .gte("start_date", `${currentYear}-01-01`)
        .lte("start_date", `${currentYear}-12-31`),
    ]);

    if (policiesResult.error) throw new AppError(500, "Failed to fetch policies");
    if (requestsResult.error) throw new AppError(500, "Failed to fetch requests");

    const policies = policiesResult.data ?? [];
    const approved = requestsResult.data ?? [];

    const LEAVE_TYPES = ["VACATION", "SICK", "UNPAID", "PARENTAL", "OTHER"] as const;
    type LeaveType = typeof LEAVE_TYPES[number];

    const balance = LEAVE_TYPES.map((type: LeaveType) => {
      const policy = policies.find((p) => p.leave_type === type);
      const used = approved
        .filter((r) => r.leave_type === type)
        .reduce((sum, r) => sum + Number(r.days_count), 0);
      const allowed = policy ? Number(policy.days_per_year) + Number(policy.carry_over_days) : 0;
      return { leave_type: type, allowed, used, remaining: Math.max(0, allowed - used) };
    });

    res.status(200).json({ data: balance });
  }
);

// ─── Policies ────────────────────────────────────────────────────────────────

export const getLeavePolices = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { data, error } = await supabaseAdmin
      .from("leave_policies")
      .select("id, leave_type, days_per_year, carry_over_days")
      .eq("institution_id", institutionId)
      .order("leave_type");

    if (error) throw new AppError(500, "Failed to fetch policies");
    res.status(200).json({ data: data ?? [] });
  }
);

export const updateLeavePolices = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { policies } = req.body as UpdatePoliciesInput;

    for (const p of policies) {
      const { error } = await supabaseAdmin
        .from("leave_policies")
        .upsert(
          {
            institution_id: institutionId,
            leave_type: p.leave_type,
            days_per_year: p.days_per_year,
            carry_over_days: p.carry_over_days,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "institution_id,leave_type" }
        );
      if (error) throw new AppError(500, `Failed to upsert policy for ${p.leave_type}`);
    }

    res.status(200).json({ success: true });
  }
);
