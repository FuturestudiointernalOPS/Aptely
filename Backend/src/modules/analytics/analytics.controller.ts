import { Response } from "express";
import { createAuthenticatedClient, supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";

type DB = ReturnType<typeof createAuthenticatedClient>;

async function getInstitutionRoleIds(institutionId: string, supabaseAdmin: DB): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("institution_id", institutionId);

  if (error) throw new AppError(500, "Failed to fetch roles");
  return (data ?? []).map((r) => r.id);
}

async function getInstitutionApplicationIds(roleIds: string[], supabaseAdmin: DB): Promise<string[]> {
  if (roleIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("id")
    .in("role_id", roleIds);

  if (error) throw new AppError(500, "Failed to fetch applications");
  return (data ?? []).map((a) => a.id);
}

export const getPhase2Overview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const roleIds = await getInstitutionRoleIds(institutionId, supabaseAdmin);
    const applicationIds = await getInstitutionApplicationIds(roleIds, supabaseAdmin);
    const roleFilter = roleIds.length > 0 ? roleIds : [""];
    const appFilter = applicationIds.length > 0 ? applicationIds : [""];

    const [
      { count: applications },
      { count: interviews },
      { count: offers },
      { count: acceptedOffers },
      { count: onboardingChecklists },
    ] = await Promise.all([
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).in("role_id", roleFilter),
      supabaseAdmin.from("interviews").select("id", { count: "exact", head: true }).in("application_id", appFilter),
      supabaseAdmin.from("offers").select("id", { count: "exact", head: true }).in("application_id", appFilter),
      supabaseAdmin.from("offers").select("id", { count: "exact", head: true }).eq("status", "ACCEPTED").in("application_id", appFilter),
      supabaseAdmin.from("onboarding_checklists").select("id", { count: "exact", head: true }).in("application_id", appFilter),
    ]);

    res.status(200).json({
      data: {
        applications: applications ?? 0,
        interviews: interviews ?? 0,
        offers: offers ?? 0,
        acceptedOffers: acceptedOffers ?? 0,
        onboardingChecklists: onboardingChecklists ?? 0,
      },
    });
  }
);

export const getPhase2Funnel = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const roleIds = await getInstitutionRoleIds(institutionId, supabaseAdmin);
    const roleFilter = roleIds.length > 0 ? roleIds : [""];

    const { data: apps, error } = await supabaseAdmin
      .from("applications")
      .select("id, status")
      .in("role_id", roleFilter);

    if (error) throw new AppError(500, "Failed to fetch applications");

    const appIds = (apps ?? []).map((a) => a.id);
    const safeAppIds = appIds.length ? appIds : [""];

    const [{ count: offersSent }, { count: offersAccepted }, { count: onboardingStarted }] = await Promise.all([
      supabaseAdmin.from("offers").select("id", { count: "exact", head: true }).eq("status", "SENT").in("application_id", safeAppIds),
      supabaseAdmin.from("offers").select("id", { count: "exact", head: true }).eq("status", "ACCEPTED").in("application_id", safeAppIds),
      supabaseAdmin.from("onboarding_checklists").select("id", { count: "exact", head: true }).in("application_id", safeAppIds),
    ]);

    const stage = {
      applied: apps?.length ?? 0,
      decided: (apps ?? []).filter((a) => ["VALIDATED", "REJECTED", "STOPPED"].includes(a.status)).length,
      offersSent: offersSent ?? 0,
      offersAccepted: offersAccepted ?? 0,
      onboardingStarted: onboardingStarted ?? 0,
    };

    res.status(200).json({ data: stage });
  }
);

export const getPhase2TimeToHire = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const roleIds = await getInstitutionRoleIds(institutionId, supabaseAdmin);
    const roleFilter = roleIds.length > 0 ? roleIds : [""];

    const { data: rows, error } = await supabaseAdmin
      .from("applications")
      .select("id, created_at, offers!inner(status, updated_at)")
      .in("role_id", roleFilter);

    if (error) throw new AppError(500, "Failed to compute time-to-hire");

    const acceptedDurationsDays = (rows ?? [])
      .flatMap((row: any) => {
        const offers = Array.isArray(row.offers) ? row.offers : [row.offers];
        return offers
          .filter((o: any) => o?.status === "ACCEPTED")
          .map((o: any) => {
            const start = new Date(row.created_at).getTime();
            const end = new Date(o.updated_at).getTime();
            return (end - start) / (1000 * 60 * 60 * 24);
          });
      })
      .filter((n) => Number.isFinite(n) && n >= 0);

    const avg =
      acceptedDurationsDays.length > 0
        ? acceptedDurationsDays.reduce((sum, value) => sum + value, 0) / acceptedDurationsDays.length
        : 0;

    const sorted = [...acceptedDurationsDays].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];

    res.status(200).json({
      data: {
        samples: acceptedDurationsDays.length,
        averageDays: Number(avg.toFixed(2)),
        medianDays: Number(median.toFixed(2)),
      },
    });
  }
);

// ─── HR Analytics ──────────────────────────────────────────────────────────────

export const getHrHeadcount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");

    const { data: employees, error } = await supabaseAdmin
      .from("employee_records")
      .select("employment_status, department_id, start_date, departments(name)")
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to fetch headcount");

    const rows = employees ?? [];
    const active = rows.filter((e) => e.employment_status === "ACTIVE");
    const terminated = rows.filter((e) => e.employment_status === "TERMINATED");
    const onLeave = rows.filter((e) => e.employment_status === "ON_LEAVE");

    // Headcount by department (active only)
    const byDept: Record<string, { name: string; count: number }> = {};
    for (const e of active) {
      const deptId = e.department_id ?? "__none__";
      const deptName = (e.departments as any)?.name ?? "Sans département";
      if (!byDept[deptId]) byDept[deptId] = { name: deptName, count: 0 };
      byDept[deptId].count++;
    }

    // Monthly hires (last 12 months)
    const now = new Date();
    const monthlyHires: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = rows.filter((e) => {
        const s = e.start_date ? e.start_date.slice(0, 7) : "";
        return s === label;
      }).length;
      monthlyHires.push({ month: label, count });
    }

    res.status(200).json({
      data: {
        total: rows.length,
        active: active.length,
        terminated: terminated.length,
        onLeave: onLeave.length,
        byDepartment: Object.values(byDept).sort((a, b) => b.count - a.count),
        monthlyHires,
      },
    });
  }
);

export const getHrTurnover = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");

    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const { data: all, error } = await supabaseAdmin
      .from("employee_records")
      .select("employment_status, updated_at")
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to compute turnover");

    const rows = all ?? [];
    const terminatedLast12 = rows.filter(
      (e) => e.employment_status === "TERMINATED" && new Date(e.updated_at) >= yearAgo
    ).length;

    const avgHeadcount = rows.filter((e) => e.employment_status !== "TERMINATED").length || 1;
    const turnoverRate = Number(((terminatedLast12 / avgHeadcount) * 100).toFixed(1));

    // Monthly terminations last 12 months
    const now = new Date();
    const monthlyTerminations: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = rows.filter((e) => {
        if (e.employment_status !== "TERMINATED") return false;
        const updated = e.updated_at ? e.updated_at.slice(0, 7) : "";
        return updated === label;
      }).length;
      monthlyTerminations.push({ month: label, count });
    }

    res.status(200).json({
      data: {
        terminatedLast12Months: terminatedLast12,
        currentHeadcount: avgHeadcount,
        turnoverRatePct: turnoverRate,
        monthlyTerminations,
      },
    });
  }
);

export const getHrLeaveStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");

    const thisYear = new Date().getFullYear();

    const { data: requests, error } = await supabaseAdmin
      .from("leave_requests")
      .select("leave_type, status, days_count")
      .eq("institution_id", institutionId)
      .gte("start_date", `${thisYear}-01-01`)
      .lte("start_date", `${thisYear}-12-31`);

    if (error) throw new AppError(500, "Failed to fetch leave stats");

    const rows = requests ?? [];
    const approved = rows.filter((r) => r.status === "APPROVED");
    const pending = rows.filter((r) => r.status === "PENDING");

    const totalApprovedDays = approved.reduce((s, r) => s + Number(r.days_count), 0);

    const byType: Record<string, number> = {};
    for (const r of approved) {
      byType[r.leave_type] = (byType[r.leave_type] ?? 0) + Number(r.days_count);
    }

    res.status(200).json({
      data: {
        year: thisYear,
        totalApprovedDays,
        pendingCount: pending.length,
        totalRequests: rows.length,
        byType: Object.entries(byType).map(([type, days]) => ({ type, days })).sort((a, b) => b.days - a.days),
      },
    });
  }
);
