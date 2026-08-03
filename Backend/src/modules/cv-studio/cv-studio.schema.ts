import { z } from "zod";

export const startAnalysisSchema = z.object({
  target_country: z.string().max(80).optional(),
  target_job_title: z.string().max(200).optional(),
  role_id: z.string().uuid().optional(),
});

export type StartAnalysisInput = z.infer<typeof startAnalysisSchema>;

export const hrStartAnalysisSchema = z.object({
  candidate_id: z.string().uuid(),
  target_country: z.string().max(80).optional(),
  target_job_title: z.string().max(200).optional(),
  role_id: z.string().uuid().optional(),
});

export type HrStartAnalysisInput = z.infer<typeof hrStartAnalysisSchema>;
