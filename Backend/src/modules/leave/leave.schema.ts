import { z } from "zod";

const LEAVE_TYPES = ["VACATION", "SICK", "UNPAID", "PARENTAL", "OTHER"] as const;

export const createLeaveRequestSchema = z.object({
  leave_type: z.enum(LEAVE_TYPES),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)"),
  days_count: z.number().positive().max(365),
  reason: z.string().max(1000).optional().nullable(),
});

export const reviewLeaveRequestSchema = z.object({
  review_note: z.string().max(500).optional().nullable(),
});

export const updatePoliciesSchema = z.object({
  policies: z.array(z.object({
    leave_type: z.enum(LEAVE_TYPES),
    days_per_year: z.number().min(0).max(365),
    carry_over_days: z.number().min(0).max(365),
  })).min(1),
});

export const listRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  employee_user_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>;
export type UpdatePoliciesInput = z.infer<typeof updatePoliciesSchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
