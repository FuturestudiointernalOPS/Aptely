"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { useRequireInstitution } from "@/lib/auth";
import {
  ROUTES, goalByIdApi, goalTaskByIdApi, goalPath,
} from "@/lib/routes";
import {
  ArrowLeft, Target, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Users, ListTodo, BarChart2, Loader2, Zap,
} from "lucide-react";

type Tab = "overview" | "roles" | "tasks";

const PACI_COLOR: Record<string, string> = {
  pilote:       "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]",
  approbateur:  "border-sky-400/30 bg-sky-400/10 text-sky-400",
  contributeur: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  informe:      "border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-muted)]",
};

const PACI_LABEL: Record<string, string> = {
  pilote:       "Pilote",
  approbateur:  "Approbateur",
  contributeur: "Contributeur",
  informe:      "Informé",
};

const KR_STATUS_COLOR: Record<string, string> = {
  on_track:  "text-emerald-400",
  at_risk:   "text-amber-400",
  off_track: "text-rose-400",
  completed: "text-sky-400",
};

export default function GoalDetailPage() {
  useRequireInstitution();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = getClientLocale();
  const tr = (k: string, fb: string) => t(locale, k, fb);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale);

  const [goal, setGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [togglingTask, setTogglingTask] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(goalByIdApi(id), "HR") as any;
    setGoal(res?.data ?? res);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleTask = async (taskId: string, current: string) => {
    setTogglingTask(taskId);
    const next = current === "done" ? "todo" : "done";
    await apiFetch(goalTaskByIdApi(id, taskId), "HR", { method: "PATCH", body: JSON.stringify({ status: next }) });
    await load();
    setTogglingTask(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-muted)]">{tr("goal.notFound", "Goal introuvable")}</p>
        <Link href={ROUTES.company.goals} className="mt-4 inline-block text-[var(--accent)] hover:underline">← {tr("goal.back", "Retour aux goals")}</Link>
      </div>
    );
  }

  const krs = goal.key_results ?? [];
  const tasks = goal.goal_tasks ?? [];
  const roles = goal.goal_roles ?? [];
  const progress = goal.progress ?? 0;
  const tasksDone = tasks.filter((t: any) => t.status === "done").length;

  const SCOPE_COLOR: Record<string, string> = {
    company:    "bg-purple-400/10 text-purple-400",
    team:       "bg-blue-400/10 text-blue-400",
    individual: "bg-amber-400/10 text-amber-400",
  };
  const STATUS_COLOR: Record<string, string> = {
    draft:     "bg-amber-400/10 text-amber-400 border-amber-400/30",
    active:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
    completed: "bg-sky-400/10 text-sky-400 border-sky-400/30",
    cancelled: "bg-rose-400/10 text-rose-400 border-rose-400/30",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <Link href={ROUTES.company.goals} className="flex items-center gap-2 text-[var(--accent)] text-sm font-semibold hover:underline">
          <ArrowLeft className="w-4 h-4" /> {tr("goal.back", "Goals & OKRs")}
        </Link>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SCOPE_COLOR[goal.scope]}`}>
            {tr(`goals.scope.${goal.scope}`, goal.scope)}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR[goal.status]}`}>
            {tr(`goals.status.${goal.status}`, goal.status)}
          </span>
        </div>
      </div>

      {/* Title + objective */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 animate-fade-in-up">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{goal.name}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{goal.objective}</p>
            {(goal.start_date || goal.due_date) && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {goal.start_date && goal.due_date ? `${fmtDate(goal.start_date)} → ${fmtDate(goal.due_date)}` : fmtDate(goal.due_date ?? goal.start_date)}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--text-muted)] font-semibold">{tr("goal.progress", "Progression")}</span>
            <span className={`font-bold ${progress >= 80 ? "text-emerald-400" : progress >= 40 ? "text-amber-400" : "text-[var(--text-muted)]"}`}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-raised)]">
            <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--accent)]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">KRs</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{krs.length}</p>
          </div>
        </div>
        <div className="hidden sm:block w-px h-8 bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-sky-400" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("goal.tasks", "Tâches")}</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{tasksDone}/{tasks.length}</p>
          </div>
        </div>
        <div className="hidden sm:block w-px h-8 bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("goal.members", "Membres")}</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{goal.goal_commitments?.length ?? 0}/{roles.length}</p>
          </div>
        </div>
        {goal.session_code && (
          <>
            <div className="hidden sm:block w-px h-8 bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Session</p>
                <p className="font-mono text-sm font-bold text-[var(--accent)]">{goal.session_code}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(["overview","roles","tasks"] as Tab[]).map(tabKey => (
          <button key={tabKey} type="button" onClick={() => setTab(tabKey)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors ${tab === tabKey ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
            {tabKey === "overview" ? tr("goal.tab.overview", "Vue d'ensemble") : tabKey === "roles" ? tr("goal.tab.roles", "PACI") : tr("goal.tab.tasks", "Tâches")}
          </button>
        ))}
      </div>

      {/* TAB: Overview — KRs */}
      {tab === "overview" && (
        <div className="space-y-4 animate-fade-in-up">
          {krs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">{tr("goal.noKRs", "Aucun KR défini")}</p>
          ) : krs.map((kr: any, i: number) => (
            <div key={kr.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{kr.description}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[var(--text-muted)]">{kr.kpi}</span>
                    {kr.target_value && <span className="text-xs font-bold text-[var(--accent)] px-2 py-0.5 rounded-full bg-[var(--accent-dim)]">{kr.current_value ? `${kr.current_value} / ` : ""}{kr.target_value}</span>}
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase ${KR_STATUS_COLOR[kr.status] ?? "text-[var(--text-muted)]"}`}>{tr(`goals.kr.status.${kr.status}`, kr.status?.replace("_", " ") ?? "")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: Roles */}
      {tab === "roles" && (
        <div className="space-y-3 animate-fade-in-up">
          {roles.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">{tr("goal.noRoles", "Aucun rôle assigné")}</p>
          ) : (["pilote","approbateur","contributeur","informe"] as const).map(role => {
            const group = roles.filter((r: any) => r.role === role);
            if (!group.length) return null;
            return (
              <div key={role} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">{PACI_LABEL[role]}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.map((ra: any) => (
                    <div key={ra.id} className={`flex items-center gap-3 rounded-xl border p-3 ${PACI_COLOR[role]}`}>
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(ra.profiles?.full_name || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{ra.profiles?.full_name || "?"}</p>
                        {ra.focus_area && <p className="text-[10px] opacity-70">{ra.focus_area}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB: Tasks */}
      {tab === "tasks" && (
        <div className="space-y-2 animate-fade-in-up">
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">{tr("goal.noTasks", "Aucune tâche")}</p>
          ) : tasks.map((task: any) => {
            const kr = krs.find((k: any) => k.id === task.key_result_id);
            const done = task.status === "done";
            return (
              <div key={task.id} className={`flex items-center gap-3 rounded-xl border bg-[var(--bg-surface)] p-4 transition-all ${done ? "border-emerald-400/20 opacity-70" : "border-[var(--border)]"}`}>
                <button onClick={() => toggleTask(task.id, task.status)} disabled={togglingTask === task.id}
                  className={`flex-shrink-0 w-5 h-5 rounded border transition-all ${done ? "border-emerald-400 bg-emerald-400 text-white" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
                  {togglingTask === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3 opacity-0" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>{task.title}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    {task.profiles?.full_name && <span className="text-[10px] text-[var(--text-muted)]">{task.profiles.full_name}</span>}
                    {kr && <span className="text-[10px] font-bold text-[var(--accent)] px-1.5 py-0.5 rounded bg-[var(--accent-dim)]">KR{krs.indexOf(kr)+1}</span>}
                    {task.due_date && <span className="text-[10px] text-[var(--text-muted)]">{fmtDate(task.due_date)}</span>}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${done ? "bg-emerald-400/10 text-emerald-400" : task.status === "in_progress" ? "bg-sky-400/10 text-sky-400" : "bg-[var(--bg-raised)] text-[var(--text-muted)]"}`}>
                  {done ? tr("task.done", "Terminé") : task.status === "in_progress" ? tr("task.wip", "En cours") : tr("task.todo", "À faire")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
