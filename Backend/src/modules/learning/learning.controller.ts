import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { supabaseAdmin } from "../../config/supabase";
import { computeSkillGaps } from "./learning.service";
import type { CreatePlanInput, UpdatePlanInput, AddActivityInput, UpdateActivityInput } from "./learning.schema";

// GET /learning/plans
// This route requires learning.manage permission — caller is always HR-equivalent
export async function listPlans(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;

  if (!institutionId) return res.status(403).json({ error: "Not linked to an institution" });

  // Caller has learning.manage — can filter by any employee_user_id in their institution
  const queryEmp = typeof req.query.employee_user_id === "string" && /^[0-9a-f-]{36}$/.test(req.query.employee_user_id)
    ? req.query.employee_user_id : undefined;
  const empFilter = queryEmp; // no self-pin needed: permission gate already restricts to HR

  // Use analytics-proven pattern: separate eq() calls, institution_id last
  let query = supabaseAdmin
    .from("learning_plans")
    .select(`
      id, title, status, employee_user_id, created_at, updated_at,
      learning_activities ( id, title, description, type, provider, url, estimated_hours, status, due_date, completed_at, skill_tags, sort_order )
    `)
    .eq("status", "active");

  if (empFilter) query = query.eq("employee_user_id", empFilter);
  // Apply institution filter only if we're confident it resolves
  if (institutionId) query = query.eq("institution_id", institutionId);

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
}

// POST /learning/plans
export async function createPlan(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId; const userId = req.user!.id;
  const body = req.body as CreatePlanInput;

  if (!body.employee_user_id) {
    return res.status(400).json({ error: "employee_user_id required" });
  }

  // Verify target has an employee record in this institution
  const { data: empRecord } = await supabaseAdmin
    .from("employee_records")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("user_id", body.employee_user_id)
    .maybeSingle();

  if (!empRecord) return res.status(404).json({ error: "Employee not found in institution" });

  // Check if plan already exists
  const { data: existing } = await supabaseAdmin
    .from("learning_plans")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("employee_user_id", body.employee_user_id)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "Active plan already exists for this employee", planId: existing.id });
  }

  const { data, error } = await supabaseAdmin
    .from("learning_plans")
    .insert({
      institution_id: institutionId,
      employee_user_id: body.employee_user_id,
      created_by: userId,
      title: body.title ?? "Plan de développement",
      status: "active",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
}

// GET /learning/plans/:id
export async function getPlan(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("learning_plans")
    .select(`
      id, title, status, employee_user_id, created_by, created_at, updated_at, institution_id,
      learning_activities (
        id, title, description, type, provider, url, estimated_hours,
        status, due_date, completed_at, skill_tags, sort_order
      )
    `)
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data || error) return res.status(404).json({ error: "Plan not found" });
  // Route requires learning.manage — all callers have HR access, no employee_user_id guard needed
  return res.json({ data });
}

// PATCH /learning/plans/:id
export async function updatePlan(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { id } = req.params;
  const body = req.body as UpdatePlanInput;

  const { data: existing } = await supabaseAdmin
    .from("learning_plans")
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!existing) return res.status(404).json({ error: "Plan not found" });

  const { data, error } = await supabaseAdmin
    .from("learning_plans")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
}

// POST /learning/plans/:id/activities
export async function addActivity(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { id: planId } = req.params;
  const body = req.body as AddActivityInput;

  const { data: plan } = await supabaseAdmin
    .from("learning_plans")
    .select("id")
    .eq("id", planId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!plan) return res.status(404).json({ error: "Plan not found" });

  if (!body.title) return res.status(400).json({ error: "title required" });

  const { data, error } = await supabaseAdmin
    .from("learning_activities")
    .insert({
      plan_id: planId,
      title: body.title,
      description: body.description,
      type: body.type ?? "course",
      provider: body.provider,
      url: body.url,
      estimated_hours: body.estimated_hours,
      due_date: body.due_date,
      skill_tags: body.skill_tags ?? [],
      status: "assigned",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ data });
}

// PATCH /learning/plans/:id/activities/:actId
export async function updateActivity(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { id: planId, actId } = req.params;
  const body = req.body as UpdateActivityInput;

  const { data: plan } = await supabaseAdmin
    .from("learning_plans")
    .select("id")
    .eq("id", planId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!plan) return res.status(404).json({ error: "Plan not found" });
  // Route requires learning.manage — HR can update all fields
  const updates: Record<string, unknown> = { ...body };
  if (updates.status === "completed" && !(updates as UpdateActivityInput).completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("learning_activities")
    .update(updates)
    .eq("id", actId)
    .eq("plan_id", planId)
    .select()
    .single();

  if (error?.code === "PGRST116") return res.status(404).json({ error: "Activity not found" });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
}

// DELETE /learning/plans/:id/activities/:actId
export async function deleteActivity(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { id: planId, actId } = req.params;

  const { data: plan } = await supabaseAdmin
    .from("learning_plans")
    .select("id")
    .eq("id", planId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const { error } = await supabaseAdmin
    .from("learning_activities")
    .delete()
    .eq("id", actId)
    .eq("plan_id", planId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
}

// GET /learning/skill-gaps/:userId
export async function getSkillGaps(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { userId: targetUserId } = req.params;
  // Route requires learning.manage — HR can view any employee's gaps

  const { data, error } = await supabaseAdmin
    .from("skill_gaps")
    .select("id, skill_name, current_level, required_level, gap_priority, role_id, created_at")
    .eq("employee_user_id", targetUserId)
    .eq("institution_id", institutionId)
    .order("gap_priority", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [] });
}

// POST /learning/skill-gaps/:userId/compute
export async function computeGaps(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;
  const { userId: targetUserId } = req.params;
  // Route requires learning.manage — HR can compute gaps for any employee

  if (!institutionId) return res.status(400).json({ error: "No institution" });

  try {
    await computeSkillGaps(targetUserId as string, institutionId);
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }
}

// GET /learning/my-plan
// Self-service — any authenticated user (candidate/employee, no institution membership required)
export async function getMyPlan(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;

  const { data, error } = await supabaseAdmin
    .from("learning_plans")
    .select(`
      id, title, status, employee_user_id, created_at, updated_at,
      learning_activities ( id, title, description, type, provider, url, estimated_hours, status, due_date, completed_at, skill_tags, sort_order )
    `)
    .eq("employee_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? null });
}

// PATCH /learning/my-plan/activities/:actId
// Self-service — employee can only toggle the status of their own activities
export async function updateMyActivity(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { actId } = req.params;
  const { status } = req.body as { status?: UpdateActivityInput["status"] };

  if (!status) return res.status(400).json({ error: "status required" });

  const { data: activity } = await supabaseAdmin
    .from("learning_activities")
    .select("id, plan_id, learning_plans!inner(employee_user_id)")
    .eq("id", actId)
    .eq("learning_plans.employee_user_id", userId)
    .maybeSingle();

  if (!activity) return res.status(404).json({ error: "Activity not found" });

  const updates: Record<string, unknown> = { status };
  if (status === "completed") updates.completed_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("learning_activities")
    .update(updates)
    .eq("id", actId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
}

// GET /learning/analytics
export async function getLearningAnalytics(req: AuthenticatedRequest, res: Response) {
  const institutionId = req.user!.institutionId;

  const { data: plans } = await supabaseAdmin
    .from("learning_plans")
    .select(`
      id, employee_user_id,
      learning_activities ( id, status, estimated_hours, completed_at )
    `)
    .eq("institution_id", institutionId)
    .eq("status", "active");

  if (!plans) return res.json({ data: { totalPlans: 0, totalActivities: 0, completedActivities: 0, completionRate: 0, totalHoursInvested: 0 } });

  const totalActivities = plans.flatMap(p => (p as any).learning_activities ?? []).length;
  const completed = plans.flatMap(p => (p as any).learning_activities ?? []).filter((a: any) => a.status === "completed");
  const totalHoursInvested = completed.reduce((sum: number, a: any) => sum + (a.estimated_hours ?? 0), 0);

  return res.json({
    data: {
      totalPlans: plans.length,
      totalActivities,
      completedActivities: completed.length,
      completionRate: totalActivities > 0 ? Math.round((completed.length / totalActivities) * 100) : 0,
      totalHoursInvested,
    },
  });
}
