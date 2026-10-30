import { cookies, headers } from "next/headers";
import { unstable_cache } from "next/cache";
import type { Activity, DashboardStats, Role } from "./api";
import { applyPath } from "@/lib/routes";

export type RecentApplicationServerItem = {
  applicationId: string;
  candidateName: string;
  roleTitle: string;
  submittedAt: string;
};

export type InstitutionInterviewServerItem = {
  id: string;
  applicationId: string;
  candidateName: string;
  roleTitle: string;
  status: string;
  scheduledAt: string | null;
  meetingLocation: string | null;
};

// Server components run in Node, so they cannot rely on the browser proxy's fallback.
// Without this, a missing NEXT_PUBLIC_API_URL makes getMeServer() return null and every
// authenticated page redirects to /login even though the cookie is valid.
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:4000" : undefined);

// Base URL of the frontend app (used to build full share links server-side)
// Must be set in .env: NEXT_PUBLIC_APP_URL=https://yourdomain.com
// Falls back to using request headers, then the API URL.
async function getAppOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  try {
    const headersList = await headers();
    const host = headersList.get("x-forwarded-host") || headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    if (host) return `${proto}://${host}`;
  } catch (e) {
    // Ignore error if used outside of request context
  }

  // Fallback: derive from API URL by removing common "/api" suffix
  if (API_URL) return API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
  return "";
}

type MeServerPayload = {
  id?: string;
  email?: string;
  role?: string;
  institutionId?: string | null;
};

// Active workspace chosen in the client (see persistActiveWorkspace). Without it,
// server-rendered pages fall back to the JWT claim, which lags behind a workspace
// switch until the next token refresh. The backend validates the membership.
const WORKSPACE_COOKIE = "aptely_active_workspace";

function workspaceHeader(workspaceId: string | undefined): Record<string, string> {
  return workspaceId ? { "X-Workspace-Id": workspaceId } : {};
}

async function serverApiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  if (!API_URL) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("hr_access_token")?.value;

  if (!token) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...workspaceHeader(cookieStore.get(WORKSPACE_COOKIE)?.value),
        ...(options.headers || {}),
      },
      cache: "no-store",
    });
  } catch {
    // Backend temporarily unavailable (e.g., ECONNREFUSED on localhost:4000)
    // Return null so pages can fallback gracefully instead of crashing.
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  return (json?.data ?? json) as T;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeDateString(value: unknown): string {
  const raw = asNonEmptyString(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= 0) return "";
  return raw;
}

function normalizeRoleFromApi(r: any, appOrigin: string): Role {
  const metadataMissing = Boolean(r?.metadata_missing);

  return {
    roleId: r.id,
    title: asNonEmptyString(r?.title) ?? "Role to complete",
    description: asNonEmptyString(r?.description) ?? undefined,
    status: r.status,
    location: asNonEmptyString(r?.location) ?? null,
    type: asNonEmptyString(r?.type) ?? "UNSPECIFIED",
    createdAt: safeDateString(r?.created_at) || new Date().toISOString(),
    endDate: safeDateString(r?.end_date),
    applicationsCount: r.applicationsCount || 0,
    metadataMissing,
    shareLink: r.share_link
      ? `${appOrigin}${applyPath(r.share_link)}`
      : r.id
        ? `${appOrigin}${applyPath(r.id)}`
        : "",
  };
}

export async function getDashboardStatsServer(): Promise<DashboardStats> {
  const stats = await serverApiFetch<any>("/hr/dashboard/stats");
  return {
    totalRoles: stats?.totalRoles || 0,
    activeRoles: stats?.activeRoles || 0,
    activeRolesWithoutApplications: stats?.activeRolesWithoutApplications || 0,
    totalApplications: stats?.totalApplications || 0,
    pendingApplications: stats?.pendingApplications || 0,
    analyzingApplications: stats?.analyzingApplications || 0,
    validatedApplications: stats?.validatedApplications || 0,
    rejectedApplications: stats?.rejectedApplications || 0,
    activeHRMembers: stats?.activeHRMembers || 0,
    pendingAccessRequests: stats?.pendingAccessRequests || 0,
  };
}

export async function getMeServer(): Promise<MeServerPayload | null> {
  const me = await serverApiFetch<MeServerPayload>("/auth/me");
  return me;
}

export type MyPermissionsServer = {
  permissions: string[];
  roleSpecialization: string | null;
  /** OWNER / ADMIN / ACTIVE / ... — the owner has no role_specialization, only this status. */
  membershipStatus: string | null;
};

async function fetchPermissionsWithToken(
  token: string,
  workspaceId: string | null
): Promise<MyPermissionsServer> {
  if (!API_URL) return { permissions: [], roleSpecialization: null, membershipStatus: null };
  try {
    const response = await fetch(`${API_URL}/institution/me/permissions`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...workspaceHeader(workspaceId ?? undefined),
      },
      cache: "no-store",
    });
    if (!response.ok) return { permissions: [], roleSpecialization: null, membershipStatus: null };
    const wrapper = await response.json();
    const res = wrapper?.data ?? wrapper;
    return {
      permissions: Array.isArray(res?.permissions) ? res.permissions : [],
      roleSpecialization: res?.role_specialization ?? null,
      membershipStatus: res?.membership_status ?? null,
    };
  } catch {
    return { permissions: [], roleSpecialization: null, membershipStatus: null };
  }
}

const getCachedPermissions = unstable_cache(
  fetchPermissionsWithToken,
  ["my-permissions"],
  { revalidate: 30 }
);

/** Caller's effective permissions in the active workspace (OWNER → all). */
export async function getMyPermissionsServer(): Promise<MyPermissionsServer> {
  const cookieStore = await cookies();
  const token = cookieStore.get("hr_access_token")?.value;
  if (!token) return { permissions: [], roleSpecialization: null, membershipStatus: null };
  return getCachedPermissions(token, cookieStore.get(WORKSPACE_COOKIE)?.value ?? null);
}

export async function getRecentRolesServer(limit = 5): Promise<Role[]> {
  const roles = await serverApiFetch<any[]>(`/hr/dashboard/recent-roles?limit=${limit}`);
  if (!Array.isArray(roles)) return [];

  const appOrigin = await getAppOrigin();
  return roles.map(r => normalizeRoleFromApi(r, appOrigin));
}

export async function getRecentActivityServer(): Promise<Activity[]> {
  const activities = await serverApiFetch<any[]>("/hr/dashboard/recent-activity");
  if (!Array.isArray(activities)) return [];

  return activities.map((a: any, i: number) => ({
    activityId: a.activityId || `act-${i}`,
    type: a.type,
    message: asNonEmptyString(a?.message) ?? "Activity",
    createdAt: safeDateString(a?.createdAt ?? a?.created_at) || new Date().toISOString(),
  }));
}

export async function getRecentApplicationsServer(limit = 5): Promise<RecentApplicationServerItem[]> {
  const apps = await serverApiFetch<any[]>(`/hr/dashboard/recent-applications?limit=${limit}`);
  if (!Array.isArray(apps)) return [];

  return apps.map((app: any, index: number) => ({
    applicationId: asNonEmptyString(app?.applicationId) ?? asNonEmptyString(app?.id) ?? `recent-app-${index}`,
    candidateName: asNonEmptyString(app?.candidateName) ?? "Candidate",
    roleTitle: asNonEmptyString(app?.roleTitle) ?? "Role",
    submittedAt: safeDateString(app?.submittedAt ?? app?.submitted_at ?? app?.created_at) || new Date().toISOString(),
  }));
}

export async function getRolesServer(): Promise<Role[]> {
  const roles = await serverApiFetch<any[]>("/roles");
  if (!Array.isArray(roles)) return [];

  const appOrigin = await getAppOrigin();
  return roles.map(r => normalizeRoleFromApi(r, appOrigin));
}

export async function getInstitutionInterviewsServer(
  limit = 5,
  { upcomingOnly = false }: { upcomingOnly?: boolean } = {},
): Promise<InstitutionInterviewServerItem[]> {
  const payload = await serverApiFetch<any>("/interviews/institution/list");
  const allRows = Array.isArray(payload?.interviews) ? payload.interviews : [];
  const now = Date.now();
  // "Upcoming" = dated in the future and neither completed nor cancelled.
  const rows = upcomingOnly
    ? allRows.filter((row: any) => {
        const status = String(row?.status ?? "").toUpperCase();
        const at = safeDateString(row?.scheduledAt ?? row?.scheduled_at);
        return status !== "COMPLETED" && status !== "CANCELLED" && !!at && new Date(at).getTime() >= now;
      })
    : allRows;

  return rows
    .slice()
    .sort((a: any, b: any) => {
      const aTime = safeDateString(a?.scheduledAt ?? a?.scheduled_at) || "";
      const bTime = safeDateString(b?.scheduledAt ?? b?.scheduled_at) || "";

      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;

      return new Date(aTime).getTime() - new Date(bTime).getTime();
    })
    .slice(0, Math.max(1, limit))
    .map((row: any) => ({
      id: asNonEmptyString(row?.id) ?? "",
      applicationId: asNonEmptyString(row?.applicationId ?? row?.application_id) ?? "",
      candidateName: asNonEmptyString(row?.candidateName ?? row?.candidate_name) ?? "Candidate",
      roleTitle: asNonEmptyString(row?.roleTitle ?? row?.role_title) ?? "Role",
      status: asNonEmptyString(row?.status) ?? "DRAFT",
      scheduledAt: asNonEmptyString(row?.scheduledAt ?? row?.scheduled_at),
      meetingLocation: asNonEmptyString(row?.meetingLocation ?? row?.meeting_location),
    }));
}

export async function updateRoleStatusServer(roleId: string, status: "ACTIVE" | "CLOSED" | "CANCELLED") {
  return serverApiFetch(`/roles/${roleId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteRoleServer(roleId: string) {
  return serverApiFetch(`/roles/${roleId}`, {
    method: "DELETE",
  });
}

/**
 * Interviews the caller takes part in (recruiter / hiring-manager view): the upcoming ones,
 * and how many finished interviews still wait for the caller's evaluation.
 */
export async function getMyInterviewsServer(
  limit = 3,
): Promise<{ upcoming: InstitutionInterviewServerItem[]; evaluationsDue: number }> {
  const rows = await serverApiFetch<any[]>("/interviews/assigned-to-me");
  if (!Array.isArray(rows)) return { upcoming: [], evaluationsDue: 0 };
  const now = Date.now();

  const evaluationsDue = rows.filter((row) => {
    const scorecard = String(row?.myScorecardStatus ?? "NONE").toUpperCase();
    return String(row?.status ?? "").toUpperCase() === "COMPLETED" && (scorecard === "NONE" || scorecard === "DRAFT");
  }).length;

  const upcoming = rows
    .filter((row) => {
      const status = String(row?.status ?? "").toUpperCase();
      const at = safeDateString(row?.scheduledAt);
      return status !== "COMPLETED" && status !== "CANCELLED" && !!at && new Date(at).getTime() >= now;
    })
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, Math.max(1, limit))
    .map((row) => ({
      id: asNonEmptyString(row?.id) ?? "",
      applicationId: asNonEmptyString(row?.applicationId) ?? "",
      candidateName: asNonEmptyString(row?.candidateName) ?? "Candidate",
      roleTitle: asNonEmptyString(row?.roleTitle) ?? "Role",
      status: asNonEmptyString(row?.status) ?? "DRAFT",
      scheduledAt: asNonEmptyString(row?.scheduledAt),
      meetingLocation: null,
    }));

  return { upcoming, evaluationsDue };
}
