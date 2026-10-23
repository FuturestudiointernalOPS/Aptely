import { z } from "zod";

// ─── Pagination query params — utilisés sur toutes les routes de liste ────────
// ?page=1&limit=20
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/, "page must be a number").optional(),
  limit: z.string().regex(/^\d+$/, "limit must be a number").optional(),
});


// ─── GET /admin/users — filtres optionnels ────────────────────────────────────
export const listUsersQuerySchema = paginationSchema.extend({
  // HR = enterprise members, CANDIDATE = Talents (§3: identify users by category).
  role: z.enum(["HR", "CANDIDATE"]).optional(),
  search: z.string().max(100).optional(), // filtre sur email ou full_name
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// ─── GET /admin/institutions — filtres optionnels ────────────────────────────
export const listInstitutionsQuerySchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
});

export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>;
