/**
 * UX personas (Piste B) — pure helpers, safe on server and client.
 *
 * The backend keeps its full RBAC (roles DB, enums and custom roles untouched).
 * A persona is only a presentation layer derived from the existing role,
 * with a local fallback until GET /institution/me/profile is merged (Piste A).
 *
 * Fixed provisional contract (dispatch Sync 1):
 *   { persona, roleSpecialization | role_specialization, permissions, rank }
 */

export type Persona = "OWNER" | "HR" | "INTERVIEWER" | "EMPLOYEE";

export type PersonaProfile = {
  persona?: string | null;
  roleSpecialization?: string | null;
  role_specialization?: string | null;
  permissions?: string[];
  rank?: number;
};

export type PersonaInput = PersonaProfile & {
  /** Legacy membership status, used when no specialization is set (OWNER/ADMIN/ACTIVE…). */
  status?: string | null;
  membershipStatus?: string | null;
};

export const PERSONAS: Persona[] = ["OWNER", "HR", "INTERVIEWER", "EMPLOYEE"];

const PERSONA_SET = new Set<string>(PERSONAS);

function normalize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

/**
 * Fixed mapping from the dispatch. Unknown roles fall back to EMPLOYEE (the most
 * restrictive presentation), never to a privileged persona.
 */
export function toPersona(input: PersonaInput = {}): Persona {
  const fromProfile = normalize(input.persona);
  if (fromProfile && PERSONA_SET.has(fromProfile)) return fromProfile as Persona;

  const role =
    normalize(input.roleSpecialization) ??
    normalize(input.role_specialization) ??
    normalize(input.status) ??
    normalize(input.membershipStatus);

  switch (role) {
    case "OWNER":
    case "ADMIN":
      return "OWNER";
    case "HR_LEAD":
    case "STANDARD_HR":
    case "RECRUITER":
      return "HR";
    case "HIRING_MANAGER":
      return "INTERVIEWER";
    case "MEMBER":
    case "ACTIVE":
    case "CUSTOM":
      return "EMPLOYEE";
    default:
      return "EMPLOYEE";
  }
}

/** Reads `/institution/me/profile` payloads defensively (404/unknown shape → null). */
export function readProfilePersona(payload: unknown): Persona | null {
  if (!payload || typeof payload !== "object") return null;
  // apiFetch normally unwraps `{ data }`, but stay defensive if the proxy changes.
  const wrapper = payload as { data?: unknown };
  const source = wrapper.data && typeof wrapper.data === "object" ? wrapper.data : payload;
  const profile = source as PersonaProfile;
  const persona = normalize(profile.persona);
  if (persona && PERSONA_SET.has(persona)) return persona as Persona;
  // Piste A may return only the specialization while the persona contract settles.
  const role = profile.roleSpecialization ?? profile.role_specialization;
  if (!role) return null;
  return toPersona({ roleSpecialization: role });
}
