import { Response, NextFunction } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";

export type InstitutionPermission =
  | "roles.create"
  | "roles.update"
  | "roles.delete"
  | "applications.view"
  | "applications.decide"
  | "offers.manage"
  | "communications.send"
  | "analytics.view"
  | "interviews.manage"
  | "onboarding.manage"
  // Members — granular (members.manage kept as an umbrella alias, see expandAliases)
  | "members.manage"
  | "members.view"
  | "members.invite"
  | "members.remove"
  | "members.roles"
  // Institution settings
  | "settings.edit"
  // Modules à venir
  | "employees.view"
  | "employees.manage"
  | "payroll.view"
  | "payroll.manage"
  // Phase 4 — Staff Management
  | "goals.view"
  | "goals.manage"
  | "retention.view"
  | "learning.manage"
  | "compensation.manage";

/** Full ordered list of assignable permissions (source of truth for the UI editor). */
export const ALL_PERMISSIONS: InstitutionPermission[] = [
  "roles.create", "roles.update", "roles.delete",
  "applications.view", "applications.decide",
  "interviews.manage", "offers.manage", "onboarding.manage",
  "communications.send", "analytics.view",
  "members.view", "members.invite", "members.remove", "members.roles",
  "settings.edit",
  "employees.view", "employees.manage",
  "payroll.view", "payroll.manage",
  "goals.view", "goals.manage",
  "retention.view",
  "learning.manage",
  "compensation.manage",
];

/**
 * Role authority ranks. A member can only manage (change role / suspend / remove)
 * another member of STRICTLY lower rank, and can only assign a role of strictly
 * lower rank than their own. OWNER is assigned only through transfer-ownership.
 * Custom roles sit just above MEMBER (bespoke, non-managerial by default).
 */
const ROLE_RANK: Record<string, number> = {
  OWNER: 100,
  ADMIN: 80,
  HR_LEAD: 60,
  STANDARD_HR: 40,
  HIRING_MANAGER: 30,
  RECRUITER: 20,
  CUSTOM: 15,
  MEMBER: 10,
  // legacy status fallbacks
  ACTIVE: 10,
  PENDING: 0,
  SUSPENDED: 0,
};

/** Rank of a role_specialization or legacy status; unknown keys → CUSTOM tier. */
export function roleRank(role?: string | null): number {
  if (!role) return 0;
  return ROLE_RANK[role] ?? ROLE_RANK.CUSTOM;
}

/** members.manage is a legacy umbrella → expands to every granular members.* permission. */
export function expandAliases(perms: Set<string>): Set<string> {
  if (perms.has("members.manage")) {
    perms.add("members.view");
    perms.add("members.invite");
    perms.add("members.remove");
    perms.add("members.roles");
  }
  return perms;
}

// Default permissions per role — used when no custom config is set.
// Keyed on role_specialization first; legacy status (OWNER/ADMIN/ACTIVE) is also accepted.
export const DEFAULT_PERMISSIONS: Record<string, InstitutionPermission[]> = {
  OWNER: [
    "roles.create", "roles.update", "roles.delete",
    "applications.view", "applications.decide",
    "offers.manage", "communications.send",
    "analytics.view", "members.manage",
    "interviews.manage", "onboarding.manage",
    "settings.edit",
    "employees.view", "employees.manage",
    "payroll.view", "payroll.manage",
    "goals.view", "goals.manage",
    "retention.view", "learning.manage", "compensation.manage",
  ],
  ADMIN: [
    "roles.create", "roles.update", "roles.delete",
    "applications.view", "applications.decide",
    "offers.manage", "communications.send",
    "analytics.view", "members.manage",
    "interviews.manage", "onboarding.manage",
    "settings.edit",
    "employees.view", "employees.manage",
    "payroll.view", "payroll.manage",
    "goals.view", "goals.manage",
    "retention.view", "learning.manage", "compensation.manage",
  ],
  HR_LEAD: [
    "roles.create", "roles.update",
    "applications.view", "applications.decide",
    "offers.manage", "communications.send",
    "analytics.view",
    "interviews.manage", "onboarding.manage",
    "members.view", "employees.view", "employees.manage",
    "goals.view", "goals.manage",
    "retention.view", "learning.manage", "compensation.manage",
  ],
  HIRING_MANAGER: [
    "applications.view", "applications.decide",
    "communications.send",
    "interviews.manage",
    "goals.view",
  ],
  RECRUITER: [
    "applications.view",
    "communications.send",
    "interviews.manage",
  ],
  STANDARD_HR: [
    "applications.view", "applications.decide",
    "offers.manage", "communications.send",
    "analytics.view",
    "interviews.manage", "onboarding.manage",
    "members.view", "employees.view",
    "goals.view", "goals.manage",
    "learning.manage",
  ],
  MEMBER: ["applications.view", "analytics.view"],
  ACTIVE: ["applications.view", "analytics.view"],
  CUSTOM: [], // CUSTOM gets no defaults — permissions must be set explicitly via institution_role_permissions
};

export async function checkPermission(
  userId: string,
  institutionId: string,
  permission: InstitutionPermission
): Promise<boolean> {
  // Get user's membership: role_specialization (preferred) or legacy status.
  const { data: membership } = await supabaseAdmin
    .from("institution_members")
    .select("status, role_specialization, custom_role_id")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!membership) return false;

  // Prefer role_specialization (post-refactor); fall back to status (legacy).
  const role = (membership.role_specialization as string | null) ?? (membership.status as string);

  // OWNER always has all permissions — no override possible.
  if (role === "OWNER") return true;

  // Suspended/pending members have no permissions regardless of role.
  if (membership.status === "SUSPENDED" || membership.status === "PENDING") return false;

  // Resolve the permission-config key:
  //   CUSTOM  → the custom role id (its perms live in institution_role_permissions)
  //   ACTIVE  → MEMBER (legacy alias)
  //   else    → the role_specialization name
  const customRoleId = membership.custom_role_id as string | null;
  const lookupRole =
    role === "CUSTOM" && customRoleId ? customRoleId
    : role === "ACTIVE" ? "MEMBER"
    : role;
  const { data: custom } = await supabaseAdmin
    .from("institution_role_permissions")
    .select("permission, granted")
    .eq("institution_id", institutionId)
    .eq("role", lookupRole);

  // Build the effective granted set: explicit custom config if present, else role defaults.
  const granted: Set<string> = (custom && custom.length > 0)
    ? new Set(custom.filter((p) => p.granted).map((p) => p.permission as string))
    : new Set<string>(DEFAULT_PERMISSIONS[role] ?? []);

  return expandAliases(granted).has(permission);
}

// Express middleware factory
export function requirePermission(permission: InstitutionPermission) {
  return asyncHandler(async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const user = req.user!;

    // authGuard already resolved the request's workspace (X-Workspace-Id validated
    // against memberships) into user.institutionId / activeInstitutionId. Check the
    // permission on that same institution the controllers will read and write —
    // never on the raw header, or a permission held in one workspace would unlock
    // data in another.
    const institutionId =
      req.workspace?.institutionId
      ?? user.activeInstitutionId
      ?? user.institutionId
      ?? null;

    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const allowed = await checkPermission(user.id, institutionId, permission);
    if (!allowed) {
      throw new AppError(403, `Permission denied: ${permission}`);
    }
    next();
  });
}
