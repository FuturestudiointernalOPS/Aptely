import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { uniqueSessionCode, computeGoalProgress, guardGoalAccess, guardMemberAccess } from "./goals.service";

// ─── GET /goals ────────────────────────────────────────────────────────────────

export const listGoals = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { scope, status, owner_user_id } = req.query as Record<string, string>;

    let query = supabaseAdmin
      .from("goals")
      .select(`
        id, name, objective, description, scope, status,
        start_date, due_date, session_code, created_by, created_at, updated_at,
        owner_user_id, parent_goal_id,
        profiles!owner_user_id(id, full_name, avatar_url)
      `)
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });

    if (scope) query = query.eq("scope", scope);
    if (status) query = query.eq("status", status);
    if (owner_user_id) query = query.eq("owner_user_id", owner_user_id);

    const { data, error } = await query;
    if (error) throw new AppError(500, `Failed to list goals: ${error.message}`);

    res.status(200).json({ data });
  }
);

// ─── POST /goals ───────────────────────────────────────────────────────────────

export const createGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const {
      name, objective, description, scope, owner_user_id,
      parent_goal_id, start_date, due_date, icebreaker_theme,
    } = req.body;

    if (!name?.trim()) throw new AppError(400, "Goal name is required");
    if (!objective?.trim()) throw new AppError(400, "Goal objective is required");

    // Validate cross-tenant references
    if (owner_user_id && owner_user_id !== userId) {
      await guardMemberAccess(owner_user_id, institutionId);
    }
    if (parent_goal_id) {
      await guardGoalAccess(parent_goal_id, institutionId);
    }

    const { data, error } = await supabaseAdmin
      .from("goals")
      .insert({
        institution_id: institutionId,
        name: name.trim(),
        objective: objective.trim(),
        description: description || null,
        scope: scope ?? "individual",
        owner_user_id: owner_user_id ?? userId,
        parent_goal_id: parent_goal_id ?? null,
        start_date: start_date ?? null,
        due_date: due_date ?? null,
        icebreaker_theme: icebreaker_theme ?? null,
        created_by: userId,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw new AppError(500, `Failed to create goal: ${error.message}`);
    res.status(201).json({ data });
  }
);

// ─── GET /goals/:id ────────────────────────────────────────────────────────────

export const getGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("goals")
      .select(`
        *,
        profiles!owner_user_id(id, full_name, avatar_url),
        key_results(id, description, kpi, target_value, current_value, status, sort_order),
        goal_tasks(id, title, description, status, start_date, due_date, sort_order, key_result_id, owner_id,
          profiles!owner_id(id, full_name, avatar_url)
        ),
        goal_roles(id, user_id, role, focus_area,
          profiles!user_id(id, full_name, avatar_url)
        ),
        goal_commitments(user_id, committed_at),
        goal_validations(user_id, validated_at)
      `)
      .eq("institution_id", institutionId)
      .eq("id", id)
      .single();

    if (error || !data) throw new AppError(404, "Goal not found");

    const progress = await computeGoalProgress(id as string);
    res.status(200).json({ data: { ...data, progress } });
  }
);

// ─── PATCH /goals/:id ──────────────────────────────────────────────────────────

export const updateGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { id } = req.params;
    const { owner_user_id, parent_goal_id, ...rest } = req.body;

    // Validate cross-tenant refs if provided
    if (owner_user_id) await guardMemberAccess(owner_user_id, institutionId);
    if (parent_goal_id) await guardGoalAccess(parent_goal_id, institutionId);

    const allowed = [
      "name", "objective", "description", "scope",
      "start_date", "due_date", "status", "icebreaker_theme",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in rest) updates[key] = rest[key];
    }
    if (owner_user_id !== undefined) updates["owner_user_id"] = owner_user_id;
    if (parent_goal_id !== undefined) updates["parent_goal_id"] = parent_goal_id;

    const { data, error } = await supabaseAdmin
      .from("goals")
      .update(updates)
      .eq("institution_id", institutionId)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(500, `Failed to update goal: ${error.message}`);
    res.status(200).json({ data });
  }
);

// ─── DELETE /goals/:id ─────────────────────────────────────────────────────────

export const deleteGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("goals")
      .delete()
      .eq("institution_id", institutionId)
      .eq("id", id);

    if (error) throw new AppError(500, `Failed to delete goal: ${error.message}`);
    res.status(204).send();
  }
);

// ─── Key Results ───────────────────────────────────────────────────────────────

export const listKRs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { data, error } = await supabaseAdmin
      .from("key_results").select("*").eq("goal_id", id).order("sort_order");
    if (error) throw new AppError(500, "Failed to list key results");
    res.status(200).json({ data });
  }
);

export const createKR = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { description, kpi, target_value, sort_order } = req.body;
    if (!description?.trim()) throw new AppError(400, "KR description required");
    if (!kpi?.trim()) throw new AppError(400, "KR KPI required");

    const { data, error } = await supabaseAdmin
      .from("key_results")
      .insert({ goal_id: id, description, kpi, target_value: target_value ?? null, sort_order: sort_order ?? 0 })
      .select().single();
    if (error) throw new AppError(500, `Failed to create KR: ${error.message}`);
    res.status(201).json({ data });
  }
);

export const updateKR = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id, krId } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const allowed = ["description", "kpi", "target_value", "current_value", "status", "sort_order"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const { data, error } = await supabaseAdmin
      .from("key_results").update(updates).eq("id", krId).eq("goal_id", id).select().single();
    if (error) throw new AppError((error as { code?: string }).code === "PGRST116" ? 404 : 500, `Failed to update KR: ${error.message}`);
    res.status(200).json({ data });
  }
);

export const deleteKR = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id, krId } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { error } = await supabaseAdmin
      .from("key_results").delete().eq("id", krId).eq("goal_id", id);
    if (error) throw new AppError(500, "Failed to delete KR");
    res.status(204).send();
  }
);

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const listTasks = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { data, error } = await supabaseAdmin
      .from("goal_tasks").select("*, profiles!owner_id(id, full_name, avatar_url)")
      .eq("goal_id", id).order("sort_order");
    if (error) throw new AppError(500, "Failed to list tasks");
    res.status(200).json({ data });
  }
);

export const createTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { title, description, owner_id, key_result_id, start_date, due_date, sort_order } = req.body;
    if (!title?.trim()) throw new AppError(400, "Task title required");

    // Validate owner belongs to institution
    if (owner_id) await guardMemberAccess(owner_id, institutionId);

    const { data, error } = await supabaseAdmin
      .from("goal_tasks")
      .insert({ goal_id: id, title, description: description ?? null, owner_id: owner_id ?? null, key_result_id: key_result_id ?? null, start_date: start_date ?? null, due_date: due_date ?? null, sort_order: sort_order ?? 0 })
      .select().single();
    if (error) throw new AppError(500, `Failed to create task: ${error.message}`);
    res.status(201).json({ data });
  }
);

export const updateTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id, taskId } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const allowed = ["title", "description", "owner_id", "key_result_id", "status", "start_date", "due_date", "sort_order"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const { data, error } = await supabaseAdmin
      .from("goal_tasks").update(updates).eq("id", taskId).eq("goal_id", id).select().single();
    if (error) throw new AppError((error as { code?: string }).code === "PGRST116" ? 404 : 500, `Failed to update task: ${error.message}`);
    res.status(200).json({ data });
  }
);

export const deleteTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id, taskId } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { error } = await supabaseAdmin
      .from("goal_tasks").delete().eq("id", taskId).eq("goal_id", id);
    if (error) throw new AppError(500, "Failed to delete task");
    res.status(204).send();
  }
);

// ─── PACI Roles ───────────────────────────────────────────────────────────────

export const listRoles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { data, error } = await supabaseAdmin
      .from("goal_roles").select("*, profiles!user_id(id, full_name, avatar_url)").eq("goal_id", id);
    if (error) throw new AppError(500, "Failed to list roles");
    res.status(200).json({ data });
  }
);

export const assignRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { user_id, role, focus_area } = req.body;
    if (!user_id || !role) throw new AppError(400, "user_id and role required");
    await guardMemberAccess(user_id, institutionId);

    const { data, error } = await supabaseAdmin
      .from("goal_roles")
      .upsert({ goal_id: id, user_id, role, focus_area: focus_area ?? null }, { onConflict: "goal_id,user_id,role" })
      .select().single();
    if (error) throw new AppError(500, `Failed to assign role: ${error.message}`);
    res.status(201).json({ data });
  }
);

export const removeRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id, roleId } = req.params;
    await guardGoalAccess(id as string, institutionId);

    // Verify role belongs to this goal
    const { error } = await supabaseAdmin
      .from("goal_roles").delete().eq("id", roleId).eq("goal_id", id);
    if (error) throw new AppError(500, "Failed to remove role");
    res.status(204).send();
  }
);

// ─── Validate / Commit / Launch ───────────────────────────────────────────────

export const validateGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    await supabaseAdmin
      .from("goal_validations")
      .upsert({ goal_id: id, user_id: userId }, { onConflict: "goal_id,user_id" });

    res.status(200).json({ message: "Goal validated" });
  }
);

export const commitGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    await supabaseAdmin
      .from("goal_commitments")
      .upsert({ goal_id: id, user_id: userId }, { onConflict: "goal_id,user_id" });

    res.status(200).json({ message: "Commitment recorded" });
  }
);

export const launchGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;

    // Guard BEFORE creating session — prevents cross-tenant session creation
    await guardGoalAccess(id as string, institutionId);

    const code = await uniqueSessionCode();

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("goal_sessions")
      .insert({ goal_id: id, facilitator_id: userId, status: "live", current_step: "icebreaker" })
      .select().single();
    if (sessionError) throw new AppError(500, "Failed to create session");

    await supabaseAdmin
      .from("goals")
      .update({ status: "active", session_code: code })
      .eq("id", id)
      .eq("institution_id", institutionId);

    res.status(200).json({ data: { session, session_code: code } });
  }
);

export const completeGoal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("goals")
      .update({ status: "completed" })
      .eq("id", id)
      .eq("institution_id", institutionId)
      .select().single();
    if (error) throw new AppError(500, "Failed to complete goal");
    res.status(200).json({ data });
  }
);

// ─── Live Session ─────────────────────────────────────────────────────────────

export const getSession = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    await guardGoalAccess(id as string, institutionId);

    const { data, error } = await supabaseAdmin
      .from("goal_sessions").select("*").eq("goal_id", id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new AppError(500, "Failed to fetch session");
    res.status(200).json({ data });
  }
);

export const updateSessionStep = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    const { step } = req.body;
    if (!step) throw new AppError(400, "step required");
    await guardGoalAccess(id as string, institutionId);

    const { data: session } = await supabaseAdmin
      .from("goal_sessions").select("id").eq("goal_id", id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!session) throw new AppError(404, "No active session");

    const { data, error } = await supabaseAdmin
      .from("goal_sessions").update({ current_step: step }).eq("id", session.id).select().single();
    if (error) throw new AppError(500, "Failed to update step");
    res.status(200).json({ data });
  }
);

export const getSessionResponses = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    const { step } = req.query as { step?: string };
    await guardGoalAccess(id as string, institutionId);

    const { data: session } = await supabaseAdmin
      .from("goal_sessions").select("id").eq("goal_id", id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!session) { res.status(200).json({ data: [] }); return; }

    let query = supabaseAdmin
      .from("goal_session_responses").select("*").eq("session_id", session.id).order("created_at");
    if (step) query = query.eq("step", step);

    const { data, error } = await query;
    if (error) throw new AppError(500, "Failed to fetch responses");
    res.status(200).json({ data });
  }
);

export const addSessionResponse = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");
    const { id } = req.params;
    const { participant_name, step, response_text } = req.body;
    if (!participant_name || !step) throw new AppError(400, "participant_name and step required");
    await guardGoalAccess(id as string, institutionId);

    const { data: session } = await supabaseAdmin
      .from("goal_sessions").select("id").eq("goal_id", id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!session) throw new AppError(404, "No active session");

    const { data, error } = await supabaseAdmin
      .from("goal_session_responses")
      .insert({ session_id: session.id, participant_name, step, response_text: response_text ?? null })
      .select().single();
    if (error) throw new AppError(500, "Failed to add response");
    res.status(201).json({ data });
  }
);
