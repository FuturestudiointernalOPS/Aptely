/**
 * APTELY — API Helper
 * Makes authenticated requests through the Next.js proxy at /api/backend.
 * The proxy reads the httpOnly hr_access_token cookie and adds the Authorization header.
 */

import { getClientLocale } from "@/lib/i18n";
import { AUTH_INTERNAL, type ApiPath } from "@/lib/routes";

const isDev = process.env.NODE_ENV !== "production";

// Direct backend URL (for server-side use only — apiServer.ts)
// Client-side code should use apiFetch which routes through /api/backend proxy.
const DEV_FALLBACK_API_URL = "http://localhost:4000";

function normalizeApiUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
  ?? (isDev ? DEV_FALLBACK_API_URL : undefined);

// Client-side proxy base — all apiFetch calls go through this Next.js API route.
// The proxy reads the httpOnly hr_access_token cookie server-side and forwards to backend.
const PROXY_BASE = "/api/backend";

// ── Token expiry reader (non-sensitive readable cookie) ───────────────────────

function getTokenExpiry(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )hr_token_expiry=([^;]*)/);
  return match ? Number(decodeURIComponent(match[1])) : null;
}

// ── Active workspace persistence ──────────────────────────────────────────────

const WORKSPACE_STORAGE_KEY = "aptely_active_workspace";

/**
 * Persists the active workspace for client calls (localStorage → X-Workspace-Id in
 * apiFetch) and for server-rendered pages (cookie → X-Workspace-Id in apiServer).
 * `null` = personal workspace, `undefined` = forget it entirely (logout).
 */
export function persistActiveWorkspace(value: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(WORKSPACE_STORAGE_KEY, value);
    else window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = value === undefined
    ? `${WORKSPACE_STORAGE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    : `${WORKSPACE_STORAGE_KEY}=${encodeURIComponent(value ?? "individual")}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

// Singleton refresh promise — prevents concurrent token rotations (race condition)
let _refreshPromise: Promise<{ accessToken: string; expiresAt: number } | null> | null = null;

// Calls the Next.js proxy route which reads the httpOnly refresh token server-side,
// calls the backend, and sets new httpOnly cookies via Set-Cookie.
export async function refreshHrSessionIfPossible(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise.then(r => r?.accessToken ?? null);

  _refreshPromise = (async () => {
    try {
      const response = await fetch(AUTH_INTERNAL.refresh, { method: "POST" });
      if (!response.ok) return null;

      const data = await response.json();
      const newAccessToken = data.accessToken;
      if (!newAccessToken) return null;

      return { accessToken: newAccessToken, expiresAt: data.expiresAt ?? 0 };
    } catch {
      return null;
    } finally {
      setTimeout(() => { _refreshPromise = null; }, 500);
    }
  })();

  return _refreshPromise.then(r => r?.accessToken ?? null);
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function apiFetch(
  endpoint: ApiPath,
  role: "HR" | "none" | undefined = "HR",
  options: RequestInit = {}
) {
  const safeEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${PROXY_BASE}${safeEndpoint}`;

  try {
    const executeRequest = async (): Promise<Response> => {
      const headers: Record<string, string> = { ...options.headers as Record<string, string> };

      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      if (typeof window !== "undefined" && !headers["X-Workspace-Id"]) {
        try {
          const stored = window.localStorage.getItem("aptely_active_workspace");
          headers["X-Workspace-Id"] = stored && stored !== "personal" ? stored : "individual";
        } catch {
          /* ignore localStorage errors */
        }
      }

      if (typeof window !== "undefined" && !headers["x-locale"]) {
        try {
          headers["x-locale"] = getClientLocale();
        } catch {
          /* ignore */
        }
      }

      return fetch(url, { ...options, headers });
    };

    let res = await executeRequest();

    if (res.status === 401 && role === "HR" && safeEndpoint !== "/auth/refresh") {
      const refreshedToken = await refreshHrSessionIfPossible();
      if (refreshedToken) {
        if (isDev) {
          console.warn(`[API] ${safeEndpoint} got 401, token refreshed, retrying request once`);
        }
        res = await executeRequest();
      }
    }

    if (res.status === 304) {
      if (isDev) console.warn(`[API] ${safeEndpoint} returned 304 Not Modified (cached)`);
      return null;
    }

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      let errorData: Record<string, unknown> = {};

      try {
        const errorText = await res.text();
        try {
          errorData = JSON.parse(errorText);
          errorMessage = (errorData?.error as string) || (errorData?.message as string) || errorMessage;
        } catch {
          if (errorText) errorMessage = errorText;
        }
      } catch { /* body unreadable */ }

      if (res.status === 401) {
        const authError = {
          status: 401,
          error: "Session expired or invalid. Please log in again.",
          isAuthError: true,
        };
        if (isDev) {
          console.error(`[API] ${safeEndpoint} failed (401): ${JSON.stringify(authError)}`);
        }
        return authError;
      }

      if (res.status === 403 && errorMessage.includes("not linked to any institution")) {
        if (isDev) {
          console.error(`[API] ${safeEndpoint} failed (403 Institution): ${errorMessage}`);
        }
        return null;
      }

      if (res.status === 403) {
        const permError = {
          status: 403,
          error: errorMessage || "You do not have permission to perform this action.",
          isPermissionError: true,
        };
        // warn (not error) — expected for role-gated routes; avoids Next.js red overlay spam
        if (isDev) {
          console.warn(`[API] ${safeEndpoint} Permission denied: ${errorMessage}`);
        }
        // Dispatch a global event so the UI can show a toast/notification
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("aptely:permission-denied", { detail: permError }));
        }
        return permError;
      }

      if (res.status === 404) {
        if (isDev) {
          console.warn(`[API] ${safeEndpoint} failed (404): Resource not found`);
        }
        return null;
      }

      if (isDev) {
        console.error(`[API] ${safeEndpoint} failed (${res.status}) on ${url}: ${errorMessage}`);
      } else {
        console.error(`[API] request failed (${res.status})`);
      }
      return null;
    }

    // 204 No Content — success with no body (e.g., deleteReference)
    if (res.status === 204) return {};

    const data = await res.json();
    // Preserve { data, meta } shape for paginated endpoints
    if (data.data !== undefined && (data.meta !== undefined || data.pagination !== undefined)) return data;
    return data.data !== undefined ? data.data : data;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (isDev) console.error(`Network Error on ${url}:`, error);
    else console.error("Network Error");
    return null;
  }
}

/**
 * True when an apiFetch result represents a successful call. apiFetch returns a
 * truthy `{ isAuthError }` / `{ isPermissionError }` object for 401/403, so a plain
 * `!!res` would report a refused action (e.g. "cannot manage a member of higher
 * rank") as a success.
 */
export function isApiSuccess(res: unknown): boolean {
  if (res === null || res === undefined) return false;
  if (typeof res === "object" && ("isAuthError" in res || "isPermissionError" in res)) return false;
  return true;
}

// Lightweight API caller that throws on any HTTP/network error
// ── Wrapper that auto-detects role from session ───────────────────────────────

export async function apiCall(
  endpoint: ApiPath,
  options: RequestInit = {},
  config?: { requireAuth?: boolean }
) {
  const expiry = getTokenExpiry();
  const hasSession = expiry ? expiry * 1000 > Date.now() : false;

  if (config?.requireAuth && !hasSession) {
    throw new Error("Authentication required but no session found");
  }

  const result = await apiFetch(endpoint, "HR", options);

  if (result === null) {
    throw new Error(`Request failed for ${endpoint}`);
  }

  return result;
}

/**
 * apiSend — like apiFetch but THROWS Error(serverMessage) on any non-2xx so the
 * caller can display the backend's specific message (e.g. "PDF corrompu…",
 * "code d'invitation invalide") instead of a generic "vérifiez votre connexion".
 * Use for user-initiated mutations where the failure reason must be shown.
 */
export async function apiSend(
  endpoint: ApiPath,
  options: RequestInit = {},
): Promise<unknown> {
  const safeEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${PROXY_BASE}${safeEndpoint}`;

  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (typeof window !== "undefined") {
    if (!headers["X-Workspace-Id"]) {
      try {
        const stored = window.localStorage.getItem("aptely_active_workspace");
        headers["X-Workspace-Id"] = stored && stored !== "personal" ? stored : "individual";
      } catch { /* ignore */ }
    }
    if (!headers["x-locale"]) {
      try { headers["x-locale"] = getClientLocale(); } catch { /* ignore */ }
    }
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const txt = await res.text();
      try {
        const j = JSON.parse(txt) as Record<string, unknown>;
        message = (j?.error as string) || (j?.message as string) || message;
      } catch {
        if (txt) message = txt;
      }
    } catch { /* body unreadable */ }
    throw new Error(message);
  }

  const data = await res.json();
  return (data as { data?: unknown }).data !== undefined ? (data as { data: unknown }).data : data;
}
