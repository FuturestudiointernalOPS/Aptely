"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { apiFetch, isApiSuccess, refreshHrSessionIfPossible } from "@/lib/apiHelper";
import { useAuth } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import {
  ROUTES,
  institutionInviteJoinApi,
  invitationPublicApi,
} from "@/lib/routes";

interface InviteInfo {
  institutionId: string;
  institutionName: string;
  logoUrl: string | null;
  roleSpecialization: string | null;
  jobPositionTitle: string | null;
  customLabel: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  HR_LEAD: "Responsable RH",
  HIRING_MANAGER: "Hiring Manager",
  RECRUITER: "Recruteur",
  STANDARD_HR: "RH Standard",
  MEMBER: "Employé",
  CUSTOM: "Rôle personnalisé",
};

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const token = params?.token as string;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch(invitationPublicApi(token), "none")
      .then((data) => {
        if (data) setInfo(data as InviteInfo);
        else
          setError(
            tr(
              "join.invalidLink",
              "This invite link is invalid or has been revoked.",
            ),
          );
      })
      .catch(() => setError(tr("join.loadError", "Failed to load invitation.")))
      .finally(() => setLoadingInfo(false));
  }, [token]);

  const handleJoin = async () => {
    setError(null);
    setJoining(true);
    try {
      const res = await apiFetch(institutionInviteJoinApi(token), "HR", {
        method: "POST",
      });
      // apiFetch returns a truthy error object on 401/403: check for real success.
      if (!isApiSuccess(res)) {
        setError(
          tr(
            "join.joinFailed",
            "Failed to join. You may already be a member of an institution.",
          ),
        );
        return;
      }
      // Refresh JWT so workspace context sees the new institution_id claim
      await refreshHrSessionIfPossible();
      setJoined(true);
      setTimeout(() => window.location.replace(ROUTES.company.calendar), 2000);
    } catch {
      setError(tr("join.unexpectedError", "An unexpected error occurred."));
    } finally {
      setJoining(false);
    }
  };

  if (loadingInfo || authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-10 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-rose-400/10 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">
            {tr("join.invalidTitle", "Invalid Invite")}
          </h1>
          <p className="text-[var(--text-muted)] text-sm">{error}</p>
          <Link
            href="/"
            className="inline-block text-[var(--accent)] font-semibold text-sm hover:underline"
          >
            {tr("join.backHome", "Back to home")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-5%] w-64 h-64 bg-[var(--accent)]/[0.06] rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-56 h-56 bg-blue-500/[0.05] rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2">
            <svg viewBox="0 0 100 100" className="w-7 h-7" aria-hidden="true">
              <circle
                cx="55"
                cy="45"
                r="30"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-[var(--text-primary)]"
              />
              <line
                x1="15"
                y1="85"
                x2="35"
                y2="65"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                className="text-[var(--text-primary)]"
              />
              <path
                d="M55 25 L58 42 L75 45 L58 48 L55 65 L52 48 L35 45 L52 42 Z"
                fill="var(--accent)"
              />
            </svg>
            <span className="text-lg font-semibold text-[var(--text-primary)]">
              Aptely
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 text-center space-y-6">
          {joined ? (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-emerald-400/10 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-[var(--text-primary)]">
                {tr("join.success", "You've joined!")}
              </h2>
              <p className="text-[var(--text-muted)] text-sm">
                {tr("join.successSubtitle", "Welcome to")}{" "}
                <strong className="text-[var(--text-primary)]">
                  {info?.institutionName}
                </strong>
              </p>
              <p className="text-[var(--text-muted)] text-xs">
                {tr("join.redirecting", "Redirecting...")}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="w-16 h-16 bg-[var(--accent-dim)] border border-[var(--accent)]/20 rounded-2xl flex items-center justify-center mx-auto">
                  {info?.logoUrl ? (
                    <img
                      src={info.logoUrl}
                      alt={info.institutionName}
                      className="w-10 h-10 object-contain rounded-xl"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-[var(--accent)]">
                      {info?.institutionName
                        ? info.institutionName.charAt(0).toUpperCase()
                        : "?"}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
                  {tr("join.title", "You're invited!")}
                </h1>
                <p className="text-[var(--text-muted)] text-sm">
                  {tr("join.subtitle", "Join")}{" "}
                  <strong className="text-[var(--text-primary)]">
                    {info?.institutionName}
                  </strong>{" "}
                  {tr("join.onAptely", "on Aptely")}
                  {(info?.roleSpecialization || info?.jobPositionTitle) && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-xs font-semibold text-[var(--accent)]">
                      {info.jobPositionTitle ??
                        (info.roleSpecialization
                          ? (ROLE_LABELS[info.roleSpecialization] ??
                            info.roleSpecialization)
                          : null)}
                    </div>
                  )}
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-rose-400/10 border border-rose-400/20 rounded-xl text-rose-400 text-sm text-left">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {user ? (
                user.institutionId ? (
                  <div className="space-y-3">
                    <div className="px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-400 text-sm">
                      {tr(
                        "join.alreadyMember",
                        "You're already linked to an institution. Leave it first to accept this invite.",
                      )}
                    </div>
                    <Link
                      href="/"
                      className="block text-[var(--accent)] font-semibold text-sm hover:underline"
                    >
                      {tr("join.goToDashboard", "Go to dashboard")}
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-aptely-orange hover:bg-aptely-orange/90 text-white font-display font-bold rounded-xl transition-all shadow-glow-sm disabled:opacity-50"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {tr("join.joining", "Joining...")}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        {tr("join.acceptButton", "Accept & Join")}
                      </>
                    )}
                  </button>
                )
              ) : (
                <div className="space-y-3">
                  <p className="text-[var(--text-muted)] text-sm">
                    {tr(
                      "join.loginRequired",
                      "Sign in or create an account to accept this invitation.",
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href={`/login?redirect=/join/${token}`}
                      className="py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-semibold text-sm hover:border-[var(--accent)]/30 transition-all text-center"
                    >
                      {tr("join.signIn", "Sign in")}
                    </Link>
                    <Link
                      href={`/register?redirect=/join/${token}`}
                      className="py-3 rounded-xl bg-aptely-orange text-white font-semibold text-sm hover:bg-aptely-orange/90 transition-all text-center"
                    >
                      {tr("join.signUp", "Sign up")}
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
