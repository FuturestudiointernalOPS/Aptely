import { createAuthenticatedClient } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { DEFAULT_PERMISSIONS, expandAliases, roleRank } from "@/middleware/permissions.middleware";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";

export type DB = ReturnType<typeof createAuthenticatedClient>;

export type MembershipStatus = "OWNER" | "ADMIN" | "ACTIVE" | "PENDING" | "SUSPENDED";

export const DEFAULT_PERSONAL_SETTINGS = {
  timezone: "UTC",
  language: "fr",
  emailNotifications: true,
  inAppNotifications: true,
  interviewReminders: true,
  defaultInterviewDuration: 60,
  interviewBufferMinutes: 15,
  workdayStart: "09:00",
  workdayEnd: "18:00",
};

// ─── Membership Helpers ──────────────────────────────────────────────────────

export async function getMembershipStatus(userId: string, institutionId: string, db: DB): Promise<MembershipStatus | null> {
  const { data, error } = await db
    .from("institution_members")
    .select("status")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (error) throw new AppError(500, "Failed to load institution membership");
  if (!data?.status) return null;

  return data.status as MembershipStatus;
}

export async function assertOwner(userId: string, institutionId: string, db: DB): Promise<"OWNER"> {
  const status = await getMembershipStatus(userId, institutionId, db);
  if (status !== "OWNER") {
    throw new AppError(403, "Only institution owners can perform this action");
  }
  return "OWNER";
}

export async function assertManager(userId: string, institutionId: string, db: DB): Promise<"OWNER" | "ADMIN"> {
  const status = await getMembershipStatus(userId, institutionId, db);
  if (status !== "OWNER" && status !== "ADMIN") {
    throw new AppError(403, "Only institution managers can perform this action");
  }
  return status;
}

// ─── Permission Check ────────────────────────────────────────────────────────

export async function checkPermission(
  userId: string,
  institutionId: string,
  permission: string,
  db: DB
): Promise<void> {
  const { data: membership } = await db
    .from("institution_members")
    .select("status, role_specialization, custom_role_id")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!membership) {
    throw new AppError(403, "Access denied: not a member of this institution");
  }

  const role = (membership.role_specialization as string | null) ?? (membership.status as string);
  if (role === "OWNER") return;

  if (membership.status === "SUSPENDED" || membership.status === "PENDING") {
    throw new AppError(403, "Access denied: not an active member");
  }

  const customRoleId = membership.custom_role_id as string | null;
  const lookupRole =
    role === "CUSTOM" && customRoleId ? customRoleId
    : role === "ACTIVE" ? "MEMBER"
    : role;

  const { data: customRows } = await db
    .from("institution_role_permissions")
    .select("permission, granted")
    .eq("institution_id", institutionId)
    .eq("role", lookupRole);

  const granted: Set<string> = (customRows && customRows.length > 0)
    ? new Set(customRows.filter((p) => p.granted).map((p) => p.permission as string))
    : new Set<string>(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS[lookupRole] ?? []);

  if (!expandAliases(granted).has(permission)) {
    throw new AppError(403, `Permission denied: your role (${role}) does not have access to "${permission}"`);
  }
}

// ─── Rank Authority ──────────────────────────────────────────────────────────

export async function countOwners(institutionId: string, db: DB): Promise<number> {
  const { count, error } = await db
    .from("institution_members")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", institutionId)
    .eq("status", "OWNER");

  if (error) throw new AppError(500, "Failed to verify institution ownership");
  return count ?? 0;
}

export async function getEffectiveRole(
  userId: string,
  institutionId: string,
  db: DB
): Promise<{ role: string; status: string; customRoleId: string | null } | null> {
  const { data } = await db
    .from("institution_members")
    .select("status, role_specialization, custom_role_id")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!data?.status) return null;
  return {
    role: (data.role_specialization as string | null) ?? (data.status as string),
    status: data.status as string,
    customRoleId: (data.custom_role_id as string | null) ?? null,
  };
}

export async function rankOf(
  role: string,
  customRoleId: string | null,
  institutionId: string,
  db: DB
): Promise<number> {
  if (role === "CUSTOM" && customRoleId) {
    const { data } = await db
      .from("institution_custom_roles")
      .select("rank")
      .eq("id", customRoleId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    return (data?.rank as number | undefined) ?? roleRank("CUSTOM");
  }
  return roleRank(role);
}

export async function assertRankAuthority(
  actorUserId: string,
  targetUserId: string,
  institutionId: string,
  db: DB,
  newRole?: string,
  newCustomRoleId?: string | null
): Promise<void> {
  const actor = await getEffectiveRole(actorUserId, institutionId, db);
  if (!actor) throw new AppError(403, "You are not a member of this institution");
  const target = await getEffectiveRole(targetUserId, institutionId, db);
  if (!target) throw new AppError(404, "Membership not found");

  const actorRank = await rankOf(actor.role, actor.customRoleId, institutionId, db);
  const targetRank = await rankOf(target.role, target.customRoleId, institutionId, db);
  if (actorRank <= targetRank) {
    throw new AppError(403, "You cannot manage a member of equal or higher rank");
  }
  if (newRole) {
    const newRank = await rankOf(newRole, newCustomRoleId ?? null, institutionId, db);
    if (actorRank <= newRank) {
      throw new AppError(403, "You cannot assign a role at or above your own rank");
    }
  }
}

// ─── Request Helpers ─────────────────────────────────────────────────────────

// authGuard has already validated X-Workspace-Id and folded it into req.user.
export function resolveInstitutionId(req: AuthenticatedRequest): string | null {
  return (
    req.workspace?.institutionId
    ?? req.user!.activeInstitutionId
    ?? req.user!.institutionId
    ?? null
  );
}
