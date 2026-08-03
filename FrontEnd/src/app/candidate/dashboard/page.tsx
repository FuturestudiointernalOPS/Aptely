"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase, Building2, CalendarClock, Shield,
  MessageSquare, ClipboardList, Clock, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t, type Locale } from "@/lib/i18n";
import { ROUTES, createAuthRedirect, candidateReflectionPath, individualsMyApplicationsApi, vaultMyScoreApi } from "@/lib/routes";
import { EmptyState } from "@/components/ui/EmptyState";

interface VaultScore { score: number; nudges: string[] }

type RejectionFeedbackDimension = {
  dimension: string;
  score?: number | null;
  comment?: string | null;
};

type ApplicationItem = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  matching_score?: number | null;
  rejection_feedback?: RejectionFeedbackDimension[] | null;
  interview_id?: string | null;
  interview_status?: string | null;
  interview_scheduled_at?: string | null;
  role: {
    id: string | null;
    title: string;
    institution_name: string | null;
    institution_logo: string | null;
  };
};

const STATUS_CONFIG: Record<string, { labelKey: string; cls: string }> = {
  PENDING:   { labelKey: "individual.dashboard.status.pending",   cls: "bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border)]" },
  ANALYSING: { labelKey: "individual.dashboard.status.analysing", cls: "bg-amber-400/10 text-amber-400 border border-amber-400/30" },
  FINISHED:  { labelKey: "individual.dashboard.status.finished",  cls: "bg-sky-400/10 text-sky-400 border border-sky-400/30" },
  VALIDATED: { labelKey: "individual.dashboard.status.interview", cls: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30" },
  REJECTED:  { labelKey: "individual.dashboard.status.rejected",  cls: "bg-red-400/10 text-red-400 border border-red-400/30" },
  STOPPED:   { labelKey: "individual.dashboard.status.stopped",   cls: "bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)]" },
};

const ACTIVE_STATUSES = new Set(["PENDING", "ANALYSING", "FINISHED", "VALIDATED"]);
const DONE_STATUSES   = new Set(["REJECTED", "STOPPED"]);

type FilterTab = "all" | "active" | "done";

function StatusBadge({ status, locale }: { status: string; locale: Locale }) {
  const cfg = STATUS_CONFIG[status] ?? { labelKey: "", cls: "bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)]" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${cfg.cls}`}>
      {cfg.labelKey ? t(locale, cfg.labelKey, status) : status}
    </span>
  );
}

export default function IndividualDashboardPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();
  const [fetching, setFetching] = useState(true);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [vaultScore, setVaultScore] = useState<VaultScore | null>(null);
  const [filter, setFilter] = useState<FilterTab>("active");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(createAuthRedirect(ROUTES.candidate.dashboard)); return; }
    if (!isPersonal) { router.replace(ROUTES.company.dashboard); return; }

    const load = async () => {
      setFetching(true);
      const [appRes, scoreRes] = await Promise.all([
        apiFetch(individualsMyApplicationsApi, "HR", { method: "GET", cache: "no-store" }),
        apiFetch(vaultMyScoreApi, "HR", { method: "GET", cache: "no-store" }),
      ]);
      const rows: ApplicationItem[] = Array.isArray(appRes?.data) ? appRes.data : Array.isArray(appRes) ? appRes : [];
      // Sort: newest updated_at first
      rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setApplications(rows);
      if (scoreRes?.score !== undefined) setVaultScore(scoreRes as VaultScore);
      setFetching(false);
    };
    void load();
  }, [loading, router, user, isPersonal]);

  const stats = useMemo(() => ({
    total:    applications.length,
    active:   applications.filter((a) => ACTIVE_STATUSES.has(a.status)).length,
    done:     applications.filter((a) => DONE_STATUSES.has(a.status)).length,
    interview: applications.filter((a) => a.status === "VALIDATED").length,
  }), [applications]);

  const filtered = useMemo(() => {
    if (filter === "active") return applications.filter((a) => ACTIVE_STATUSES.has(a.status));
    if (filter === "done")   return applications.filter((a) => DONE_STATUSES.has(a.status));
    return applications;
  }, [applications, filter]);

  // Group by status for the active view
  const grouped = useMemo(() => {
    if (filter !== "active") return null;
    const groups: Partial<Record<string, ApplicationItem[]>> = {};
    const ORDER = ["VALIDATED", "FINISHED", "ANALYSING", "PENDING"];
    for (const s of ORDER) {
      const items = filtered.filter((a) => a.status === s);
      if (items.length > 0) groups[s] = items;
    }
    return groups;
  }, [filtered, filter]);

  const GROUP_LABELS: Record<string, string> = {
    VALIDATED: t(locale, "individual.dashboard.group.validated", "Sélectionnés — en cours d'entretien"),
    FINISHED:  t(locale, "individual.dashboard.group.finished",  "Analyse terminée"),
    ANALYSING: t(locale, "individual.dashboard.group.analysing", "En cours d'analyse"),
    PENDING:   t(locale, "individual.dashboard.group.pending",   "En attente de revue"),
  };

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 text-sm text-[var(--text-muted)]">
          {t(locale, "individual.dashboard.loading", "Loading your applications...")}
        </div>
      </div>
    );
  }

  const TABS: { id: FilterTab; labelKey: string; fallback: string; count: number }[] = [
    { id: "active", labelKey: "individual.dashboard.filter.active", fallback: "En cours",  count: stats.active },
    { id: "done",   labelKey: "individual.dashboard.filter.done",   fallback: "Terminé",   count: stats.done },
    { id: "all",    labelKey: "individual.dashboard.filter.all",    fallback: "Tout",       count: stats.total },
  ];

  return (
    <div className="py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "individual.dashboard.space", "Individual space")}
          </p>
          <h1 className="text-page-title text-[var(--text-primary)] mt-1">
            {t(locale, "individual.dashboard.title", "My applications")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t(locale, "individual.dashboard.subtitle", "Real-time tracking of your job applications.")}
          </p>
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <Link href={ROUTES.candidate.opportunities} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity">
              <Briefcase size={13} />
              {t(locale, "individual.dashboard.discover", "Discover job offers")}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-px bg-[var(--border)] lg:flex lg:items-center lg:gap-0 lg:bg-[var(--bg-surface)] lg:divide-x divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden lg:overflow-x-auto">
          <div className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-3 sm:py-3.5 flex-1 min-w-[72px] flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t(locale, "individual.dashboard.stats.total", "Total")}
            </span>
            <span className="text-lg sm:text-xl font-bold tabular-nums text-[var(--text-primary)]">{stats.total}</span>
          </div>
          <div className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-3 sm:py-3.5 flex-1 min-w-[72px] flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t(locale, "individual.dashboard.stats.inProgress", "In progress")}
            </span>
            <span className="text-lg sm:text-xl font-bold tabular-nums text-amber-400">{stats.active}</span>
          </div>
          <div className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-3 sm:py-3.5 flex-1 min-w-[72px] flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
              {t(locale, "individual.dashboard.stats.interview", "Interview")}
            </span>
            <span className="text-lg sm:text-2xl font-bold tabular-nums text-[var(--accent)]">{stats.interview}</span>
          </div>
          <div className="flex flex-col gap-0.5 bg-[var(--bg-surface)] px-3 sm:px-5 py-3 sm:py-3.5 flex-1 min-w-[72px] flex-shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t(locale, "individual.dashboard.stats.rejected", "Rejected")}
            </span>
            <span className="text-lg sm:text-xl font-bold tabular-nums text-red-400">{stats.done}</span>
          </div>
        </div>

        {/* Vault score */}
        {vaultScore !== null && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  {t(locale, "individual.profile.completeness.label", "Profile completeness")}
                </h2>
              </div>
              <Link href={ROUTES.candidate.vault} className="text-xs font-semibold text-[var(--accent)] hover:opacity-80">
                {t(locale, "individual.dashboard.goToVault", "Go to Vault →")}
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${vaultScore.score}%` }} />
              </div>
              <span className="text-sm font-bold text-[var(--accent)] tabular-nums w-10 text-right">{vaultScore.score}%</span>
            </div>
            {vaultScore.nudges.length > 0 && (
              <ul className="space-y-1">
                {vaultScore.nudges.slice(0, 3).map((nudge, i) => (
                  <li key={i} className="text-xs text-[var(--text-muted)] flex items-start gap-2">
                    <span className="mt-0.5 text-[var(--accent)]">•</span>{t(locale, nudge, nudge)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Filter tabs + Applications */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b border-[var(--border)] px-4 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  filter === tab.id
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t(locale, tab.labelKey, tab.fallback)}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  filter === tab.id
                    ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                    : "bg-[var(--bg-raised)] text-[var(--text-muted)]"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="w-6 h-6" />}
                title={filter === "all"
                  ? t(locale, "individual.dashboard.noApps.title", "No applications yet")
                  : t(locale, "individual.dashboard.noApps.filterEmpty", "No applications in this category")}
                description={filter === "all"
                  ? t(locale, "individual.dashboard.noApps.subtitle", "Use an Aptely share link to apply to your first role.")
                  : undefined}
              />
            ) : grouped ? (
              // Grouped view for "En cours"
              <div className="space-y-6">
                {Object.entries(grouped).map(([status, items]) => (
                  <div key={status}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                        status === "VALIDATED" ? "bg-emerald-400" :
                        status === "FINISHED"  ? "bg-sky-400" :
                        status === "ANALYSING" ? "bg-amber-400" : "bg-[var(--text-muted)]"
                      }`} />
                      {GROUP_LABELS[status] ?? status}
                    </p>
                    <div className="space-y-3">
                      {items!.map((app) => <AppCard key={app.id} app={app} locale={locale} />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Flat list for Terminé / Tout
              <div className="space-y-3">
                {filtered.map((app) => <AppCard key={app.id} app={app} locale={locale} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppCard({ app, locale }: { app: ApplicationItem; locale: Locale }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Logo */}
        <InstitutionLogo logo={app.role.institution_logo} name={app.role.institution_name} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">{app.role.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {app.role.institution_name ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  {new Date(app.updated_at).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")}
                </span>
                {app.matching_score != null && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent)]">
                    {Math.round(app.matching_score > 1 ? app.matching_score : app.matching_score * 100)}% match
                  </span>
                )}
              </div>
            </div>
            <StatusBadge status={app.status} locale={locale} />
          </div>
        </div>
      </div>

      {/* Next step hint */}
      {(() => {
        if (app.interview_scheduled_at) {
          const d = new Date(app.interview_scheduled_at);
          const daysUntil = Math.ceil((d.getTime() - Date.now()) / 86400000);
          const label = daysUntil < 0
            ? `${t(locale, "individual.dashboard.interviewWas", "Interview was")} ${d.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")}`
            : daysUntil === 0 ? t(locale, "individual.dashboard.interviewToday", "Interview today")
            : daysUntil === 1 ? t(locale, "individual.dashboard.interviewTomorrow", "Interview tomorrow")
            : `${t(locale, "individual.dashboard.interviewInDays", "Interview in {{n}} days").replace("{{n}}", String(daysUntil))} (${d.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")})`;
          return (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/5 border border-emerald-400/20 px-2.5 py-1.5 rounded-lg">
              <Clock className="w-3 h-3 flex-shrink-0" />{label}
              <ChevronRight className="w-3 h-3 ml-auto" />
            </div>
          );
        }
        if (app.status === "PENDING") return (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {t(locale, "individual.dashboard.awaitingReview", "Awaiting review")}
          </div>
        );
        if (app.status === "ANALYSING") return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-400/5 border border-amber-400/20 px-2.5 py-1.5 rounded-lg">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {t(locale, "individual.dashboard.aiAnalysis", "Analysis in progress")}
          </div>
        );
        if (app.status === "VALIDATED" && !app.interview_scheduled_at) return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/5 border border-emerald-400/20 px-2.5 py-1.5 rounded-lg">
            <Clock className="w-3 h-3 flex-shrink-0" />
            {t(locale, "individual.dashboard.awaitingSchedule", "Awaiting interview scheduling")}
          </div>
        );
        return null;
      })()}

      {/* Rejection feedback */}
      {app.status === "REJECTED" && app.rejection_feedback && app.rejection_feedback.length > 0 && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">
            {t(locale, "individual.dashboard.feedback.title", "Feedback")}
          </p>
          <ul className="space-y-1.5">
            {app.rejection_feedback.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] capitalize">{f.dimension}</span>
                  {f.score != null && (
                    <span className="ml-2 text-[10px] font-bold text-red-400">{f.score}/5</span>
                  )}
                  {f.comment && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{f.comment}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action links */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border)]">
        <Link href={`${ROUTES.candidate.messages}?app=${app.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
          <MessageSquare className="w-3 h-3" /> {t(locale, "individual.dashboard.message", "Message")}
        </Link>
        {app.interview_id && app.interview_status === "COMPLETED" && (
          <Link href={candidateReflectionPath(app.interview_id)}
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            <ClipboardList className="w-3 h-3" /> {t(locale, "individual.dashboard.reflect", "Reflect")}
          </Link>
        )}
      </div>
    </div>
  );
}

function InstitutionLogo({ logo, name }: { logo: string | null; name: string | null }) {
  const [error, setError] = useState(false);
  if (logo && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo} alt={name ?? ""}
        onError={() => setError(true)}
        className="w-9 h-9 rounded-lg object-cover border border-[var(--border)] shrink-0"
      />
    );
  }
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--border)] shrink-0 flex items-center justify-center">
      <span className="text-xs font-bold text-[var(--accent)]">{initials}</span>
    </div>
  );
}
