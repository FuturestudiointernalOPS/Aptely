import { ROLE_PERSONAS_V1 } from "@/lib/featureFlags";
import { toPersona } from "@/lib/persona";
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
  // CUSTOM roles are configuration, not a persona: they stay gated by permissions.
  const customAllowed = effectiveRole === "CUSTOM" && hasPermission(rule.customPermission);
  if (customAllowed) return "allowed";

  if (ROLE_PERSONAS_V1 && effectiveRole !== "CUSTOM") {
    const persona = toPersona({ roleSpecialization: role, status });
    let allowed = false;
    switch (page) {
      case "team":
        // HR keeps team access only when its permission set actually allows member viewing
        // (needed for invites); the permission matrix itself is Owner-only.
        allowed = persona === "OWNER" || (persona === "HR" && hasPermission("members.view"));
        break;
      case "permissions":
        allowed = persona === "OWNER";
        break;
      case "interviews":
        allowed = persona === "OWNER" || persona === "HR" || persona === "INTERVIEWER";
        break;
      case "applications":
      case "roles":
        allowed = persona === "OWNER" || persona === "HR";
        break;
    }
    return allowed ? "allowed" : "denied";
  }

  return rule.roles.includes(effectiveRole) ? "allowed" : "denied";
}
