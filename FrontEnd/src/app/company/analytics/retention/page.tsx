"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { useRequireInstitution } from "@/lib/auth";
import { retentionDashboardApi, retentionComputeApi, retentionEmployeeApi } from "@/lib/routes";
import { AlertTriangle, TrendingDown, Users, RefreshCw, Loader2, ChevronRight, ChevronDown } from "lucide-react";

interface RiskEmployee {
  employee_user_id: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  flags: string[];
  computed_at: string;
  profiles: { id: string; full_name: string; email: string; avatar_url: string | null } | null;
}

interface RetentionSignal {
  signal_date: string;
  perf_trend: number | null;
  goal_alignment_score: number | null;
  ld_inactive_days: number | null;
  comp_gap_pct: number | null;
  tenure_months: number | null;
  peer_departures: number | null;
  feedback_sentiment: number | null;
}

const SIGNAL_FIELDS: (keyof RetentionSignal)[] = [
  "perf_trend", "goal_alignment_score", "ld_inactive_days",
  "comp_gap_pct", "tenure_months", "peer_departures", "feedback_sentiment",
];

const LEVEL_STYLE = {
  HIGH:   { bg: "bg-rose-400/10 border-rose-400/30 text-rose-400", dot: "bg-rose-400" },
  MEDIUM: { bg: "bg-amber-400/10 border-amber-400/30 text-amber-400", dot: "bg-amber-400" },
  LOW:    { bg: "bg-emerald-400/10 border-emerald-400/30 text-emerald-400", dot: "bg-emerald-400" },
};

const FLAG_LABELS: Record<string, string> = {
  perf_decline:     "Perf en baisse",
  goal_misaligned:  "Goals non alignés",
  ld_inactive:      "L&D inactif 60j+",
  comp_gap:         "Écart salarial",
  peer_departures:  "Départs collègues",
  negative_feedback:"Feedback négatif",
};

export default function RetentionDashboardPage() {
  useRequireInstitution();
  const locale = getClientLocale();
  const tr = (k: string, fb: string, params?: Record<string, string | number>) => t(locale, k, fb, params);

  const [employees, setEmployees] = useState<RiskEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [lastComputed, setLastComputed] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [signalsById, setSignalsById] = useState<Record<string, RetentionSignal[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch(retentionDashboardApi, "HR") as any;
    const list = Array.isArray(res) ? res : res?.data ?? [];
    setEmployees(list);
    if (list.length > 0) setLastComputed(list[0].computed_at);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCompute = async () => {
    setComputing(true);
    await apiFetch(retentionComputeApi, "HR", { method: "POST" });
    await load();
    setComputing(false);
  };

  const toggleExpand = async (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    if (!signalsById[userId]) {
      setLoadingDetail(userId);
      const res = await apiFetch(retentionEmployeeApi(userId), "HR") as any;
      const signals = res?.signals ?? res?.data?.signals ?? [];
      setSignalsById(prev => ({ ...prev, [userId]: signals }));
      setLoadingDetail(null);
    }
  };

  const high   = employees.filter(e => e.level === "HIGH").length;
  const medium = employees.filter(e => e.level === "MEDIUM").length;
  const low    = employees.filter(e => e.level === "LOW").length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-400/10 border border-rose-400/20 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{tr("retention.title", "Risque de départ")}</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {lastComputed
                ? tr("retention.lastComputed", "Calculé le") + " " + new Date(lastComputed).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")
                : tr("retention.neverComputed", "Jamais calculé")}
            </p>
          </div>
        </div>
        <button onClick={handleCompute} disabled={computing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
          {computing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {tr("retention.compute", "Recalculer")}
        </button>
      </div>

      {/* Stats strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {[
          { count: high,   level: "HIGH",   icon: AlertTriangle, color: "text-rose-400",    key: "high" },
          { count: medium, level: "MEDIUM", icon: AlertTriangle, color: "text-amber-400",   key: "medium" },
          { count: low,    level: "LOW",    icon: Users,         color: "text-emerald-400", key: "low" },
        ].map(({ count, level, icon: Icon, color, key }, i) => (
          <div key={level} className={`flex items-center gap-3 ${i < 2 ? "sm:pr-6 sm:border-r border-[var(--border)]" : ""}`}>
            <Icon className={`w-5 h-5 ${color}`} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr(`retention.stat.${key}`, `Risque ${level}`)}</p>
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
            </div>
          </div>
        ))}
        <div className="ml-auto text-xs text-[var(--text-muted)]">
          {tr("retention.employees", "{{count}} employés analysés", { count: employees.length })}
        </div>
      </div>

      {/* Employee risk list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin" />
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Users className="w-12 h-12 text-[var(--text-muted)]" style={{ opacity: 0.3 }} />
          <p className="text-[var(--text-primary)] font-bold">{tr("retention.empty", "Aucune donnée")}</p>
          <p className="text-sm text-[var(--text-muted)]">{tr("retention.emptyHint", "Cliquez «Recalculer» pour analyser les risques")}</p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in-up">
          {employees.map(emp => {
            const style = LEVEL_STYLE[emp.level];
            const name = emp.profiles?.full_name || emp.profiles?.email || emp.employee_user_id.slice(0, 8);
            const isExpanded = expandedId === emp.employee_user_id;
            return (
              <div key={emp.employee_user_id}
                className={`rounded-2xl bg-[var(--bg-surface)] border transition-all ${isExpanded ? "border-[var(--accent)]/30" : "border-[var(--border)] hover:border-[var(--accent)]/30"}`}>
              <button type="button" onClick={() => toggleExpand(emp.employee_user_id)} aria-expanded={isExpanded}
                className="w-full flex items-center gap-4 p-4 text-left group cursor-pointer">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)] flex-shrink-0">
                  {name.slice(0, 2).toUpperCase()}
                </div>

                {/* Name + flags */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {emp.flags.map(f => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)]">
                        {tr(`retention.flag.${f}`, FLAG_LABELS[f] ?? f)}
                      </span>
                    ))}
                    {emp.flags.length === 0 && (
                      <span className="text-[10px] text-[var(--text-muted)]">{tr("retention.noFlags", "Aucun signal")}</span>
                    )}
                  </div>
                </div>

                {/* Score gauge */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-20">
                    <div className="h-1.5 rounded-full bg-[var(--bg-raised)]">
                      <div className={`h-full rounded-full transition-all ${emp.level === "HIGH" ? "bg-rose-400" : emp.level === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${emp.score}%` }} />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] text-right mt-0.5">{emp.score}/100</p>
                  </div>

                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${style.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${emp.level === "HIGH" ? "animate-pulse" : ""}`} />
                    {tr(`retention.badge.${emp.level.toLowerCase()}`, emp.level)}
                  </span>
                </div>

                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-[var(--accent)] transition-colors flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 animate-fade-in-up">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{tr("retention.detail.title", "Détail des signaux")}</p>
                  {loadingDetail === emp.employee_user_id ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
                    </div>
                  ) : !signalsById[emp.employee_user_id]?.length ? (
                    <p className="text-sm text-[var(--text-muted)] py-2">{tr("retention.detail.empty", "Aucun signal enregistré pour cet employé")}</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {SIGNAL_FIELDS.map(field => (
                        <div key={field} className="bg-[var(--bg-raised)] rounded-xl px-3 py-2">
                          <p className="text-[10px] text-[var(--text-muted)]">{tr(`retention.signal.${field}`, field)}</p>
                          <p className="text-sm font-bold text-[var(--text-primary)]">{signalsById[emp.employee_user_id][0][field] ?? "—"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
