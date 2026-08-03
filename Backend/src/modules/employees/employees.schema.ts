import { z } from "zod";

export const createEmployeeSchema = z.object({
  user_id: z.string().uuid(),
  application_id: z.string().uuid().optional(),
  job_position_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  manager_user_id: z.string().uuid().optional().nullable(),
  employment_type: z.enum(["CDI", "CDD", "FREELANCE", "INTERNSHIP", "PART_TIME"]).default("CDI"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  salary_amount: z.number().positive().optional().nullable(),
  salary_currency: z.string().max(3).default("EUR"),
  contract_notes: z.string().max(2000).optional().nullable(),
});

export const updateEmployeeSchema = z.object({
  job_position_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  manager_user_id: z.string().uuid().optional().nullable(),
  employment_type: z.enum(["CDI", "CDD", "FREELANCE", "INTERNSHIP", "PART_TIME"]).optional(),
  employment_status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  salary_amount: z.number().positive().optional().nullable(),
  salary_currency: z.string().max(3).optional(),
  contract_notes: z.string().max(2000).optional().nullable(),
});

export const listEmployeesQuerySchema = z.object({
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]).optional(),
  department_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const REVIEW_PERIODS = ["Q1","Q2","Q3","Q4","ANNUAL","PROBATION"] as const;

export const createReviewSchema = z.object({
  period: z.enum(REVIEW_PERIODS),
  year: z.number().int().min(2000).max(2100),
  overall_rating: z.number().int().min(1).max(5).optional().nullable(),
  strengths: z.string().max(2000).optional().nullable(),
  improvements: z.string().max(2000).optional().nullable(),
  goals_next_period: z.string().max(2000).optional().nullable(),
});

export const updateReviewSchema = z.object({
  overall_rating: z.number().int().min(1).max(5).optional().nullable(),
  strengths: z.string().max(2000).optional().nullable(),
  improvements: z.string().max(2000).optional().nullable(),
  goals_next_period: z.string().max(2000).optional().nullable(),
  status: z.enum(["DRAFT","SUBMITTED"]).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
