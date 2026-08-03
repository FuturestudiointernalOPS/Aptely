import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

const applicationStatusEnum = z.enum([
  "PENDING",
  "ANALYSING",
  "FINISHED",
  "VALIDATED",
  "REJECTED",
  "STOPPED",
  "HIRED",
]);

// ─── Request schemas ──────────────────────────────────────────────────────────

/**
 * HR change le statut d'une candidature.
 */
export const updateApplicationStatusSchema = z.object({
  status: applicationStatusEnum,
});

/**
 * HR ajoute/modifie les notes internes sur une candidature.
 */
export const updateApplicationNotesSchema = z.object({
  notes: z.string().max(2000),
});

/**
 * Query params partagés : pagination + filtre statut.
 */
export const listApplicationsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  status: applicationStatusEnum.optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type UpdateApplicationNotesInput = z.infer<typeof updateApplicationNotesSchema>;
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
