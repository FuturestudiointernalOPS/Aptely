"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Clock,
  FileText,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { adminMetricsApi } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

interface WeekPoint {
  week: string;
  count: number;
}

interface Metrics {
  activeInstitutions30d: number;
  repeatHiringInstitutions: number;
  avgTimeToHireDays: number | null;
  institutionRetentionPct: number | null;
  funnel: {
    jobPositions: number;
    applications: number;
    interviews: number;
    offers: number;
    accepted: number;
  };
  weeklyJobPostings: WeekPoint[];
  weeklyApplications: WeekPoint[];
  weeklyNewUsers: WeekPoint[];
}

function MiniBar({ data, label }: { data: WeekPoint[]; label: string }) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  if (!data.length) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <div className="h-20 flex items-center justify-center text-xs text-[var(--text-muted)] mt-3">
          {tr("admin.dashboard.noData", "Aucune donnée")}
        </div>
      </div>
    );
  }
  const last8 = data.slice(-8);
  const max = Math.max(...last8.map((d) => d.count), 1);
  const total = last8.reduce((a, b) => a + b.count, 0);
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="text-[10px] text-[var(--text-muted)] font-medium">
          {total} {tr("admin.dashboard.total", "total")}
        </span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {last8.map((d) => {
          const h = Math.max(4, Math.round((d.count / max) * 56));
          return (
            <div key={d.week} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-[var(--accent)]/50"
                style={{ height: `${h}px` }}
                title={`${d.week}: ${d.count}`}
              />
              <span className="text-[9px] text-[var(--text-muted)]">{d.week.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  max,
  conv,
}: {
  label: string;
  value: number;
  max: number;
  conv?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--text-muted)] w-28 shrink-0 font-medium">{label}</span>
      <div className="flex-1 bg-[var(--bg-raised)] rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-[var(--accent)] h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold text-[var(--text-primary)] w-12 text-right tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-[var(--text-muted)] w-12 text-right tabular-nums">
        {conv ?? `${pct}%`}
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  hint?: string;
}) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center">
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</p>
      <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider mt-1">
        {label}
      </p>
      {hint && <p className="text-[10px] text-[var(--text-muted)] mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminMetricsPage() {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(adminMetricsApi).then((m) => {
      setMetrics(m as Metrics | null);
      setLoading(false);
    });
  }, []);

  const f = metrics?.funnel;
  const funnelMax = Math.max(
    f?.jobPositions ?? 0,
    f?.applications ?? 0,
    f?.interviews ?? 0,
    f?.offers ?? 0,
    1,
  );

  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 lg:px-8 py-6">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1">
          {tr("admin.metrics.kicker", "Admin")}
        </p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          {tr("admin.metrics.title", "Métriques plateforme")}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {tr(
            "admin.metrics.subtitle",
            "Funnel, activité hebdo et indicateurs PMF (GET /admin/metrics).",
          )}
        </p>
      </div>

      <div className="p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">
            {tr("admin.dashboard.loading", "Chargement...")}
          </div>
        ) : !metrics ? (
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">
            {tr("admin.metrics.unavailable", "Métriques indisponibles.")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label={tr("admin.dashboard.activeInstitutions", "Entreprises actives")}
                value={String(metrics.activeInstitutions30d)}
                icon={Building2}
                hint={tr("admin.metrics.last30d", "30 derniers jours")}
              />
              <KpiCard
                label={tr("admin.dashboard.repeatHiring", "Réembauche")}
                value={String(metrics.repeatHiringInstitutions)}
                icon={RefreshCw}
                hint={tr("admin.dashboard.institutionsWith2Hires", "Entreprises avec ≥ 2 embauches")}
              />
              <KpiCard
                label={tr("admin.dashboard.timeToHire", "Délai d'embauche")}
                value={
                  metrics.avgTimeToHireDays != null
                    ? `${metrics.avgTimeToHireDays}${locale === "en" ? "d" : "j"}`
                    : "—"
                }
                icon={Clock}
                hint={tr("admin.dashboard.pmfThreshold21", "Seuil PMF : ≤ 21j")}
              />
              <KpiCard
                label={tr("admin.dashboard.institutionRetention", "Rétention entreprises")}
                value={
                  metrics.institutionRetentionPct != null
                    ? `${metrics.institutionRetentionPct}%`
                    : "—"
                }
                icon={Users}
                hint={tr("admin.dashboard.pmfThreshold70", "Seuil PMF : ≥ 70%")}
              />
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                  <Target size={16} className="text-[var(--accent)]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    {tr("admin.dashboard.funnelTitle", "Funnel de recrutement")}
                  </h2>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {tr("admin.dashboard.funnelSubtitle", "Conversion globale")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <FunnelRow
                  label={tr("admin.dashboard.funnelJobPositions", "Fiches de poste")}
                  value={f?.jobPositions ?? 0}
                  max={funnelMax}
                />
                <FunnelRow
                  label={tr("admin.dashboard.funnelApplications", "Candidatures")}
                  value={f?.applications ?? 0}
                  max={funnelMax}
                />
                <FunnelRow
                  label={tr("admin.dashboard.funnelInterviews", "Entretiens")}
                  value={f?.interviews ?? 0}
                  max={funnelMax}
                  conv={
                    f && f.applications > 0
                      ? `${Math.round((f.interviews / f.applications) * 100)}%`
                      : undefined
                  }
                />
                <FunnelRow
                  label={tr("admin.dashboard.funnelOffers", "Offres")}
                  value={f?.offers ?? 0}
                  max={funnelMax}
                  conv={
                    f && f.interviews > 0
                      ? `${Math.round((f.offers / f.interviews) * 100)}%`
                      : undefined
                  }
                />
                <FunnelRow
                  label={tr("admin.dashboard.hires", "Embauches")}
                  value={f?.accepted ?? 0}
                  max={funnelMax}
                  conv={
                    f && f.offers > 0
                      ? `${Math.round((f.accepted / f.offers) * 100)}%`
                      : undefined
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MiniBar
                data={metrics.weeklyJobPostings}
                label={tr("admin.dashboard.weeklyJobPostings", "Fiches / semaine")}
              />
              <MiniBar
                data={metrics.weeklyApplications}
                label={tr("admin.dashboard.weeklyApplications", "Candidatures / semaine")}
              />
              <MiniBar
                data={metrics.weeklyNewUsers}
                label={tr("admin.dashboard.weeklyNewUsers", "Inscriptions / semaine")}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <BarChart3 size={14} />
              <FileText size={14} />
              <span>
                {tr(
                  "admin.metrics.footnote",
                  "Même source que l’onglet Vue d’ensemble — page dédiée pour deep-links / nav.",
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
