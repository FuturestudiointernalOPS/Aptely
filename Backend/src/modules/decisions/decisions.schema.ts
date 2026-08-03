import { z } from "zod";

// ─── Decision Actions Enum ────────────────────────────────────────────────────
const decisionActionEnum = z.enum(["ACCEPT", "REJECT", "HOLD"]);
const recommendActionEnum = z.enum(["STRONG", "MEDIUM", "WEAK"]);

// ─── Rejection feedback dimension ────────────────────────────────────────────
const rejectionFeedbackDimensionSchema = z.object({
  dimension: z.string().max(100),
  score: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

// ─── Create Decision ─────────────────────────────────────────────────────────
export const createDecisionSchema = z.object({
  action: decisionActionEnum,
  reason: z.string().max(2000).optional(),
  rejection_feedback: z.array(rejectionFeedbackDimensionSchema).max(10).optional(),
});

// ─── Recommend ───────────────────────────────────────────────────────────────
export const recommendDecisionSchema = z.object({
  action: recommendActionEnum,
  reason: z.string().max(2000).optional(),
});

// ─── Ratify ──────────────────────────────────────────────────────────────────
export const ratifyDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  status: z.enum(["APPROVED", "REQUEST_REVIEW"]).default("APPROVED"),
  reason: z.string().max(2000).optional(),
});

// ─── Decision Queue Query ─────────────────────────────────────────────────────
export const decisionQueueQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  status: z
    .enum(["PENDING", "ANALYSING", "FINISHED", "VALIDATED", "REJECTED", "STOPPED"])
    .optional(),
  action: decisionActionEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
export type RecommendDecisionInput = z.infer<typeof recommendDecisionSchema>;
export type RatifyDecisionInput = z.infer<typeof ratifyDecisionSchema>;
export type DecisionQueueQuery = z.infer<typeof decisionQueueQuerySchema>;
