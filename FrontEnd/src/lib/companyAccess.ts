import { useWorkspace } from "@/lib/workspace";

/** Company pages that only some roles may open (same rules as the sidebar entries). */
export type RestrictedCompanyPage = "team" | "permissions" | "interviews" | "applications" | "roles";

const ADMIN_ONLY = ["OWNER", "ADMIN", "HR_LEAD"];
const HR_FAMILY = ["OWNER", "ADMIN", "HR_LEAD", "STANDARD_HR", "RECRUITER", "HIRING_MANAGER"];

const RULES: Record<RestrictedCompanyPage, { roles: string[]; customPermission: "members.view" | "members.roles" | "interviews.manage" | "applications.view" }> = {
  team: { roles: ADMIN_ONLY, customPermission: "members.view" },
  permissions: { roles: ADMIN_ONLY, customPermission: "members.roles" },
  interviews: { roles: HR_FAMILY, customPermission: "interviews.manage" },
  // The backend serves both lists to anyone holding applications.view (every recruitment role).
  applications: { roles: HR_FAMILY, customPermission: "applications.view" },
  roles: { roles: HR_FAMILY, customPermission: "applications.view" },
};

/** "loading" until the workspace is known, so a page never flashes "denied" then opens. */
export function useCompanyPageAccess(page: RestrictedCompanyPage): "loading" | "allowed" | "denied" {
  const { active, loading, hasPermission } = useWorkspace();
  if (loading) return "loading";
  if (active.kind !== "institution") return "denied";

  const { role_specialization: role, status } = active.membership;
  const effectiveRole = role ?? (status === "OWNER" ? "OWNER" : status === "ADMIN" ? "ADMIN" : "MEMBER");
  const rule = RULES[page];
  const allowed =
    effectiveRole === "CUSTOM" ? hasPermission(rule.customPermission) : rule.roles.includes(effectiveRole);
  return allowed ? "allowed" : "denied";
}
