import { describe, expect, it } from "vitest";
import { toPersona, readProfilePersona } from "./persona";
import { PERMISSION_CATALOGUE_SIZE, PERMISSION_GROUPS } from "./permissionCatalogue";

describe("toPersona (Piste B — fixed provisional mapping)", () => {
  it("maps built-in roles to the three UX personas", () => {
    expect(toPersona({ roleSpecialization: "OWNER" })).toBe("OWNER");
    expect(toPersona({ roleSpecialization: "ADMIN" })).toBe("OWNER");
    expect(toPersona({ roleSpecialization: "HR_LEAD" })).toBe("HR");
    expect(toPersona({ roleSpecialization: "STANDARD_HR" })).toBe("HR");
    expect(toPersona({ roleSpecialization: "RECRUITER" })).toBe("HR");
    expect(toPersona({ roleSpecialization: "HIRING_MANAGER" })).toBe("INTERVIEWER");
    expect(toPersona({ roleSpecialization: "MEMBER" })).toBe("EMPLOYEE");
    expect(toPersona({ roleSpecialization: "ACTIVE" })).toBe("EMPLOYEE");
  });

  it("derives CUSTOM from its permissions without collapsing the DB role", () => {
    // A CUSTOM role is always presented as EMPLOYEE; existing hasPermission checks
    // still decide what the user can actually do.
    expect(toPersona({ roleSpecialization: "CUSTOM", permissions: ["members.roles"] })).toBe("EMPLOYEE");
  });

  it("falls back to legacy membership status when no specialization is set", () => {
    expect(toPersona({ status: "OWNER" })).toBe("OWNER");
    expect(toPersona({ status: "ADMIN" })).toBe("OWNER");
    expect(toPersona({ status: "ACTIVE" })).toBe("EMPLOYEE");
    expect(toPersona()).toBe("EMPLOYEE");
  });

  it("prefers a valid persona returned by /institution/me/profile", () => {
    expect(toPersona({ persona: "HR", roleSpecialization: "OWNER" })).toBe("HR");
    expect(toPersona({ persona: "UNKNOWN", roleSpecialization: "RECRUITER" })).toBe("HR");
    expect(readProfilePersona({ data: { persona: "INTERVIEWER", rank: 30 } })).toBe("INTERVIEWER");
    expect(readProfilePersona({ role_specialization: "STANDARD_HR" })).toBe("HR");
    expect(readProfilePersona(null)).toBeNull();
  });
});

describe("permission catalogue (B4)", () => {
  it("exposes the full 25-entry catalogue, including the 5 Phase 4 permissions", () => {
    expect(PERMISSION_CATALOGUE_SIZE).toBe(25);
    const keys = PERMISSION_GROUPS.flatMap((group) => group.perms.map((perm) => perm.key));
    expect(keys).toContain("goals.view");
    expect(keys).toContain("goals.manage");
    expect(keys).toContain("retention.view");
    expect(keys).toContain("learning.manage");
    expect(keys).toContain("compensation.manage");
    // Legacy umbrella alias is informational only.
    expect(PERMISSION_GROUPS.flatMap((g) => g.perms).find((p) => p.key === "members.manage")?.legacyAlias).toBe(true);
  });
});
