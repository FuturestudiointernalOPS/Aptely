import { z } from "zod";

// ─── Contrat & Statut ─────────────────────────────────────────────────────────

const roleStatusEnum = z.enum(["ACTIVE", "DRAFT", "CLOSED", "CANCELLED"], {
  message: "Invalid role status",
});

// ─── POST /roles — Créer un rôle ─────────────────────────────────────────────

export const createRoleSchema = z.object({
  fullForm: z.record(z.string(), z.unknown()),
  title: z.string().min(2, "Title must be at least 2 characters").max(150).optional(),
  department_id: z.string().uuid("Invalid department id").optional(),
  hiring_manager_user_id: z.string().uuid("Invalid hiring manager user id").optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

// ─── PATCH /roles/:id — Mettre à jour un rôle ────────────────────────────────

export const updateRoleSchema = z.object({
  fullForm: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ─── PATCH /roles/:id/status ──────────────────────────────────────────────────

export const updateRoleStatusSchema = z.object({
  status: roleStatusEnum,
});

export type UpdateRoleStatusInput = z.infer<typeof updateRoleStatusSchema>;

// ─── PATCH /roles/:id/dna — Mettre à jour le Role DNA ────────────────────────

export const updateRoleDnaSchema = z.object({
  fullForm: z.record(z.string(), z.unknown()),
});

export type UpdateRoleDnaInput = z.infer<typeof updateRoleDnaSchema>;

// ─── GET /roles — Query params ────────────────────────────────────────────────

export const listRolesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: roleStatusEnum.optional(),
  search: z.string().max(100).optional(),
});

export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;

// ─── GET /roles/:id/applications — Query params ───────────────────────────────

// Enum des statuts de candidature (dupliqué ici pour éviter l'import circulaire)
const applicationStatusEnum = z.enum([
  "PENDING",
  "ANALYSING",
  "FINISHED",
  "VALIDATED",
  "REJECTED",
  "STOPPED",
]);

export const listRoleApplicationsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: applicationStatusEnum.optional(),
});

export type ListRoleApplicationsQuery = z.infer<typeof listRoleApplicationsQuerySchema>;
