import { z } from "zod";

export const createPeriodSchema = z.object({
  period_month: z.number().int().min(1).max(12),
  period_year: z.number().int().min(2000).max(2100),
  notes: z.string().max(1000).optional().nullable(),
});

export const updatePeriodSchema = z.object({
  status: z.enum(["DRAFT", "VALIDATED", "PAID"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const upsertEntrySchema = z.object({
  employee_user_id: z.string().uuid(),
  gross_salary: z.number().positive(),
  deductions: z.number().min(0).default(0),
  net_salary: z.number().positive(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateEntrySchema = z.object({
  gross_salary: z.number().positive().optional(),
  deductions: z.number().min(0).optional(),
  net_salary: z.number().positive().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

