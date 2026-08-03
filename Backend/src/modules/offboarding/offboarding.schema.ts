import { z } from "zod";

const OFFBOARDING_REASONS = ["RESIGNATION","TERMINATION","END_OF_CONTRACT","RETIREMENT","OTHER"] as const;

export const createOffboardingSchema = z.object({
  reason: z.enum(OFFBOARDING_REASONS),
  last_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
  })).optional(),
});

export const updateOffboardingSchema = z.object({
  reason: z.enum(OFFBOARDING_REASONS).optional(),
  last_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  exit_interview_done: z.boolean().optional(),
  status: z.enum(["IN_PROGRESS","COMPLETED"]).optional(),
});

export const addTaskSchema = z.object({
  title: z.string().min(1).max(200),
});

export type CreateOffboardingInput = z.infer<typeof createOffboardingSchema>;
export type UpdateOffboardingInput = z.infer<typeof updateOffboardingSchema>;
export type AddTaskInput = z.infer<typeof addTaskSchema>;
