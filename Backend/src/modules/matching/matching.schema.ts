import { z } from "zod";

// ─── POST /match/role ────────────────────────────────────────────────────────

export const matchRoleSchema = z.object({
  roleId: z.string().uuid("roleId must be a valid UUID"),
  maxResults: z.number().int().min(1).max(100).default(10),
});

export type MatchRoleInput = z.infer<typeof matchRoleSchema>;
