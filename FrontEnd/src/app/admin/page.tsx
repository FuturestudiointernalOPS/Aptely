"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/apiHelper";
import { adminStatsApi, adminMetricsApi, adminActivityApi } from "@/lib/routes";
import {
  Users, Building2, FileText, TrendingUp, TrendingDown, BarChart3,
  Briefcase, Activity, UserPlus, Send, CheckCircle2, ShieldAlert,
  Zap, ArrowUpRight, Clock, Target, RefreshCw, Layers,
} from "lucide-react";

interface TrendData { thisWeek: number; pct: number | null }
interface Stats {
  totalUsers: number; totalInstitutions: number; totalApplications: number; totalSuperAdmins: number;
  trends: { users: TrendData; institutions: TrendData; applications: TrendData };
}
interface WeekPoint { week: string; count: number }
interface Metrics {
  activeInstitutions30d: number; repeatHiringInstitutions: number;
  avgTimeToHireDays: number | null; institutionRetentionPct: number | null;
  funnel: { jobPositions: number; applications: number; interviews: number; offers: number; accepted: number };
  weeklyJobPostings: WeekPoint[]; weeklyApplications: WeekPoint[]; weeklyNewUsers: WeekPoint[];
}
interface ActivityEvent { type: string; label: string; at: string }

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data, color = "var(--accent)", height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} className="flex items-center justify-center text-xs text-[var(--text-muted)]">—</div>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={height} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value <= 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span>{display.toLocaleString()}</span>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TrendBadge({ pct, thisWeek }: { pct: number | null; thisWeek: number }) {
  if (pct === null) return <span className="text-[11px] text-[var(--text-muted)]">+{thisWeek} cette sem.</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${up ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

function StatCard({ label, value, icon: Icon, accent, trend, sub }: {
  label: string; value: number; icon: React.ElementType; accent: string; trend?: TrendData; sub?: string;
}) {
  return (
    <div className="group bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--accent)]/30 hover:shadow-lg hover:shadow-[var(--accent)]/5 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </div>
        {trend && <TrendBadge pct={trend.pct} thisWeek={trend.thisWeek} />}
      </div>
      <div className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
        <AnimatedCounter value={value} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{label}</span>
        {sub && <span className="text-[10px] text-[var(--text-muted)]">{sub}</span>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-raised)]" />
        <div className="h-5 w-14 bg-[var(--bg-raised)] rounded" />
      </div>
      <div className="h-8 w-20 bg-[var(--bg-raised)] rounded mb-2" />
      <div className="h-3 w-24 bg-[var(--bg-raised)] rounded" />
    </div>
  );
}

// ─── MiniBar (kept from before) ───────────────────────────────────────────────

function MiniBar({ data, label }: { data: WeekPoint[]; label: string }) {
  if (!data.length) return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5">
      <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      <div className="h-20 flex items-center justify-center text-xs text-[var(--text-muted)] mt-3">Aucune donnée</div>
    </div>
  );
  const max = Math.max(...data.map(d => d.count), 1);
  const last8 = data.slice(-8);
  const values = last8.map(d => d.count);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--accent)]/20 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="text-[10px] text-[var(--text-muted)] font-medium">{total} total</span>
      </div>
      <Sparkline data={values} />
      <div className="flex items-end gap-1 h-16 mt-2">
        {last8.map((d) => {
          const h = Math.max(4, Math.round((d.count / max) * 56));
          const shortDate = d.week.slice(5);
          return (
            <div key={d.week} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full rounded-sm bg-[var(--accent)]/40 group-hover:bg-[var(--accent)] transition-colors" style={{ height: `${h}px` }} />
              <span className="text-[9px] text-[var(--text-muted)]">{shortDate}</span>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[var(--bg-raised)] text-[var(--text-primary)] text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {d.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function FunnelBar({ label, value, max, conv }: { label: string; value: number; max: number; conv?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const convNum = conv ? parseInt(conv) : null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--text-muted)] w-28 shrink-0 font-medium">{label}</span>
      <div className="flex-1 bg-[var(--bg-raised)] rounded-full h-2.5 overflow-hidden">
        <div className="bg-[var(--accent)] h-full rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-[var(--text-primary)] w-12 text-right tabular-nums">{value.toLocaleString()}</span>
      <span className={`text-xs font-semibold w-12 text-right tabular-nums ${
        convNum !== null && convNum >= 35 ? "text-emerald-400" : convNum !== null && convNum >= 15 ? "text-amber-400" : "text-[var(--text-muted)]"
      }`}>{conv ?? `${pct}%`}</span>
    </div>
  );
}

// ─── Activity ─────────────────────────────────────────────────────────────────

const ACTIVITY_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  signup:          { icon: UserPlus,      color: "text-blue-400",   bg: "bg-blue-400/10",   label: "Inscription" },
  job_posted:      { icon: Briefcase,     color: "text-purple-400", bg: "bg-purple-400/10", label: "Fiche" },
  application:     { icon: Send,          color: "text-amber-400",  bg: "bg-amber-400/10",  label: "Candidature" },
  offer_accepted:  { icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Embauche" },
};
const ACTIVITY_TYPES = Object.keys(ACTIVITY_META);

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const filtered = useMemo(() => filter ? events.filter(e => e.type === filter) : events, [events, filter]);
  if (!events.length) return <div className="text-center py-10 text-sm text-[var(--text-muted)]">Aucune activité récente</div>;

  const counts: Record<string, number> = {};
  events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button onClick={() => setFilter(null)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
            filter === null ? "bg-[var(--accent)] text-white shadow-sm" : "bg-[var(--bg-raised)] text-[var(--text-muted)] hover:bg-[var(--bg-raised)]"}`}>
          Tous <span className="opacity-60 ml-0.5">({events.length})</span>
        </button>
        {ACTIVITY_TYPES.map(type => {
          const meta = ACTIVITY_META[type];
          const c = counts[type] || 0;
          return (
            <button key={type} onClick={() => setFilter(filter === type ? null : type)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                filter === type ? "bg-[var(--accent)] text-white shadow-sm" : "bg-[var(--bg-raised)] text-[var(--text-muted)] hover:bg-[var(--bg-raised)]"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.color.replace("text-", "bg-")}`} />
              {meta.label} <span className="opacity-60">({c})</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {filtered.length === 0 ? (
          <div className="text-center py-4 text-xs text-[var(--text-muted)]">Aucun événement pour ce filtre</div>
        ) : filtered.slice(0, 20).map((e, i) => {
          const meta = ACTIVITY_META[e.type] ?? { icon: Activity, color: "text-[var(--text-muted)]", bg: "bg-[var(--bg-raised)]", label: e.type };
          const Icon = meta.icon;
          const ts = new Date(e.at);
          const diff = Math.floor((Date.now() - ts.getTime()) / 60000);
          const relTime = diff < 60 ? `${diff}m` : diff < 1440 ? `${Math.floor(diff / 60)}h` : ts.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          return (
            <div key={i} className="flex items-center gap-3 py-3 group hover:bg-[var(--bg-raised)]/50 -mx-2 px-2 rounded-lg transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-primary)] truncate font-medium">{e.label}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{meta.label}</p>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] shrink-0 font-medium">{relTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PMF Gauge ────────────────────────────────────────────────────────────────

function GaugeRing({ value, max, size = 56, strokeWidth = 5 }: { value: number; max: number; size?: number; strokeWidth?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  let color = "var(--accent)";
  if (pct >= 70) color = "#34d399";
  else if (pct >= 40) color = "#fbbf24";
  else if (pct > 0) color = "#f87171";
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-raised)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-1000" />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="700">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function PMFMetric({ label, value, max, suffix = "", threshold, thresholdLabel }: {
  label: string; value: number; max: number; suffix?: string; threshold: number; thresholdLabel: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const good = pct >= threshold;
  return (
    <div className={`rounded-2xl border p-4 transition-all duration-300 ${good ? "border-emerald-400/20 bg-emerald-400/5" : "border-[var(--border)] bg-[var(--bg-surface)]"}`}>
      <div className="flex items-center gap-3">
        <GaugeRing value={value} max={max} />
        <div>
          <p className="text-lg font-bold text-[var(--text-primary)]">{value}{suffix}</p>
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
          <p className={`text-[10px] font-medium mt-0.5 ${good ? "text-emerald-400" : "text-[var(--text-muted)]"}`}>{thresholdLabel}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "acquisition" | "retention";
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview",    label: "Vue d'ensemble",   icon: Layers },
  { key: "acquisition", label: "Acquisition",      icon: TrendingUp },
  { key: "retention",   label: "Rétention",        icon: RefreshCw },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loadingS, setLoadingS] = useState(true);
  const [loadingM, setLoadingM] = useState(true);
  const [loadingA, setLoadingA] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    apiFetch(adminStatsApi).then(s => { setStats(s as Stats | null); setLoadingS(false); });
    apiFetch(adminMetricsApi).then(m => { setMetrics(m as Metrics | null); setLoadingM(false); });
    apiFetch(adminActivityApi).then(a => { setActivity((a as ActivityEvent[] | null) ?? []); setLoadingA(false); });
  }, []);

  const f = metrics?.funnel;
  const funnelMax = Math.max(f?.jobPositions ?? 0, f?.applications ?? 0, f?.interviews ?? 0, f?.offers ?? 0, 1);
  const appToOffer = f && f.applications > 0 ? Math.round((f.offers / f.applications) * 100) : null;
  const offerToAccept = f && f.offers > 0 ? Math.round((f.accepted / f.offers) * 100) : null;
  const appToInterview = f && f.applications > 0 ? Math.round((f.interviews / f.applications) * 100) : null;
  const interviewToOffer = f && f.interviews > 0 ? Math.round((f.offers / f.interviews) * 100) : null;

  return (
    <div className="min-h-screen">
      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 via-transparent to-purple-400/5 pointer-events-none" />
        <div className="relative px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold mb-1">Admin</p>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Aptely</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">Tableau de bord plateforme</p>
            </div>
            {!loadingM && (
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[var(--accent)]">{metrics?.activeInstitutions30d ?? 0}</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Entreprises actives</p>
                </div>
                <div className="w-px h-10 bg-[var(--border)]" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{f?.accepted ?? 0}</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Embauches</p>
                </div>
                <div className="w-px h-10 bg-[var(--border)]" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{metrics?.repeatHiringInstitutions ?? 0}</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Repeat hiring</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-6 lg:px-8 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                tab === t.key
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}>
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6 lg:p-8 space-y-6">

      {/* ═══ OVERVIEW ═══ */}
      {tab === "overview" && (
      <>
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {loadingS ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />) : (
            <>
              <StatCard label="Utilisateurs"    value={stats?.totalUsers ?? 0}        icon={Users}       accent="bg-blue-400/10 text-blue-400"    trend={stats?.trends.users} />
              <StatCard label="Entreprises"     value={stats?.totalInstitutions ?? 0}  icon={Building2}    accent="bg-purple-400/10 text-purple-400" trend={stats?.trends.institutions} sub={`${metrics?.activeInstitutions30d ?? 0} actives`} />
              <StatCard label="Candidatures"    value={stats?.totalApplications ?? 0}  icon={FileText}     accent="bg-amber-400/10 text-amber-400"   trend={stats?.trends.applications} />
              <StatCard label="Fiches"          value={f?.jobPositions ?? 0}           icon={Briefcase}    accent="bg-emerald-400/10 text-emerald-400" />
              <StatCard label="Super admins"    value={stats?.totalSuperAdmins ?? 0}   icon={ShieldAlert}  accent="bg-rose-400/10 text-rose-400" />
            </>
          )}
        </div>

        {/* PMF Health */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Zap size={16} className="text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Santé PMF</h3>
              <p className="text-xs text-[var(--text-muted)]">Indicateurs clés de product-market fit</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingM ? <div className="col-span-3 text-center py-8 text-sm text-[var(--text-muted)]">Chargement...</div> : (
              <>
                <PMFMetric label="Candidature → Offre" value={appToOffer ?? 0} max={100} suffix="%" threshold={35} thresholdLabel="seuil ≥ 35%" />
                <PMFMetric label="Offre → Accepté" value={offerToAccept ?? 0} max={100} suffix="%" threshold={50} thresholdLabel="seuil ≥ 50%" />
                <PMFMetric label="Repeat hiring" value={metrics?.repeatHiringInstitutions ?? 0} max={10} threshold={3} thresholdLabel="seuil ≥ 3 entreprises" />
                <PMFMetric label="Temps moyen embauche" value={metrics?.avgTimeToHireDays !== null ? Math.max(0, 60 - (metrics?.avgTimeToHireDays ?? 0)) : 0} max={60} suffix="" threshold={39} thresholdLabel={`${metrics?.avgTimeToHireDays ?? "—"}j · seuil ≤ 21j`} />
                <PMFMetric label="Rétention entreprises" value={metrics?.institutionRetentionPct ?? 0} max={100} suffix="%" threshold={70} thresholdLabel="seuil ≥ 70%" />
                <PMFMetric label="Candidature → Entretien" value={appToInterview ?? 0} max={100} suffix="%" threshold={25} thresholdLabel="seuil ≥ 25%" />
              </>
            )}
          </div>
        </div>

        {/* Funnel + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Target size={16} className="text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Funnel de recrutement</h3>
                <p className="text-[10px] text-[var(--text-muted)]">Conversion globale</p>
              </div>
              <span className="ml-auto text-xs font-bold text-[var(--accent)]">
                {f && f.jobPositions > 0 ? `${Math.round((f.accepted / f.jobPositions) * 100)}%` : "—"} end-to-end
              </span>
            </div>
            {loadingM ? <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
              <div className="flex flex-col gap-4">
                <FunnelBar label="Fiches de poste" value={f?.jobPositions ?? 0} max={funnelMax} />
                <FunnelBar label="Candidatures"    value={f?.applications ?? 0} max={funnelMax} conv={f && f.jobPositions > 0 ? `${Math.round((f.applications / f.jobPositions) * 100)}x` : undefined} />
                <FunnelBar label="Entretiens"      value={f?.interviews ?? 0}   max={funnelMax} conv={f && f.applications > 0 ? `${Math.round((f.interviews / f.applications) * 100)}%` : undefined} />
                <FunnelBar label="Offres"          value={f?.offers ?? 0}       max={funnelMax} conv={f && f.interviews > 0 ? `${Math.round((f.offers / f.interviews) * 100)}%` : undefined} />
                <FunnelBar label="Embauches"       value={f?.accepted ?? 0}     max={funnelMax} conv={f && f.offers > 0 ? `${Math.round((f.accepted / f.offers) * 100)}%` : undefined} />
              </div>
            )}
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Activity size={16} className="text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Activité récente</h3>
                <p className="text-[10px] text-[var(--text-muted)]">7 derniers jours</p>
              </div>
            </div>
            {loadingA ? <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : <ActivityFeed events={activity} />}
          </div>
        </div>

        {/* Weekly trends */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {loadingM ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 animate-pulse h-44" />
          )) : (
            <>
              <MiniBar data={metrics?.weeklyJobPostings ?? []}  label="Fiches / semaine" />
              <MiniBar data={metrics?.weeklyApplications ?? []}  label="Candidatures / semaine" />
              <MiniBar data={metrics?.weeklyNewUsers ?? []}      label="Inscriptions / semaine" />
            </>
          )}
        </div>
      </>
      )}

      {/* ═══ ACQUISITION ═══ */}
      {tab === "acquisition" && (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-blue-400/10 flex items-center justify-center">
                <Users size={16} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Croissance utilisateurs</h3>
                <p className="text-[10px] text-[var(--text-muted)]">Nouvelles inscriptions par semaine</p>
              </div>
            </div>
            {loadingM ? <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
              <MiniBar data={metrics?.weeklyNewUsers ?? []} label="" />
            )}
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-purple-400/10 flex items-center justify-center">
                <Building2 size={16} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Acquisition entreprises</h3>
                <p className="text-[10px] text-[var(--text-muted)]">Nouvelles fiches par semaine</p>
              </div>
            </div>
            {loadingM ? <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
              <MiniBar data={metrics?.weeklyJobPostings ?? []} label="" />
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-emerald-400/10 flex items-center justify-center">
              <ArrowUpRight size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Activation — pipeline actuel</h3>
              <p className="text-[10px] text-[var(--text-muted)]">Volume total sur la plateforme</p>
            </div>
          </div>
          {loadingM ? <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="rounded-xl border border-[var(--border)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--accent)]">{f?.jobPositions ?? 0}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Fiches de poste</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{f?.applications ?? 0}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Candidatures</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{f?.interviews ?? 0}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Entretiens</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--text-primary)]">{f?.offers ?? 0}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Offres</p>
              </div>
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{f?.accepted ?? 0}</p>
                <p className="text-xs text-emerald-400/70 mt-1">Embauches</p>
              </div>
            </div>
          )}
        </div>
      </>
      )}

      {/* ═══ RETENTION ═══ */}
      {tab === "retention" && (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-400/10 flex items-center justify-center">
                <RefreshCw size={16} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Rétention entreprises</h3>
            </div>
            {loadingM ? <div className="py-6 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
              <div className="text-center py-4">
                <GaugeRing value={metrics?.institutionRetentionPct ?? 0} max={100} size={80} strokeWidth={6} />
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  {metrics?.institutionRetentionPct !== null && metrics?.institutionRetentionPct !== undefined ? `${metrics.institutionRetentionPct}%` : "—"} des entreprises actives le mois précédent le sont encore ce mois
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Seuil PMF : ≥ 70%</p>
              </div>
            )}
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-400/10 flex items-center justify-center">
                <Target size={16} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Repeat hiring</h3>
            </div>
            {loadingM ? <div className="py-6 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
              <div className="text-center py-4">
                <p className={`text-4xl font-bold ${(metrics?.repeatHiringInstitutions ?? 0) >= 3 ? "text-emerald-400" : (metrics?.repeatHiringInstitutions ?? 0) >= 1 ? "text-amber-400" : "text-[var(--text-primary)]"}`}>
                  {metrics?.repeatHiringInstitutions ?? 0}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-2">Entreprises avec ≥ 2 embauches</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Seuil PMF : ≥ 3</p>
              </div>
            )}
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-400/10 flex items-center justify-center">
                <Clock size={16} className="text-blue-400" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Time-to-hire</h3>
            </div>
            {loadingM ? <div className="py-6 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
              <div className="text-center py-4">
                <p className={`text-4xl font-bold ${metrics?.avgTimeToHireDays !== null && metrics?.avgTimeToHireDays !== undefined && metrics.avgTimeToHireDays <= 21 ? "text-emerald-400" : metrics?.avgTimeToHireDays !== null && metrics?.avgTimeToHireDays !== undefined && metrics.avgTimeToHireDays <= 42 ? "text-amber-400" : "text-[var(--text-primary)]"}`}>
                  {metrics?.avgTimeToHireDays !== null && metrics?.avgTimeToHireDays !== undefined ? `${metrics.avgTimeToHireDays}j` : "—"}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-2">Délai moyen candidature → embauche</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Seuil PMF : ≤ 21j</p>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline overview in retention tab */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
              <BarChart3 size={16} className="text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Pipeline global</h3>
              <p className="text-[10px] text-[var(--text-muted)]">Taux de conversion entre étapes</p>
            </div>
          </div>
          {loadingM ? <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chargement...</div> : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--border)] p-3 text-center">
                <p className="text-lg font-bold text-[var(--text-primary)]">{f && f.jobPositions > 0 ? `${Math.round((f.applications / f.jobPositions) * 100)}x` : "—"}</p>
                <p className="text-[10px] text-[var(--text-muted)]">Candidatures / fiche</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3 text-center">
                <p className={`text-lg font-bold ${(appToInterview ?? 0) >= 25 ? "text-emerald-400" : "text-[var(--text-primary)]"}`}>
                  {f && f.applications > 0 ? `${Math.round((f.interviews / f.applications) * 100)}%` : "—"}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">Candidature → Entretien</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3 text-center">
                <p className={`text-lg font-bold ${(interviewToOffer ?? 0) >= 35 ? "text-emerald-400" : "text-[var(--text-primary)]"}`}>
                  {f && f.interviews > 0 ? `${Math.round((f.offers / f.interviews) * 100)}%` : "—"}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">Entretien → Offre</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3 text-center">
                <p className={`text-lg font-bold ${(offerToAccept ?? 0) >= 50 ? "text-emerald-400" : "text-[var(--text-primary)]"}`}>
                  {f && f.offers > 0 ? `${Math.round((f.accepted / f.offers) * 100)}%` : "—"}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">Offre → Embauche</p>
              </div>
            </div>
          )}
        </div>
      </>
      )}

      </div>
    </div>
  );
}
