import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler, paginate } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { dispatchWebhook } from "@/modules/webhooks/webhooks.service";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ListEmployeesQuery,
  CreateReviewInput,
  UpdateReviewInput,
} from "./employees.schema";

// ─── GET /employees ────────────────────────────────────────────────────────────

export const listEmployees = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { status, department_id, page, limit } =
      (res.locals["query"] ?? req.query) as ListEmployeesQuery;

    const { offset, limit: take } = paginate(String(page), String(limit), 50);

    let query = supabaseAdmin
      .from("employee_records")
      .select(
        `
        id, user_id, employment_type, employment_status, start_date, end_date,
        salary_amount, salary_currency, contract_notes, created_at, updated_at,
        application_id,
        profiles!user_id(id, full_name, email, avatar_url),
        job_positions(id, title),
        departments(id, name)
      `,
        { count: "exact" }
      )
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (status) query = query.eq("employment_status", status);
    if (department_id) query = query.eq("department_id", department_id);

    const { data, error, count } = await query;
    if (error) throw new AppError(500, "Failed to fetch employees");

    res.status(200).json({ data, total: count ?? 0 });
  }
);

// ─── GET /employees/:userId ─────────────────────────────────────────────────────

export const getEmployee = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params as { userId: string };

    const { data, error } = await supabaseAdmin
      .from("employee_records")
      .select(
        `
        id, user_id, employment_type, employment_status, start_date, end_date,
        salary_amount, salary_currency, contract_notes, created_at, updated_at,
        application_id,
        profiles!user_id(id, full_name, email, avatar_url),
        job_positions(id, title, department_id),
        departments(id, name),
        manager:profiles!manager_user_id(id, full_name, avatar_url)
      `
      )
      .eq("institution_id", institutionId)
      .eq("user_id", userId)
      .single();

    if (error || !data) throw new AppError(404, "Employee not found");

    res.status(200).json({ data });
  }
);

// ─── POST /employees ────────────────────────────────────────────────────────────

export const createEmployee = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const body = req.body as CreateEmployeeInput;

    const { data: existing } = await supabaseAdmin
      .from("employee_records")
      .select("id")
      .eq("institution_id", institutionId)
      .eq("user_id", body.user_id)
      .single();

    if (existing) throw new AppError(409, "Employee record already exists for this user");

    const { data, error } = await supabaseAdmin
      .from("employee_records")
      .insert({
        institution_id: institutionId,
        ...body,
      })
      .select()
      .single();

    if (error || !data) throw new AppError(500, "Failed to create employee record");

    res.status(201).json({ data });
  }
);

// ─── PATCH /employees/:userId ───────────────────────────────────────────────────

export const updateEmployee = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params as { userId: string };
    const body = req.body as UpdateEmployeeInput;

    const { data, error } = await supabaseAdmin
      .from("employee_records")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("institution_id", institutionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) throw new AppError(404, "Employee not found or update failed");

    res.status(200).json({ data });
  }
);

// ─── DELETE /employees/:userId ──────────────────────────────────────────────────
// Sets status → TERMINATED (soft delete)

export const terminateEmployee = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params as { userId: string };
    const { end_date } = req.body as { end_date?: string };

    const { data, error } = await supabaseAdmin
      .from("employee_records")
      .update({
        employment_status: "TERMINATED",
        end_date: end_date ?? new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      })
      .eq("institution_id", institutionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) throw new AppError(404, "Employee not found");

    res.status(200).json({ data });
  }
);

// ─── Performance Reviews ──────────────────────────────────────────────────────

export const listReviews = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("performance_reviews")
      .select(`
        id, period, year, overall_rating, strengths, improvements,
        goals_next_period, status, submitted_at, acknowledged_at, created_at,
        reviewer:profiles!performance_reviews_reviewer_user_id_fkey(id, full_name, avatar_url)
      `)
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch reviews");
    res.status(200).json({ data: data ?? [] });
  }
);

export const createReview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;
    const body = req.body as CreateReviewInput;

    const { data, error } = await supabaseAdmin
      .from("performance_reviews")
      .insert({
        institution_id: institutionId,
        employee_user_id: userId,
        reviewer_user_id: req.user!.id,
        period: body.period,
        year: body.year,
        overall_rating: body.overall_rating ?? null,
        strengths: body.strengths ?? null,
        improvements: body.improvements ?? null,
        goals_next_period: body.goals_next_period ?? null,
        status: "DRAFT",
      })
      .select("id, period, year, overall_rating, status, created_at")
      .single();

    if (error) throw new AppError(500, "Failed to create review");
    res.status(201).json({ data });
  }
);

export const updateReview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId, reviewId } = req.params;
    const body = req.body as UpdateReviewInput;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.overall_rating !== undefined) updates.overall_rating = body.overall_rating;
    if (body.strengths !== undefined) updates.strengths = body.strengths;
    if (body.improvements !== undefined) updates.improvements = body.improvements;
    if (body.goals_next_period !== undefined) updates.goals_next_period = body.goals_next_period;
    if (body.status === "SUBMITTED") {
      updates.status = "SUBMITTED";
      updates.submitted_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("performance_reviews")
      .update(updates)
      .eq("id", reviewId)
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .select("id, period, year, overall_rating, status, submitted_at")
      .single();

    if (error || !data) throw new AppError(404, "Review not found");
    res.status(200).json({ data });
  }
);

export const acknowledgeReview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId, reviewId } = req.params;

    // Only the employee themselves can acknowledge
    if (req.user!.id !== userId) {
      throw new AppError(403, "Only the employee can acknowledge their own review");
    }

    const { data, error } = await supabaseAdmin
      .from("performance_reviews")
      .update({ status: "ACKNOWLEDGED", acknowledged_at: new Date().toISOString() })
      .eq("id", reviewId)
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .eq("status", "SUBMITTED")
      .select("id, status, acknowledged_at")
      .single();

    if (error || !data) throw new AppError(404, "Review not found or not submitted");
    res.status(200).json({ data });
  }
);

// ─── Internal helper: auto-create employee record on HIRED ─────────────────────
// Called from applications.controller.ts when status → HIRED

export async function autoCreateEmployeeOnHired(
  institutionId: string,
  userId: string,
  applicationId: string,
  jobPositionId?: string | null,
  departmentId?: string | null
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("employee_records")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("user_id", userId)
    .single();

  if (existing) return; // already created

  const { error } = await supabaseAdmin.from("employee_records").insert({
    institution_id: institutionId,
    user_id: userId,
    application_id: applicationId,
    job_position_id: jobPositionId ?? null,
    department_id: departmentId ?? null,
    employment_type: "CDI",
    employment_status: "ACTIVE",
    start_date: new Date().toISOString().split("T")[0],
  });

  if (error) {
    console.error("[Employees] Failed to auto-create employee record on HIRED:", error);
  } else {
    void dispatchWebhook(institutionId, "EMPLOYEE_HIRED", {
      institution_id: institutionId,
      user_id: userId,
      application_id: applicationId,
    });
    void autoCreateOnboardingChecklistOnHired(institutionId, applicationId);
  }
}

async function autoCreateOnboardingChecklistOnHired(
  institutionId: string,
  applicationId: string
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("onboarding_checklists")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();

  if (existing) return;

  const { data: template } = await supabaseAdmin
    .from("onboarding_templates")
    .select("id, tasks_json")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) return;

  const { data: checklist, error: clError } = await supabaseAdmin
    .from("onboarding_checklists")
    .insert({
      application_id: applicationId,
      template_id: template.id,
      status: "NOT_STARTED",
    })
    .select("id")
    .single();

  if (clError || !checklist) {
    console.error("[Onboarding] Failed to auto-create checklist on HIRED:", clError);
    return;
  }

  const tasks = ((template.tasks_json as Array<{
    title: string;
    description?: string;
    assigneeType?: string;
    position?: number;
  }>) ?? []).map((task, idx) => ({
    checklist_id: checklist.id,
    title: task.title,
    description: task.description ?? null,
    assignee_type: task.assigneeType ?? "CANDIDATE",
    position: task.position ?? idx,
    status: "PENDING",
  }));

  if (tasks.length > 0) {
    const { error: tasksError } = await supabaseAdmin
      .from("onboarding_tasks")
      .insert(tasks);
    if (tasksError) {
      console.error("[Onboarding] Failed to create tasks on HIRED:", tasksError);
      await supabaseAdmin.from("onboarding_checklists").delete().eq("id", checklist.id);
    }
  }
}
