"use client";

import { useEffect, useState } from "react";
import { Users, TrendingDown, Calendar, Briefcase, Clock } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import {
  analyticsHrHeadcountApi,
  analyticsHrTurnoverApi,
  analyticsHrLeaveStatsApi,
  analyticsPhase2FunnelApi,
  analyticsPhase2TimeToHireApi,
} from "@/lib/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientLocale, t } from "@/lib/i18n";

interface HeadcountData {
  total: number;
  active: number;
  terminated: number;
  onLeave: number;
  byDepartment: { name: string; count: number }[];
  monthlyHires: { month: string; count: number }[];
}

interface TurnoverData {
  terminatedLast12Months: number;
  currentHeadcount: number;
  turnoverRatePct: number;
  monthlyTerminations: { month: string; count: number }[];
}

interface LeaveData {
  year: number;
  totalApprovedDays: number;
  pendingCount: number;
  totalRequests: number;
  byType: { type: string; days: number }[];
}

interface FunnelData {
  applied: number;
  decided: number;
  offersSent: number;
  offersAccepted: number;
  onboardingStarted: number;
}

interface TimeToHireData {
  samples: number;
  averageDays: number;
  medianDays: number;
}

export default function AnalyticsPage() {
  const locale = getClientLocale();
  const [headcount, setHeadcount] = useState<HeadcountData | null>(null);
  const [turnover, setTurnover] = useState<TurnoverData | null>(null);
  const [leave, setLeave] = useState<LeaveData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [timeToHire, setTimeToHire] = useState<TimeToHireData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [hc, tv, lv, fn, tth] = await Promise.all([
        apiFetch(analyticsHrHeadcountApi, "HR") as Promise<HeadcountData | null>,
        apiFetch(analyticsHrTurnoverApi, "HR") as Promise<TurnoverData | null>,
        apiFetch(analyticsHrLeaveStatsApi, "HR") as Promise<LeaveData | null>,
        apiFetch(analyticsPhase2FunnelApi, "HR") as Promise<FunnelData | null>,
        apiFetch(analyticsPhase2TimeToHireApi, "HR") as Promise<TimeToHireData | null>,
      ]);
      setHeadcount(hc ?? null);
      setTurnover(tv ?? null);
      setLeave(lv ?? null);
      setFunnel(fn ?? null);
      setTimeToHire(tth ?? null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 rounded-lg bg-[var(--bg-raised)] animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--bg-raised)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const maxDeptCount = Math.max(...(headcount?.byDepartment?.map((d) => d.count) ?? [1]), 1);
  const maxHireCount = Math.max(...(headcount?.monthlyHires?.map((m) => m.count) ?? [1]), 1);

  const funnelSteps = funnel
    ? [
        { label: t(locale, "analytics.funnel.applied", "Candidatures"), value: funnel.applied },
        { label: t(locale, "analytics.funnel.decided", "Décidées"), value: funnel.decided },
        { label: t(locale, "analytics.funnel.offers", "Offres envoyées"), value: funnel.offersSent },
        { label: t(locale, "analytics.funnel.accepted", "Acceptées"), value: funnel.offersAccepted },
        { label: t(locale, "analytics.funnel.onboarding", "Onboarding"), value: funnel.onboardingStarted },
      ]
    : [];

  const maxFunnel = funnelSteps.length > 0 ? Math.max(...funnelSteps.map((s) => s.value), 1) : 1;

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <PageHeader
        title={t(locale, "analytics.title", "Analytiques RH")}
        subtitle={t(locale, "analytics.subtitle", "Vue d'ensemble recrutement et effectifs")}
      />

      {/* Stats strip */}
      <div className="flex items-stretch divide-x divide-[var(--border)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <Stat icon={<Users size={16} />} label={t(locale, "analytics.headcount.total", "Effectif total")} value={String(headcount?.total ?? "—")} />
        <Stat icon={<Users size={16} />} label={t(locale, "analytics.headcount.active", "Actifs")} value={String(headcount?.active ?? "—")} accent />
        <Stat icon={<TrendingDown size={16} />} label={t(locale, "analytics.turnover.rate", "Turnover (12 mois)")} value={headcount !== null ? `${turnover?.turnoverRatePct ?? 0}%` : "—"} />
        <Stat icon={<Calendar size={16} />} label={t(locale, "analytics.leave.days", "Jours congés approuvés")} value={String(leave?.totalApprovedDays ?? "—")} />
        <Stat icon={<Clock size={16} />} label={t(locale, "analytics.tti.avg", "Délai moyen embauche")} value={timeToHire?.averageDays != null ? `${timeToHire.averageDays}j` : "—"} />
        <Stat icon={<Briefcase size={16} />} label={t(locale, "analytics.funnel.accepted", "Offres acceptées")} value={String(funnel?.offersAccepted ?? "—")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount by department */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t(locale, "analytics.headcount.by_dept", "Effectifs par département")}
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {!headcount?.byDepartment?.length ? (
              <p className="text-sm text-[var(--text-muted)] py-4 text-center">
                {t(locale, "analytics.empty", "Aucune donnée")}
              </p>
            ) : (
              headcount.byDepartment.map((dept) => (
                <div key={dept.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)] truncate max-w-[70%]">{dept.name}</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{dept.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-raised)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${(dept.count / maxDeptCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recruitment funnel */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t(locale, "analytics.funnel.title", "Entonnoir recrutement")}
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {funnelSteps.map((step, idx) => (
              <div key={step.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] w-4">{idx + 1}</span>
                    <span className="text-sm text-[var(--text-primary)]">{step.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{step.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-raised)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(step.value / maxFunnel) * 100}%`,
                      background: `oklch(65% 0.22 ${42 + idx * 20})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly hires chart */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t(locale, "analytics.hires.monthly", "Embauches mensuelles (12 mois)")}
            </p>
          </div>
          <div className="px-5 pt-4 pb-2 flex items-end gap-1 h-40">
            {(headcount?.monthlyHires ?? []).map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                <div
                  className="w-full rounded-t bg-[var(--accent)] opacity-80 group-hover:opacity-100 transition-opacity min-h-[2px]"
                  style={{ height: `${Math.max((m.count / maxHireCount) * 100, 4)}%` }}
                />
                <span className="text-[8px] text-[var(--text-muted)] rotate-45 origin-left whitespace-nowrap">
                  {m.month.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave stats */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t(locale, "analytics.leave.title", "Congés")} {leave?.year}
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{t(locale, "analytics.leave.total_requests", "Total demandes")}</span>
              <span className="font-semibold text-[var(--text-primary)]">{leave?.totalRequests ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{t(locale, "analytics.leave.pending", "En attente")}</span>
              <span className="font-semibold text-amber-400">{leave?.pendingCount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-[var(--border)] pt-3">
              <span className="text-[var(--text-secondary)]">{t(locale, "analytics.leave.approved_days", "Jours approuvés")}</span>
              <span className="font-semibold text-[var(--accent)]">{leave?.totalApprovedDays ?? 0}j</span>
            </div>
            {(leave?.byType ?? []).map((lt) => (
              <div key={lt.type} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">{t(locale, `leave.type.${lt.type}`, lt.type)}</span>
                <span className="text-[var(--text-secondary)]">{lt.days}j</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time-to-hire */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 flex items-center gap-6">
          <Clock size={32} className="text-[var(--accent)] shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t(locale, "analytics.tti.title", "Délai d'embauche")}
            </p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {timeToHire?.averageDays ?? "—"}
              <span className="text-base font-normal text-[var(--text-muted)] ml-1">{t(locale, "analytics.tti.days", "j moy.")}</span>
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {t(locale, "analytics.tti.median", "Médiane")}: {timeToHire?.medianDays ?? "—"}j
              {" · "}{t(locale, "analytics.tti.samples", "Échantillon")}: {timeToHire?.samples ?? 0}
            </p>
          </div>
        </div>

        {/* Turnover detail */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
            {t(locale, "analytics.turnover.title", "Turnover")}
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{t(locale, "analytics.turnover.terminated_12", "Départs (12 mois)")}</span>
              <span className="font-semibold text-[var(--text-primary)]">{turnover?.terminatedLast12Months ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{t(locale, "analytics.headcount.active", "Actifs")}</span>
              <span className="font-semibold text-[var(--text-primary)]">{turnover?.currentHeadcount ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-[var(--border)] pt-3">
              <span className="text-[var(--text-secondary)]">{t(locale, "analytics.turnover.rate", "Taux de turnover")}</span>
              <span className={`font-bold text-lg ${(turnover?.turnoverRatePct ?? 0) > 20 ? "text-red-400" : "text-emerald-400"}`}>
                {turnover?.turnoverRatePct ?? 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon, label, value, accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 px-5 py-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">{icon}</div>
      <p className={`text-2xl font-bold ${accent ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>{value}</p>
      <p className="text-xs text-[var(--text-muted)] leading-tight">{label}</p>
    </div>
  );
}
