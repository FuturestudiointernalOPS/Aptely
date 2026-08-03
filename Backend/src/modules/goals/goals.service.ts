import { randomInt } from "crypto";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";

// ─── Session code — crypto.randomInt (not Math.random) ────────────────────────

function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}

// ─── Institution access guard ─────────────────────────────────────────────────
// Must be called before any sub-resource operation on a goal.
// Throws 404 if goal doesn't belong to the institution — prevents IDOR.

export async function guardGoalAccess(goalId: string, institutionId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (error || !data) throw new AppError(404, "Goal not found");
}

// ─── Goal progress computation ────────────────────────────────────────────────

export async function computeGoalProgress(goalId: string): Promise<number> {
  const { data: tasks } = await supabaseAdmin
    .from("goal_tasks")
    .select("status")
    .eq("goal_id", goalId);

  if (!tasks || tasks.length === 0) return 0;
  const done = tasks.filter((t: { status: string }) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

// ─── Unique session code ───────────────────────────────────────────────────────

export async function uniqueSessionCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateSessionCode();
    const { data } = await supabaseAdmin
      .from("goals")
      .select("id")
      .eq("session_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new AppError(500, "Could not generate unique session code");
}

// ─── Verify member belongs to institution (for cross-references) ──────────────

export async function guardMemberAccess(userId: string, institutionId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("institution_members")
    .select("id")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!data) throw new AppError(400, "Referenced user is not a member of this institution");
}
