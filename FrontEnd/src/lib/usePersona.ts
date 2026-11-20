"use client";

import { useMemo } from "react";
import { ROLE_PERSONAS_V1 } from "@/lib/featureFlags";
import { toPersona, type Persona, type PersonaProfile } from "@/lib/persona";
import { useWorkspace } from "@/lib/workspace";

export type PersonaView = {
  /** Persona from GET /institution/me/profile when available, local mapping otherwise. */
  persona: Persona;
  source: "profile" | "local";
  enabled: boolean;
  /** DB specialization/status we derived the persona from (useful for debug/QA). */
  roleSpecialization: string | null;
  isCustom: boolean;
};

/**
 * Client hook for B1. Reads the profile cached by WorkspaceProvider (which consumes
 * `/institution/me/profile`) and falls back to a local mapping while Piste A is not merged.
 */
export function usePersona(): PersonaView {
  const { active, profilePersona } = useWorkspace();

  return useMemo<PersonaView>(() => {
    const membership = active.kind === "institution" ? active.membership : null;
    const roleSpecialization =
      membership?.role_specialization ??
      (membership?.status === "OWNER" ? "OWNER" : membership?.status === "ADMIN" ? "ADMIN" : null);
    const profile = profilePersona as PersonaProfile | null;

    return {
      persona: toPersona({
        ...(profile ?? {}),
        roleSpecialization: profile?.roleSpecialization ?? profile?.role_specialization ?? roleSpecialization,
        status: membership?.status,
      }),
      source: profile ? "profile" : "local",
      enabled: ROLE_PERSONAS_V1,
      roleSpecialization,
      isCustom: roleSpecialization === "CUSTOM",
    };
  }, [active, profilePersona]);
}
