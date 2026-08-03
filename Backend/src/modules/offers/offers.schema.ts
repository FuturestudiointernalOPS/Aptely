import { z } from "zod";

// ─── Offer Status Enum ────────────────────────────────────────────────────────
const offerStatusEnum = z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "COUNTER_OFFERED"]);

// ─── Create Offer ─────────────────────────────────────────────────────────────
export const createOfferSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  payload: z.object({
    position: z.string().min(1, "Position is required"),
    compensation: z.string().min(1, "Compensation is required"),
    startDate: z.string().min(1, "Start date is required"),
    benefits: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// ─── Update Offer (new version) ───────────────────────────────────────────────
export const updateOfferSchema = z.object({
  payload: z.object({
    position: z.string().min(1, "Position is required"),
    compensation: z.string().min(1, "Compensation is required"),
    startDate: z.string().min(1, "Start date is required"),
    benefits: z.string().optional(),
    notes: z.string().optional(),
  }),
  changeReason: z.string().max(500).optional(),
});

// ─── Update Offer Status ──────────────────────────────────────────────────────
export const updateOfferStatusSchema = z.object({
  status: offerStatusEnum,
});

// ─── Offer Public Portal & Negotiation ───────────────────────────────────────
export const generateOfferPdfSchema = z.object({
  expiresInHours: z.number().int().min(1).max(336).optional(),
});

export const counterOfferSchema = z.object({
  payload: z.object({
    position: z.string().min(1).optional(),
    compensation: z.string().min(1).optional(),
    startDate: z.string().min(1).optional(),
    benefits: z.string().optional(),
    notes: z.string().optional(),
  }),
  message: z.string().max(3000).optional(),
});

// ─── Counter-Offer Response (HR approves/rejects) ────────────────────────────
export const counterResponseSchema = z.object({
  reason: z.string().max(2000).optional(),
});

// ─── List Offers Query ────────────────────────────────────────────────────────
export const listOffersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  status: offerStatusEnum.optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type UpdateOfferStatusInput = z.infer<typeof updateOfferStatusSchema>;
export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>;
export type GenerateOfferPdfInput = z.infer<typeof generateOfferPdfSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
