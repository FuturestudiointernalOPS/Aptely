import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { supabaseAdmin } from "../../config/supabase";
import type { CreateSalaryBandInput, UpdateSalaryBandInput, CreateCompReviewInput, CompReviewStatus } from "./compensation.schema";

// ─── Salary Bands ─────────────────────────────────────────────────────────────

// GET /compensation/bands
export async function listSalaryBands(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;

  const { data, error } = await supabaseAdmin
    .from("salary_bands")
    .select("id, level, band_min, band_max, band_median, currency, location, effective_date, source, job_position_id, job_positions(id, title)")
    .eq("institution_id", institutionId)
    .order("effective_date", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
}

// POST /compensation/bands
export async function createSalaryBand(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const body = req.body as CreateSalaryBandInput;

  if (!body.level) return res.status(400).json({ error: "level required" });

  const { data, error } = await supabaseAdmin
    .from("salary_bands")
    .insert({
      institution_id: institutionId,
      job_position_id: body.job_position_id,
      level: body.level,
      band_min: body.band_min,
      band_max: body.band_max,
      band_median: body.band_median,
      currency: body.currency ?? "EUR",
      location: body.location,
      effective_date: body.effective_date ?? new Date().toISOString().slice(0, 10),
      source: body.source ?? "internal",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
}

// PATCH /compensation/bands/:id
export async function updateSalaryBand(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { id } = req.params;
  const body = req.body as UpdateSalaryBandInput;

  // Explicit allowlist — never spread req.body directly into update
  const updates: Record<string, unknown> = {};
  if (body.level !== undefined) updates.level = body.level;
  if (body.band_min !== undefined) updates.band_min = body.band_min;
  if (body.band_max !== undefined) updates.band_max = body.band_max;
  if (body.band_median !== undefined) updates.band_median = body.band_median;
  if (body.currency !== undefined) updates.currency = body.currency;
  if (body.location !== undefined) updates.location = body.location;
  if (body.effective_date !== undefined) updates.effective_date = body.effective_date;
  if (body.source !== undefined) updates.source = body.source;

  const { data, error } = await supabaseAdmin
    .from("salary_bands")
    .update(updates)
    .eq("id", id)
    .eq("institution_id", institutionId)
    .select()
    .single();

  if (error?.code === "PGRST116") return res.status(404).json({ error: "Band not found" });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
}

// DELETE /compensation/bands/:id
export async function deleteSalaryBand(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from("salary_bands")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
}

// ─── Compensation History ─────────────────────────────────────────────────────

// GET /compensation/:userId/history
export async function getCompHistory(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { userId: targetUserId } = req.params;

  const { data, error } = await supabaseAdmin
    .from("compensation_history")
    .select("id, effective_date, previous_salary, new_salary, change_reason, change_pct, status, notes, created_at, submitted_by, hr_approved_by, hr_approved_at")
    .eq("employee_user_id", targetUserId)
    .eq("institution_id", institutionId)
    .order("effective_date", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
}

// POST /compensation/:userId/review
export async function createCompReview(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const userId = req.user!.id;
  const { userId: targetUserId } = req.params;
  const body = req.body as CreateCompReviewInput;

  if (!body.new_salary || !body.effective_date) {
    return res.status(400).json({ error: "new_salary and effective_date required" });
  }

  // Verify target has an employee record in this institution
  const { data: empRecord } = await supabaseAdmin
    .from("employee_records")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!empRecord) return res.status(404).json({ error: "Employee not found" });

  // Compute change percentage
  const changePct = body.previous_salary && body.previous_salary > 0
    ? Math.round(((body.new_salary - body.previous_salary) / body.previous_salary) * 100)
    : null;

  const { data, error } = await supabaseAdmin
    .from("compensation_history")
    .insert({
      institution_id: institutionId,
      employee_user_id: targetUserId,
      effective_date: body.effective_date,
      previous_salary: body.previous_salary,
      new_salary: body.new_salary,
      change_reason: body.change_reason,
      change_pct: changePct,
      status: "draft",
      submitted_by: userId,
      notes: body.notes,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
}

const APPROVAL_FLOW: Record<string, CompReviewStatus> = {
  draft:            "submitted",
  submitted:        "hr_approved",
  hr_approved:      "finance_approved",
  finance_approved: "ceo_approved",
  ceo_approved:     "effective",
};

// Roles that can advance each stage. All stages require compensation.manage permission (already enforced by router).
// Additional role check per stage prevents SoD bypass.
const STAGE_ROLES: Record<string, string[]> = {
  draft:            ["OWNER", "ADMIN", "HR_LEAD", "STANDARD_HR"],       // submit
  submitted:        ["OWNER", "ADMIN", "HR_LEAD"],                       // hr_approved
  hr_approved:      ["OWNER", "ADMIN", "HR_LEAD"],                       // finance_approved
  finance_approved: ["OWNER", "ADMIN"],                                   // ceo_approved
  ceo_approved:     ["OWNER", "ADMIN"],                                   // effective
};

// PATCH /compensation/:userId/review/:id
export async function updateCompReview(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const userId = req.user!.id;
  const { userId: targetUserId, id: reviewId } = req.params;

  // Fetch actual role from DB — req.workspace is not populated for this route
  const { data: membership } = await supabaseAdmin
    .from("institution_members")
    .select("role_specialization, status")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  const role = (membership?.role_specialization as string | null) ?? (membership?.status as string | null) ?? "";
  const { action } = req.body as { action?: "approve" | "submit"; notes?: string; new_salary?: number; effective_date?: string; change_reason?: string };

  const { data: review } = await supabaseAdmin
    .from("compensation_history")
    .select("id, status, submitted_by, hr_approved_by")
    .eq("id", reviewId)
    .eq("employee_user_id", targetUserId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!review) return res.status(404).json({ error: "Review not found" });

  const updates: Record<string, unknown> = {};

  if (action === "approve" || action === "submit") {
    const nextStatus = APPROVAL_FLOW[review.status];
    if (!nextStatus) return res.status(400).json({ error: "Cannot advance from current status" });

    // Per-stage role check
    const allowedRoles = STAGE_ROLES[review.status] ?? [];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `Insufficient role to advance from ${review.status}` });
    }

    // Self-approval prevention: submitter cannot approve their own review
    if (review.status !== "draft" && (review as any).submitted_by === userId) {
      return res.status(403).json({ error: "Cannot approve your own submission" });
    }

    updates.status = nextStatus;
    if (review.status === "submitted") {
      updates.hr_approved_by = userId;
      updates.hr_approved_at = new Date().toISOString();
    }
  } else {
    // Direct field updates (while in draft) — explicit allowlist
    if (review.status !== "draft") return res.status(400).json({ error: "Can only edit draft reviews" });
    if (req.body.new_salary !== undefined) updates.new_salary = req.body.new_salary;
    if (req.body.effective_date !== undefined) updates.effective_date = req.body.effective_date;
    if (req.body.change_reason !== undefined) updates.change_reason = req.body.change_reason;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
  }

  const { data, error } = await supabaseAdmin
    .from("compensation_history")
    .update(updates)
    .eq("id", reviewId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
}

// GET /compensation/pending-approvals
export async function getPendingApprovals(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;

  const { data, error } = await supabaseAdmin
    .from("compensation_history")
    .select("id, effective_date, previous_salary, new_salary, change_reason, change_pct, status, created_at, employee_user_id")
    .eq("institution_id", institutionId)
    .in("status", ["submitted", "hr_approved", "finance_approved", "ceo_approved"])
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
}

// GET /compensation/analytics
export async function getCompAnalytics(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;

  // Count reviews by status
  const { data: reviews } = await supabaseAdmin
    .from("compensation_history")
    .select("status, new_salary, employee_user_id")
    .eq("institution_id", institutionId);

  if (!reviews) return res.json({ data: {} });

  const pending = reviews.filter(r => ["submitted", "hr_approved", "finance_approved"].includes(r.status)).length;
  const effective = reviews.filter(r => r.status === "effective");
  const avgSalary = effective.length > 0
    ? Math.round(effective.reduce((s, r) => s + (r.new_salary ?? 0), 0) / effective.length)
    : 0;

  // Count bands
  const { count: bandsCount } = await supabaseAdmin
    .from("salary_bands")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", institutionId);

  return res.json({
    data: {
      pendingApprovals: pending,
      effectiveReviews: effective.length,
      averageSalary: avgSalary,
      salaryBands: bandsCount ?? 0,
    },
  });
}
