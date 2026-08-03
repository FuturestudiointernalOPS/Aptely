import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { computeRiskScore } from "./retention.schema";

// ─── GET /retention/dashboard ─────────────────────────────────────────────────
// Returns all risk scores for the institution, sorted by score descending.

export const getDashboard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { data, error } = await supabaseAdmin
      .from("retention_risk_scores")
      .select(`
        id, employee_user_id, score, level, flags, computed_at,
        profiles!employee_user_id(id, full_name, email, avatar_url)
      `)
      .eq("institution_id", institutionId)
      .order("score", { ascending: false });

    if (error) throw new AppError(500, `Failed to fetch retention dashboard: ${error.message}`);
    res.status(200).json({ data });
  }
);

// ─── GET /retention/:userId ────────────────────────────────────────────────────

export const getEmployeeRisk = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { userId } = req.params;

    const { data: score } = await supabaseAdmin
      .from("retention_risk_scores")
      .select("*")
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .maybeSingle();

    const { data: signals } = await supabaseAdmin
      .from("retention_signals")
      .select("*")
      .eq("institution_id", institutionId)
      .eq("employee_user_id", userId)
      .order("signal_date", { ascending: false })
      .limit(10);

    res.status(200).json({ data: { score, signals } });
  }
);

// ─── POST /retention/compute ──────────────────────────────────────────────────
// Trigger manual risk computation for all employees in the institution.
// Gathers signals from existing data (reviews, goals, leave, etc.)

export const computeAll = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    // Fetch all active employees
    const { data: employees, error: empError } = await supabaseAdmin
      .from("employee_records")
      .select("user_id, start_date, salary_amount")
      .eq("institution_id", institutionId)
      .eq("employment_status", "ACTIVE");

    if (empError) throw new AppError(500, "Failed to fetch employees");
    if (!employees?.length) {
      res.status(200).json({ computed: 0 });
      return;
    }

    const results = await Promise.allSettled(
      employees.map(async (emp) => {
        const userId = emp.user_id;
        const today = new Date();

        // Compute tenure months
        const tenure_months = emp.start_date
          ? Math.floor((today.getTime() - new Date(emp.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
          : 0;

        // Perf trend: average last 3 reviews
        const { data: reviews } = await supabaseAdmin
          .from("performance_reviews")
          .select("overall_rating, created_at")
          .eq("employee_user_id", userId)
          .eq("status", "SUBMITTED")
          .order("created_at", { ascending: false })
          .limit(3);

        let perf_trend = 0;
        if (reviews && reviews.length >= 2) {
          const r = reviews as { overall_rating: number | null }[];
          const recent = r[0]?.overall_rating ?? 0;
          const older = r[r.length - 1]?.overall_rating ?? 0;
          perf_trend = recent - older > 0 ? 1 : recent - older < 0 ? -1 : 0;
        }

        // Goal alignment: latest goal score
        const { data: goalRoles } = await supabaseAdmin
          .from("goal_roles")
          .select("goal_id")
          .eq("user_id", userId)
          .limit(5);
        const goal_alignment_score = goalRoles?.length ? 70 : 50; // simplified

        // L&D inactive days
        const { data: latestActivity } = await supabaseAdmin
          .from("learning_activities")
          .select("completed_at")
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const ld_inactive_days = latestActivity?.completed_at
          ? Math.floor((today.getTime() - new Date(latestActivity.completed_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const signals = { employee_user_id: userId, perf_trend, goal_alignment_score, ld_inactive_days, tenure_months };
        const { score, level, flags } = computeRiskScore(signals);

        // Insert signal snapshot
        await supabaseAdmin.from("retention_signals").insert({
          institution_id: institutionId,
          employee_user_id: userId,
          signal_date: today.toISOString().split("T")[0],
          perf_trend,
          goal_alignment_score,
          ld_inactive_days,
          tenure_months,
        });

        // Upsert risk score
        await supabaseAdmin.from("retention_risk_scores").upsert({
          institution_id: institutionId,
          employee_user_id: userId,
          score,
          level,
          flags,
          computed_at: today.toISOString(),
        }, { onConflict: "institution_id,employee_user_id" });

        return { userId, score, level };
      })
    );

    const computed = results.filter(r => r.status === "fulfilled").length;
    res.status(200).json({ computed, total: employees.length });
  }
);

// ─── GET /retention/digest ─────────────────────────────────────────────────────
// Top 5 highest-risk employees — for weekly email digest.

export const getDigest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to an institution");

    const { data, error } = await supabaseAdmin
      .from("retention_risk_scores")
      .select(`score, level, flags, computed_at, profiles!employee_user_id(id, full_name, email)`)
      .eq("institution_id", institutionId)
      .in("level", ["HIGH", "MEDIUM"])
      .order("score", { ascending: false })
      .limit(5);

    if (error) throw new AppError(500, "Failed to fetch digest");
    res.status(200).json({ data });
  }
);
