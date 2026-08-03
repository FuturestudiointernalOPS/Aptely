import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";

// ─── Periods ──────────────────────────────────────────────────────────────────

export const listPeriods = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId as string;
    if (!institutionId) throw new AppError(403, "Not linked to institution");

    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .select("*")
      .eq("institution_id", institutionId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch payroll periods");
    res.status(200).json({ data: data ?? [] });
  }
);

export const createPeriod = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");

    const { period_month, period_year, notes } = req.body as {
      period_month: number; period_year: number; notes?: string | null;
    };

    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .insert({ institution_id: institutionId, period_month, period_year, notes })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") throw new AppError(409, "Period already exists for this month");
      throw new AppError(500, "Failed to create payroll period");
    }
    res.status(201).json({ data });
  }
);

export const getPeriod = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");
    const periodId = req.params.periodId as string;

    const { data: period, error: pe } = await supabaseAdmin
      .from("payroll_periods")
      .select("*")
      .eq("id", periodId)
      .eq("institution_id", institutionId)
      .single();

    if (pe || !period) throw new AppError(404, "Period not found");

    const { data: entries, error: ee } = await supabaseAdmin
      .from("payroll_entries")
      .select("*, profiles!employee_user_id(full_name)")
      .eq("period_id", periodId)
      .order("created_at");

    if (ee) throw new AppError(500, "Failed to fetch entries");

    const enriched = (entries ?? []).map((e: any) => ({
      ...e,
      employee_name: e.profiles?.full_name ?? "—",
    }));

    res.status(200).json({ data: { ...period, entries: enriched } });
  }
);

export const updatePeriod = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");
    const periodId = req.params.periodId as string;

    const { data: existing } = await supabaseAdmin
      .from("payroll_periods")
      .select("status")
      .eq("id", periodId)
      .eq("institution_id", institutionId)
      .single();

    if (!existing) throw new AppError(404, "Period not found");

    const updates = req.body as { status?: string; notes?: string | null };
    const { data, error } = await supabaseAdmin
      .from("payroll_periods")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", periodId)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to update period");
    res.status(200).json({ data });
  }
);

export const deletePeriod = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");
    const periodId = req.params.periodId as string;

    const { data: existing } = await supabaseAdmin
      .from("payroll_periods")
      .select("status")
      .eq("id", periodId)
      .eq("institution_id", institutionId)
      .single();

    if (!existing) throw new AppError(404, "Period not found");
    if (existing.status !== "DRAFT") throw new AppError(400, "Only DRAFT periods can be deleted");

    const { error } = await supabaseAdmin
      .from("payroll_periods")
      .delete()
      .eq("id", periodId);

    if (error) throw new AppError(500, "Failed to delete period");
    res.status(204).send();
  }
);

// ─── Entries ──────────────────────────────────────────────────────────────────

export const upsertEntry = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");
    const periodId = req.params.periodId as string;

    const { data: period } = await supabaseAdmin
      .from("payroll_periods")
      .select("status, institution_id")
      .eq("id", periodId)
      .single();

    if (!period || period.institution_id !== institutionId) throw new AppError(404, "Period not found");
    if (period.status !== "DRAFT") throw new AppError(400, "Cannot edit entries on non-DRAFT period");

    const body = req.body as { employee_user_id: string; gross_salary: number; deductions: number; net_salary: number; notes?: string | null };

    const { data, error } = await supabaseAdmin
      .from("payroll_entries")
      .upsert(
        { period_id: periodId, ...body, updated_at: new Date().toISOString() },
        { onConflict: "period_id,employee_user_id" }
      )
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to upsert entry");

    await recalcTotals(periodId);
    res.status(200).json({ data });
  }
);

export const updateEntry = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");
    const periodId = req.params.periodId as string;
    const entryId = req.params.entryId as string;

    const { data: period } = await supabaseAdmin
      .from("payroll_periods")
      .select("status, institution_id")
      .eq("id", periodId)
      .single();

    if (!period || period.institution_id !== institutionId) throw new AppError(404, "Period not found");
    if (period.status !== "DRAFT") throw new AppError(400, "Cannot edit entries on non-DRAFT period");

    const updates = req.body as { gross_salary?: number; deductions?: number; net_salary?: number; notes?: string | null };
    const { data, error } = await supabaseAdmin
      .from("payroll_entries")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", entryId)
      .eq("period_id", periodId)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to update entry");

    await recalcTotals(periodId);
    res.status(200).json({ data });
  }
);

export const deleteEntry = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");
    const periodId = req.params.periodId as string;
    const entryId = req.params.entryId as string;

    const { data: period } = await supabaseAdmin
      .from("payroll_periods")
      .select("status, institution_id")
      .eq("id", periodId)
      .single();

    if (!period || period.institution_id !== institutionId) throw new AppError(404, "Period not found");
    if (period.status !== "DRAFT") throw new AppError(400, "Cannot delete entries on non-DRAFT period");

    const { error } = await supabaseAdmin
      .from("payroll_entries")
      .delete()
      .eq("id", entryId)
      .eq("period_id", periodId);

    if (error) throw new AppError(500, "Failed to delete entry");

    await recalcTotals(periodId);
    res.status(204).send();
  }
);

export const generateEntries = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user?.institutionId;
    if (!institutionId) throw new AppError(403, "Not linked to institution");
    const periodId = req.params.periodId as string;

    const { data: period } = await supabaseAdmin
      .from("payroll_periods")
      .select("status, institution_id")
      .eq("id", periodId)
      .single();

    if (!period || period.institution_id !== institutionId) throw new AppError(404, "Period not found");
    if (period.status !== "DRAFT") throw new AppError(400, "Cannot generate entries on non-DRAFT period");

    const { data: employees, error: ee } = await supabaseAdmin
      .from("employee_records")
      .select("user_id, salary_amount, salary_currency")
      .eq("institution_id", institutionId)
      .eq("employment_status", "ACTIVE")
      .not("salary_amount", "is", null);

    if (ee) throw new AppError(500, "Failed to fetch employees");

    const rows = (employees ?? []).filter((e) => e.salary_amount != null).map((e) => {
      const gross = Number(e.salary_amount);
      const deductions = Number((gross * 0.22).toFixed(2));
      const net = Number((gross - deductions).toFixed(2));
      return {
        period_id: periodId,
        employee_user_id: e.user_id,
        gross_salary: gross,
        deductions,
        net_salary: net,
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      const { error: ie } = await supabaseAdmin
        .from("payroll_entries")
        .upsert(rows, { onConflict: "period_id,employee_user_id" });
      if (ie) throw new AppError(500, "Failed to generate entries");
    }

    await recalcTotals(periodId);
    res.status(200).json({ data: { generated: rows.length } });
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function recalcTotals(periodId: string) {
  const { data } = await supabaseAdmin
    .from("payroll_entries")
    .select("gross_salary, net_salary")
    .eq("period_id", periodId);

  const total_gross = (data ?? []).reduce((s, e) => s + Number(e.gross_salary), 0);
  const total_net = (data ?? []).reduce((s, e) => s + Number(e.net_salary), 0);

  await supabaseAdmin
    .from("payroll_periods")
    .update({ total_gross, total_net, updated_at: new Date().toISOString() })
    .eq("id", periodId);
}
