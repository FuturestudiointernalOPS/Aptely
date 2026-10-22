"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";

export default function AuthCallbackPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);

    useEffect(() => {
        const handleCallback = async () => {
            const hash = window.location.hash.substring(1);
            if (!hash) {
                const searchParams = new URLSearchParams(window.location.search);
                const errorDesc = searchParams.get("error_description");
                if (errorDesc) {
                    setError(errorDesc);
                } else {
                    router.push(ROUTES.login);
                }
                return;
            }

            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");

            if (!accessToken || !refreshToken) {
                setError(tr("auth.callback.missingTokens", "Authentication failed: Missing tokens."));
                return;
            }

            const expiresIn = parseInt(params.get("expires_in") ?? "3600", 10);
            const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

            // Store tokens as httpOnly cookies via server routes
            await Promise.all([
                fetch("/api/auth/set-access-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ accessToken, expiresAt }),
                }),
                fetch("/api/auth/set-cookies", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken }),
                }),
            ]);

            try {
                // Proxy reads httpOnly cookie and adds Authorization header
                const res = await fetch("/api/backend/auth/me");

                if (res.ok) {
                    const data = await res.json();

                    const resolvedData = data.data !== undefined ? data.data : data;
                    if (resolvedData.email) {
                        const secure = window.location.protocol === "https:" ? "; Secure" : "";
                        document.cookie = `user_email=${encodeURIComponent(resolvedData.email)}; path=/; SameSite=Strict${secure}`;
                    }
                    if (resolvedData.institutionId) {
                        localStorage.setItem("user_institutionId", resolvedData.institutionId);
                    }

                    const postLoginRedirect = localStorage.getItem("post_login_redirect");
                    localStorage.removeItem("post_login_redirect");

                    if (postLoginRedirect) {
                        window.location.href = postLoginRedirect;
                    } else if (resolvedData.isSuperAdmin && !resolvedData.institutionId) {
                        // Platform admins without a company land on the platform overview.
                        window.location.href = ROUTES.admin.root;
                    } else if (resolvedData.institutionId) {
                        window.location.href = ROUTES.company.dashboard;
                    } else {
                        window.location.href = ROUTES.candidate.dashboard;
                    }
                } else {
                    setError(tr("auth.callback.profileError", "Failed to fetch user profile."));
                }
            } catch (err) {
                setError(tr("auth.callback.genericError", "An error occurred while authenticating."));
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-8 rounded-3xl max-w-sm w-full text-center">
                {error ? (
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-display font-bold text-[var(--text-primary)]">
                            {tr("auth.callback.failedTitle", "Authentication Failed")}
                        </h2>
                        <p className="text-[var(--text-muted)] text-sm">{error}</p>
                        <button
                            onClick={() => router.push(ROUTES.login)}
                            className="mt-4 w-full py-3 bg-white/5 hover:bg-white/10 text-[var(--text-primary)] rounded-xl font-bold transition-colors"
                        >
                            {tr("auth.callback.returnToLogin", "Return to Login")}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-aptely-orange/10 rounded-full flex items-center justify-center mx-auto text-aptely-orange animate-pulse">
                            <svg viewBox="0 0 100 100" className="w-8 h-8" aria-hidden="true">
                              <circle cx="55" cy="45" r="30" fill="none" stroke="currentColor" strokeWidth="10" className="text-[var(--text-primary)]" />
                              <line x1="15" y1="85" x2="35" y2="65" stroke="currentColor" strokeWidth="12" strokeLinecap="round" className="text-[var(--text-primary)]" />
                              <path d="M55 25 L58 42 L75 45 L58 48 L55 65 L52 48 L35 45 L52 42 Z" fill="var(--accent)" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-display font-bold text-[var(--text-primary)]">
                            {tr("auth.callback.authenticating", "Authenticating...")}
                        </h2>
                        <p className="text-[var(--text-muted)] text-sm">
                            {tr("auth.callback.pleaseWait", "Please wait while we securely log you in.")}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
