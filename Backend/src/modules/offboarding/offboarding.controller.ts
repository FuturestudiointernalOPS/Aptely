import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import type { CreateOffboardingInput, UpdateOffboardingInput, AddTaskInput } from "./offboarding.schema";

interface OffboardingTask {
  id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
}

function buildTask(title: string): OffboardingTask {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
    completed_at: null,
  };
}

const DEFAULT_TASKS = [
  "Récupérer le matériel informatique",
  "Révoquer les accès systèmes",
  "Archiver les fichiers de travail",
  "Entretien de sortie effectué",
  "Solde de tout compte signé",
  "Restitution badge / clés",
];

// ─── Get ──────────────────────────────────────────────────────────────────────

export const getOffboarding = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("offboarding_checklists")
      .select(`
        id, reason, last_day, exit_interview_done, tasks_json, status, created_at, updated_at,
        profiles!offboarding_checklists_employee_user_id_fkey(id, full_name, avatar_url)
      `)
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .maybeSingle();

    if (error) throw new AppError(500, "Failed to fetch offboarding checklist");
    res.status(200).json({ data: data ?? null });
  }
);

// ─── Create ───────────────────────────────────────────────────────────────────

export const createOffboarding = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;
    const body = req.body as CreateOffboardingInput;

    const tasks: OffboardingTask[] = body.tasks?.length
      ? body.tasks.map((t) => buildTask(t.title))
      : DEFAULT_TASKS.map(buildTask);

    const { data, error } = await supabaseAdmin
      .from("offboarding_checklists")
      .insert({
        institution_id: institutionId,
        employee_user_id: userId,
        reason: body.reason,
        last_day: body.last_day ?? null,
        tasks_json: tasks,
        status: "IN_PROGRESS",
      })
      .select("id, reason, last_day, exit_interview_done, tasks_json, status, created_at")
      .single();

    if (error) throw new AppError(error.code === "23505" ? 409 : 500, "Failed to create offboarding checklist");
    res.status(201).json({ data });
  }
);

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateOffboarding = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;
    const body = req.body as UpdateOffboardingInput;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.reason !== undefined) updates.reason = body.reason;
    if (body.last_day !== undefined) updates.last_day = body.last_day;
    if (body.exit_interview_done !== undefined) updates.exit_interview_done = body.exit_interview_done;
    if (body.status !== undefined) updates.status = body.status;

    const { data, error } = await supabaseAdmin
      .from("offboarding_checklists")
      .update(updates)
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .select("id, reason, last_day, exit_interview_done, tasks_json, status")
      .single();

    if (error || !data) throw new AppError(404, "Offboarding checklist not found");
    res.status(200).json({ data });
  }
);

// ─── Toggle task ──────────────────────────────────────────────────────────────

export const toggleTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId, taskId } = req.params;

    // Fetch current tasks_json
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("offboarding_checklists")
      .select("tasks_json")
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .single();

    if (fetchErr || !current) throw new AppError(404, "Offboarding checklist not found");

    const tasks = (current.tasks_json as OffboardingTask[]).map((t) =>
      t.id === taskId
        ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null }
        : t
    );

    const { data, error } = await supabaseAdmin
      .from("offboarding_checklists")
      .update({ tasks_json: tasks, updated_at: new Date().toISOString() })
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .select("id, tasks_json, status")
      .single();

    if (error || !data) throw new AppError(500, "Failed to update task");
    res.status(200).json({ data });
  }
);

// ─── Add task ─────────────────────────────────────────────────────────────────

export const addTask = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;
    const { title } = req.body as AddTaskInput;

    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("offboarding_checklists")
      .select("tasks_json")
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .single();

    if (fetchErr || !current) throw new AppError(404, "Offboarding checklist not found");

    const tasks = [...(current.tasks_json as OffboardingTask[]), buildTask(title)];

    const { data, error } = await supabaseAdmin
      .from("offboarding_checklists")
      .update({ tasks_json: tasks, updated_at: new Date().toISOString() })
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .select("id, tasks_json")
      .single();

    if (error || !data) throw new AppError(500, "Failed to add task");
    res.status(200).json({ data });
  }
);

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteOffboarding = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;

    const { error } = await supabaseAdmin
      .from("offboarding_checklists")
      .delete()
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId);

    if (error) throw new AppError(500, "Failed to delete offboarding checklist");
    res.status(200).json({ success: true });
  }
);
