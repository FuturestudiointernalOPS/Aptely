"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { useRequireInstitution } from "@/lib/auth";
import { Target, Plus, CheckCircle2, Clock, XCircle, ChevronRight } from "lucide-react";
import { ROUTES, goalsApi, goalPath } from "@/lib/routes";

interface Goal {
  id: string;
  name: string;
  objective: string;
  scope: "company" | "team" | "individual";
  status: "draft" | "active" | "completed" | "cancelled";
  start_date: string | null;
  due_date: string | null;
  owner_user_id: string | null;
  profiles?: { id: string; full_name: string; avatar_url: string | null } | null;
}

const SCOPE_TABS = ["all", "company", "team", "individual"] as const;
type ScopeTab = typeof SCOPE_TABS[number];

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-amber-400/10 text-amber-400 border-amber-400/30",
  active:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  completed: "bg-sky-400/10 text-sky-400 border-sky-400/30",
  cancelled: "bg-rose-400/10 text-rose-400 border-rose-400/30",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "active")    return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === "cancelled") return <XCircle className="w-3.5 h-3.5" />;
  return <Clock className="w-3.5 h-3.5" />;
}

export default function GoalsPage() {
  useRequireInstitution();
  const locale = getClientLocale();
  const tr = (k: string, fb: string) => t(locale, k, fb);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ScopeTab>("all");

  useEffect(() => {
    setLoading(true);
    apiFetch(goalsApi, "HR").then((res: any) => {
      setGoals(Array.isArray(res) ? res : res?.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return goals;
    return goals.filter(g => g.scope === tab);
  }, [goals, tab]);

  const counts = useMemo(() => ({
    all: goals.length,
    company: goals.filter(g => g.scope === "company").length,
    team: goals.filter(g => g.scope === "team").length,
    individual: goals.filter(g => g.scope === "individual").length,
  }), [goals]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center">
            <Target className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{tr("goals.title", "Goals & OKRs")}</h1>
            <p className="text-xs text-[var(--text-muted)]">{tr("goals.subtitle", "Objectifs, key results et engagement collectif")}</p>
          </div>
        </div>
        <Link href={ROUTES.company.goalsCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          {tr("goals.new", "Nouveau goal")}
        </Link>
      </div>

      {/* Scope tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {SCOPE_TABS.map(s => (
          <button key={s} type="button" onClick={() => setTab(s)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors capitalize flex items-center gap-1.5 ${
              tab === s ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}>
            {tr(`goals.scope.${s}`, s === "all" ? "Tous" : s === "company" ? "Entreprise" : s === "team" ? "Équipe" : "Individuel")}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg-raised)] text-[var(--text-muted)]">
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Goal list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
            <Target className="w-7 h-7 text-[var(--text-muted)]" style={{ opacity: 0.4 }} />
          </div>
          <p className="text-[var(--text-primary)] font-bold">{tr("goals.empty", "Aucun goal")}</p>
          <Link href={ROUTES.company.goalsCreate}
            className="px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-sm font-semibold hover:bg-[var(--accent)] hover:text-white transition-all">
            + {tr("goals.new", "Nouveau goal")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in-up">
          {filtered.map(goal => (
            <Link key={goal.id} href={goalPath(goal.id)}
              className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-raised)] transition-all group">
              {/* Scope badge */}
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg flex-shrink-0 ${
                goal.scope === "company" ? "bg-purple-400/10 text-purple-400" :
                goal.scope === "team" ? "bg-blue-400/10 text-blue-400" :
                "bg-amber-400/10 text-amber-400"
              }`}>
                {tr(`goals.scope.${goal.scope}`, goal.scope)}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[var(--text-primary)] font-semibold text-sm truncate">{goal.name}</p>
                <p className="text-[var(--text-muted)] text-xs truncate mt-0.5">{goal.objective}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {goal.profiles?.full_name && (
                    <span className="text-[10px] text-[var(--text-muted)]">{goal.profiles.full_name}</span>
                  )}
                  {goal.due_date && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {tr("goals.due", "Échéance")} {new Date(goal.due_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${STATUS_STYLE[goal.status] ?? STATUS_STYLE.draft}`}>
                <StatusIcon status={goal.status} />
                {tr(`goals.status.${goal.status}`, goal.status)}
              </span>

              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
