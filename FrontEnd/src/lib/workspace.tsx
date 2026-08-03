"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  API,
  institutionMembershipsApi,
  institutionMePermissionsApi,
  institutionMeModulesApi,
  institutionMeActiveApi,
} from "@/lib/routes";

export type WorkspaceMembership = {
  institution_id: string;
  institution_name: string;
  institution_logo_url: string | null;
  institution_sector: string | null;
  status: "OWNER" | "ADMIN" | "ACTIVE" | "PENDING" | "SUSPENDED";
  role_specialization:
    | "OWNER"
    | "ADMIN"
    | "HR_LEAD"
    | "HIRING_MANAGER"
    | "RECRUITER"
    | "STANDARD_HR"
    | "MEMBER"
    | "CUSTOM"
    | null;
  role_custom_label: string | null;
  joined_at: string;
};

type ActiveWorkspace =
  | { kind: "personal"; label: string }
  | { kind: "institution"; institutionId: string; membership: WorkspaceMembership };

export type Permission =
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
  // Members — granular (members.manage kept as a legacy umbrella alias)
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

/**
 * Role authority ranks (mirror of the backend ROLE_RANK). A member can only manage
 * another member of strictly lower rank, and assign a role of strictly lower rank
 * than their own. Used to gate member-management UI.
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
  ACTIVE: 10,
  PENDING: 0,
  SUSPENDED: 0,
};

/** Rank of a role_specialization or legacy status; unknown keys → CUSTOM tier. */
export function roleRank(role?: string | null): number {
  if (!role) return 0;
  return ROLE_RANK[role] ?? ROLE_RANK.CUSTOM;
}

export type ModuleKey = "recruitment" | "hr" | "payroll" | "projects" | "goals";

export type AppModule = {
  key: ModuleKey;
  label: string;
  is_active: boolean;
};

interface WorkspaceContextValue {
  active: ActiveWorkspace;
  memberships: WorkspaceMembership[];
  isPersonal: boolean;
  loading: boolean;
  permissions: Set<Permission>;
  hasPermission: (perm: Permission) => boolean;
  activeModules: AppModule[];
  hasModule: (key: ModuleKey) => boolean;
  switchTo: (institutionId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = "aptely_active_workspace";

function readStoredWorkspace(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredWorkspace(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota errors */
  }
}

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const stored = readStoredWorkspace();
    return stored && stored !== "personal" && stored !== "individual" ? stored : null;
  });
  const [personalLabel, setPersonalLabel] = useState<string>("Individual");
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [activeModules, setActiveModules] = useState<AppModule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setPermissions(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    const { apiFetch } = await import("@/lib/apiHelper");

    // Memberships first (which workspaces I belong to).
    const res = await apiFetch(institutionMembershipsApi, "HR", { method: "GET" });
    if (res && typeof res === "object" && Array.isArray(res.memberships)) {
      setMemberships(res.memberships);
      if (res.personal_workspace?.name) setPersonalLabel(res.personal_workspace.name);

      const stored = readStoredWorkspace();
      const validStored = stored && res.memberships.some((m: WorkspaceMembership) => m.institution_id === stored);

      if (validStored) {
        setActiveId(stored);
      } else if (res.active_institution_id && res.memberships.some((m: WorkspaceMembership) => m.institution_id === res.active_institution_id)) {
        setActiveId(res.active_institution_id);
        writeStoredWorkspace(res.active_institution_id);
      } else if (res.memberships.length > 0) {
        // Auto-select first institution membership (prefer OWNER/ADMIN roles)
        // Never leave a member in personal mode if they belong to an institution
        const preferred = res.memberships.find(
          (m: WorkspaceMembership) => m.role_specialization === "OWNER" || m.role_specialization === "ADMIN"
        ) ?? res.memberships[0];
        setActiveId(preferred.institution_id);
        writeStoredWorkspace(preferred.institution_id);
      } else {
        setActiveId(null);
        writeStoredWorkspace(null);
      }
    }

    // Permissions + modules for the active workspace (parallel).
    const [permRes, modulesRes] = await Promise.all([
      apiFetch(institutionMePermissionsApi, "HR", { method: "GET" }),
      apiFetch(institutionMeModulesApi, "HR", { method: "GET" }),
    ]);

    if (permRes && Array.isArray(permRes.permissions)) {
      setPermissions(new Set(permRes.permissions as Permission[]));
    } else {
      setPermissions(new Set());
    }

    if (modulesRes && Array.isArray(modulesRes)) {
      setActiveModules(modulesRes as AppModule[]);
    } else {
      // fallback: recruitment always active
      setActiveModules([{ key: "recruitment", label: "Recruitment", is_active: true }]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, user, refresh]);

  const switchTo = useCallback(async (institutionId: string | null) => {
    setActiveId(institutionId);
    writeStoredWorkspace(institutionId);

    // Persist server-side + refresh permissions for the new workspace.
    if (user) {
      const { apiFetch } = await import("@/lib/apiHelper");
      await apiFetch(institutionMeActiveApi, "HR", {
        method: "PATCH",
        body: JSON.stringify({ institution_id: institutionId }),
      });

      const [permRes, modulesRes] = await Promise.all([
        apiFetch(institutionMePermissionsApi, "HR", { method: "GET" }),
        apiFetch(institutionMeModulesApi, "HR", { method: "GET" }),
      ]);
      if (permRes && Array.isArray(permRes.permissions)) {
        setPermissions(new Set(permRes.permissions as Permission[]));
      } else {
        setPermissions(new Set());
      }
      if (modulesRes && Array.isArray(modulesRes)) {
        setActiveModules(modulesRes as AppModule[]);
      } else {
        setActiveModules([{ key: "recruitment", label: "Recruitment", is_active: true }]);
      }
    }
  }, [user]);

  const active: ActiveWorkspace = useMemo(() => {
    if (activeId === null) {
      return { kind: "personal", label: personalLabel };
    }
    const membership = memberships.find((m) => m.institution_id === activeId);
    if (!membership) {
      return { kind: "personal", label: personalLabel };
    }
    return { kind: "institution", institutionId: activeId, membership };
  }, [activeId, memberships, personalLabel]);

  const hasPermission = useCallback(
    (perm: Permission) => permissions.has(perm),
    [permissions]
  );

  const hasModule = useCallback(
    (key: ModuleKey) => activeModules.some(m => m.key === key && m.is_active),
    [activeModules]
  );

  const value: WorkspaceContextValue = {
    active,
    memberships,
    isPersonal: active.kind === "personal",
    loading,
    permissions,
    hasPermission,
    activeModules,
    hasModule,
    switchTo,
    refresh,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
