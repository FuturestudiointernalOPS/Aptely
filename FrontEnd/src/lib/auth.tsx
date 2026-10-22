/**
 * APTELY — Auth Context
 * Single source of truth for authentication state.
 * Stores tokens in cookies so the middleware can read them.
 */

"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { useRouter } from "next/navigation";
import { refreshHrSessionIfPossible } from "@/lib/apiHelper";
import { ROUTES, AUTH_INTERNAL, PROXY_API } from "@/lib/routes";

interface AuthUser {
    email: string;
    /** JWT access token — present after fresh login, undefined after page refresh */
    token?: string;
    userId?: string | null;
    institutionId?: string | null;
    avatarUrl?: string | null;
    fullName?: string | null;
    /** Platform owner — unlocks the administration area. */
    isSuperAdmin?: boolean;
}

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; institutionId?: string | null; activeInstitutionId?: string | null; profileRole?: string | null; error?: string }>;
    logout: () => void;
    setInstitutionId: (institutionId: string | null) => void;
    setAvatarUrl: (avatarUrl: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Cookie helpers ───────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days = 1) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict${secure}`;
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict${secure}`;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Drops every client-side trace of the session (httpOnly cookies via server route).
    const clearLocalSession = useCallback(() => {
        void fetch(AUTH_INTERNAL.clearCookies, { method: "POST" }).catch(() => {});
        deleteCookie("user_email");
        deleteCookie("hr_token_expiry");
        if (typeof window !== "undefined") localStorage.removeItem("user_institutionId");
        setUser(null);
    }, []);

    const refreshSessionTokens = useCallback(async (): Promise<{ accessToken: string } | null> => {
        const newToken = await refreshHrSessionIfPossible();
        if (!newToken) return null;
        return { accessToken: newToken };
    }, []);

    // Auto-refresh token before expiry. Accepts Unix timestamp (seconds) from the backend.
    const scheduleTokenRefresh = useCallback((expiresAt: number) => {
        if (autoRefreshTimerRef.current) {
            clearTimeout(autoRefreshTimerRef.current);
        }

        const timeUntilExpiry = expiresAt * 1000 - Date.now();
        if (timeUntilExpiry <= 0) return;

        const refreshBuffer = Math.min(50 * 60 * 1000, timeUntilExpiry * 0.8);
        const timeToRefresh = timeUntilExpiry - refreshBuffer;

        autoRefreshTimerRef.current = setTimeout(async () => {
            const newToken = await refreshHrSessionIfPossible();
            if (newToken) {
                setUser(prev => prev ? { ...prev, token: newToken } : null);
                // Re-read expiry from cookie (set by /api/auth/refresh)
                const expiry = getCookie("hr_token_expiry");
                if (expiry) scheduleTokenRefresh(Number(expiry));
                return;
            }
            // A failed refresh can be transient (rate limit, backend restart). Only end
            // the session if the backend confirms we are no longer authenticated;
            // otherwise retry in a minute while the access token is still valid.
            const me = await fetch(PROXY_API.authMe).catch(() => null);
            if (me?.status === 401) {
                clearLocalSession();
            } else {
                autoRefreshTimerRef.current = setTimeout(() => scheduleTokenRefresh(expiresAt), 60_000);
            }
        }, timeToRefresh);
    }, [clearLocalSession]);

    // Restore session from cookies and sync with backend on mount
    useEffect(() => {
        const syncSession = async () => {
            // hr_token_expiry is a readable cookie (just a Unix timestamp) that signals a session may exist.
            const expiry = getCookie("hr_token_expiry");
            const email = getCookie("user_email");

            if (!expiry || Number(expiry) * 1000 < Date.now()) {
                setLoading(false);
                return;
            }

            try {
                const cachedInstitutionId = typeof window !== "undefined"
                    ? localStorage.getItem("user_institutionId")
                    : null;

                // Optimistic state — no token in state (httpOnly cookie, not accessible to JS)
                setUser({ email: email ?? "", institutionId: cachedInstitutionId });

                // Schedule refresh from the expiry we already know
                scheduleTokenRefresh(Number(expiry));

                // Verify session via proxy (proxy reads httpOnly hr_access_token, calls backend)
                let res = await fetch(PROXY_API.authMe);

                if (res.status === 401) {
                    const refreshed = await refreshSessionTokens();
                    if (refreshed?.accessToken) {
                        setUser(prev => prev ? { ...prev, token: refreshed.accessToken } : prev);
                        const newExpiry = getCookie("hr_token_expiry");
                        if (newExpiry) scheduleTokenRefresh(Number(newExpiry));
                        res = await fetch(PROXY_API.authMe);
                    }
                }

                if (res.ok) {
                    const data = await res.json();
                    const resolvedData = data.data !== undefined ? data.data : data;
                    setUser({
                        email: resolvedData.email || email || "",
                        userId: resolvedData.id ?? null,
                        institutionId: resolvedData.institutionId ?? null,
                        avatarUrl: resolvedData.avatarUrl ?? null,
                        fullName: resolvedData.fullName ?? null,
                        isSuperAdmin: Boolean(resolvedData.isSuperAdmin),
                    });
                    if (resolvedData.institutionId) {
                        localStorage.setItem("user_institutionId", resolvedData.institutionId);
                    } else {
                        localStorage.removeItem("user_institutionId");
                    }
                } else if (res.status === 401) {
                    // Access token rejected and refresh failed: the session is really over.
                    clearLocalSession();
                } else {
                    // 429 / 5xx: the session may still be valid — keep the optimistic
                    // state instead of logging the user out over a transient error.
                    console.warn("[AUTH] Session check failed with status", res.status);
                }
            } catch (err) {
                console.error("[AUTH] Sync failed", err);
            } finally {
                setLoading(false);
            }
        };

        syncSession();

        // Cleanup on unmount
        return () => {
            if (autoRefreshTimerRef.current) {
                clearTimeout(autoRefreshTimerRef.current);
            }
        };
    }, [refreshSessionTokens, scheduleTokenRefresh, clearLocalSession]);

    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; institutionId?: string | null; activeInstitutionId?: string | null; profileRole?: string | null; error?: string }> => {
        try {
            const res = await fetch(PROXY_API.authLogin, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            // Extract tokens — backend sends { session: { accessToken, refreshToken, ... } }
            const token = data.session?.accessToken || data.session?.access_token || null;
            const refreshToken = data.session?.refreshToken || data.session?.refresh_token || null;

            if (!res.ok || !token || !refreshToken) {
                return {
                    success: false,
                    error: data.error || data.message || "Invalid email or password",
                };
            }

            const institutionId = data.user?.institutionId ?? null;
            const activeInstitutionId = (data.user?.activeInstitutionId as string | null | undefined) ?? institutionId ?? null;
            const profileRole: string | null = (data.user?.profileRole as string | null | undefined) ?? null;
            const expiresAt: number = data.session?.expiresAt ?? data.session?.expires_at ?? 0;
            const userId: string | null = data.user?.id ?? null;

            if (typeof window !== "undefined") {
                try {
                    if (activeInstitutionId) window.localStorage.setItem("aptely_active_workspace", activeInstitutionId);
                    else window.localStorage.removeItem("aptely_active_workspace");
                } catch { /* ignore */ }
            }

            // Store access token as httpOnly cookie + expiry as readable cookie
            // Must await before navigating — httpOnly cookie must be present for the
            // first /api/backend/* request on the destination page.
            setCookie("user_email", email);
            await Promise.all([
                fetch(AUTH_INTERNAL.setAccessToken, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ accessToken: token, expiresAt }),
                }).catch(() => {}),
                fetch(AUTH_INTERNAL.setCookies, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken }),
                }).catch(() => {}),
            ]);

            if (typeof window !== "undefined") {
                if (institutionId) {
                    localStorage.setItem("user_institutionId", institutionId);
                } else {
                    localStorage.removeItem("user_institutionId");
                }
            }

            // Keep token in memory state for Supabase real-time subscriptions (messages pages).
            // It is NOT persisted to a readable cookie — httpOnly cookie is the canonical store.
            setUser({ email, token, userId, institutionId, fullName: data.user?.fullName ?? null, avatarUrl: data.user?.avatarUrl ?? null, isSuperAdmin: Boolean(data.user?.isSuperAdmin) });

            if (expiresAt) scheduleTokenRefresh(expiresAt);
            return { success: true, institutionId, activeInstitutionId, profileRole };
        } catch (err) {
            // Only reaches here when the backend is unreachable (server down, CORS, etc.)
            console.error("[Auth] Login network error:", err);
            return { success: false, error: `Cannot reach the server.` };
        }
    }, [scheduleTokenRefresh]);

    const logout = useCallback(() => {
        // Best-effort server-side session revocation (proxy reads httpOnly cookie, adds auth header)
        void fetch(PROXY_API.authLogout, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        }).catch((err) => {
            console.warn("[AUTH] Logout revocation failed:", err);
        });

        if (autoRefreshTimerRef.current) {
            clearTimeout(autoRefreshTimerRef.current);
        }

        // Clear all auth cookies (including httpOnly) via server route
        void fetch(AUTH_INTERNAL.clearCookies, { method: "POST" }).catch(() => {});
        deleteCookie("user_email");
        deleteCookie("hr_token_expiry");
        if (typeof window !== "undefined") {
            localStorage.removeItem("user_institutionId");
            localStorage.removeItem("aptely_active_workspace");
        }
        setUser(null);
    }, []);

    const setInstitutionId = useCallback((institutionId: string | null) => {
        // Update localStorage
        if (typeof window !== "undefined") {
            if (institutionId) {
                localStorage.setItem("user_institutionId", institutionId);
            } else {
                localStorage.removeItem("user_institutionId");
            }
        }

        if (user) {
            setUser({ ...user, institutionId });
        }
    }, [user]);

    const setAvatarUrl = useCallback((avatarUrl: string | null) => {
        setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, setInstitutionId, setAvatarUrl }}>
            {children}
        </AuthContext.Provider>
    );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}

/**
 * Hook to ensure user has an institution before accessing a page.
 * Redirects to onboarding if institutionId is missing.
 */
export function useRequireInstitution() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return; // Wait for auth to load

        if (!user) {
            console.log("[REQUIRE_INSTITUTION] No authenticated user, redirecting to login");
            router.push(ROUTES.login);
            return;
        }

        // Authenticated but missing institution setup
        if (!user.institutionId) {
            console.log("[REQUIRE_INSTITUTION] No institution found, redirecting to onboarding");
            router.push(`${ROUTES.company.settings.accessStatus}?state=incomplete&reason=institution`);
        }
    }, [loading, user, router]);

    return { user, loading };
}

/**
 * Hook to fetch and check user's current auth status.
 * Returns: virgin (no institution, no pending request), 
 *          pending (waiting for approval), 
 *          approved (has institution_id)
 * 
 * IMPORTANT: Only fetches ONCE on first mount, not on re-renders
 */
function useCheckAuthStatus() {
    const { user, loading: authLoading } = useAuth();
    const [status, setStatus] = useState<"virgin" | "pending" | "approved">("virgin");
    const [pendingJoinRequest, setPendingJoinRequest] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasChecked = useRef(false);

    useEffect(() => {
        // Only check once: wait for auth to load, then fetch status
        if (authLoading) return;
        if (hasChecked.current) return; // Already checked
        
        if (!user) {
            // User not authenticated
            setStatus("virgin");
            setIsChecking(false);
            hasChecked.current = true;
            return;
        }

        // Mark as checked before we start
        hasChecked.current = true;

        // Fetch current auth status including any pending join request
        const checkStatus = async () => {
            const controller = new AbortController();
            const timeoutMs = 10000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(PROXY_API.authMe, {
                    method: "GET",
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch auth status");
                }

                const data = await response.json();

                if (data.institutionId) {
                    setStatus("approved");
                    setPendingJoinRequest(null);
                } else if (data.pendingJoinRequest) {
                    setStatus("pending");
                    setPendingJoinRequest(data.pendingJoinRequest);
                } else {
                    setStatus("virgin");
                    setPendingJoinRequest(null);
                }
                setError(null);
            } catch (err) {
                console.error("[AUTH STATUS] Error checking status:", err);
                if (err instanceof DOMException && err.name === "AbortError") {
                    setError("Auth status check timed out");
                } else {
                    setError(err instanceof Error ? err.message : "Failed to check status");
                }
                // Default to virgin on error (safer than blocking)
                setStatus("virgin");
            } finally {
                clearTimeout(timeoutId);
                setIsChecking(false);
            }
        };

        checkStatus();
    }, [authLoading, user]); // Only depend on auth state, not on itself

    return { status, pendingJoinRequest, isChecking, error };
}

/**
 * Hook for onboarding page.
 * Allows virgin (no institution, no pending request) users only.
 * Redirects pending users to waiting-approval and approved users to dashboard.
 */
export function useRequireVirginOrPending() {
    const router = useRouter();
    const { status, isChecking } = useCheckAuthStatus();

    useEffect(() => {
        if (isChecking) return; // Still checking auth status

        if (status === "pending") {
            console.log("[REQUIRE VIRGIN] User has pending request, redirecting to waiting-approval");
            router.push(ROUTES.company.settings.waitingApproval);
        } else if (status === "approved") {
            console.log("[REQUIRE VIRGIN] User has institution, redirecting to explicit access status");
            router.push(`${ROUTES.company.settings.accessStatus}?state=approved&reason=already_member`);
        }
    }, [status, isChecking, router]);

    return { status, isChecking };
}

/**
 * Hook for waiting-approval page.
 * Allows pending users only.
 * Redirects virgin users to onboarding and approved users to dashboard.
 */
export function useRequirePending() {
    const router = useRouter();
    const { status, pendingJoinRequest, isChecking } = useCheckAuthStatus();

    useEffect(() => {
        if (isChecking) return; // Still checking auth status

        if (status === "virgin") {
            console.log("[REQUIRE PENDING] User is virgin, redirecting to onboarding");
            router.push(ROUTES.company.settings.onboarding);
        } else if (status === "approved") {
            console.log("[REQUIRE PENDING] User is already approved, redirecting to explicit access status");
            router.push(`${ROUTES.company.settings.accessStatus}?state=approved&reason=already_member`);
        }
    }, [status, isChecking, router]);

    return { status, pendingJoinRequest, isChecking };
}

