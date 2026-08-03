"use client";

import { useEffect, useState } from "react";
import {
  BookOpen, CheckCircle2, Clock, Zap, AlertCircle,
  ExternalLink, Loader2, Award, Users, FileText, Code2
} from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { learningMyPlanApi, learningMyActivityApi } from "@/lib/routes";
import { useAuth } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";

interface Activity {
  id: string;
  title: string;
  description: string | null;
  type: string;
  provider: string | null;
  url: string | null;
  estimated_hours: number | null;
  status: "assigned" | "in_progress" | "completed" | "skipped";
  due_date: string | null;
  completed_at: string | null;
  skill_tags: string[];
  sort_order: number;
}

interface LearningPlan {
  id: string;
  title: string;
  status: string;
  employee_user_id: string;
  learning_activities: Activity[];
}

const STATUS_STYLE = {
  assigned:    { color: "bg-[var(--bg-raised)] text-[var(--text-muted)]",  icon: Clock },
  in_progress: { color: "bg-blue-500/15 text-blue-400",                    icon: Zap },
  completed:   { color: "bg-emerald-500/15 text-emerald-400",               icon: CheckCircle2 },
  skipped:     { color: "bg-[var(--bg-raised)] text-[var(--text-muted)]",  icon: AlertCircle },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  course: BookOpen, book: FileText, mentor: Users,
  project: Code2, certification: Award, other: Zap,
};

export default function CandidateLearningPage() {
  const { user } = useAuth();
  const locale = getClientLocale();
  const tr = (k: string, fb: string, params?: Record<string, string | number>) => t(locale, k, fb, params);
  const statusLabel = (s: string) => tr(`learning.status.${s}`, s);
  const typeLabel = (ty: string) => tr(`learning.type.${ty}`, ty);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const raw = await apiFetch(learningMyPlanApi, "HR") as any;
    const myPlan: LearningPlan | null = raw?.data ?? raw ?? null;
    setPlan(myPlan);
    setLoading(false);
  };

  useEffect(() => { if (user?.userId) load(); }, [user?.userId]);

  const handleStatusToggle = async (act: Activity) => {
    if (!plan) return;
    const nextStatus = act.status === "completed" ? "in_progress"
      : act.status === "in_progress" ? "completed"
      : act.status === "assigned" ? "in_progress" : "in_progress";

    setUpdating(act.id);
    await apiFetch(learningMyActivityApi(act.id), "HR", {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    await load();
    setUpdating(null);
  };

  const activities = plan?.learning_activities ?? [];
  const done = activities.filter(a => a.status === "completed").length;
  const completionPct = activities.length > 0 ? Math.round((done / activities.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{tr("learning.candidateTitle", "Mon plan de développement")}</h1>
          <p className="text-xs text-[var(--text-muted)]">{tr("learning.candidateSubtitle", "Activités assignées par votre équipe RH")}</p>
        </div>
      </div>

      {!plan ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <BookOpen className="w-14 h-14 text-[var(--text-muted)]" style={{ opacity: 0.2 }} />
          <div className="text-center">
            <p className="font-bold text-[var(--text-primary)]">{tr("learning.noPlanCandidate", "Aucun plan actif")}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{tr("learning.noPlanCandidateHint", "Votre équipe RH n'a pas encore créé de plan L&D")}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{plan.title}</span>
              <span className="text-sm font-bold text-[var(--accent)]">{done}/{activities.length}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-raised)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">{tr("learning.completedPct", "{{pct}}% complété", { pct: completionPct })}</p>
          </div>

          {/* Activity stats strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: tr("learning.statTodo", "À faire"), count: activities.filter(a => a.status === "assigned").length, color: "text-[var(--text-muted)]" },
              { label: tr("learning.statInProgress", "En cours"), count: activities.filter(a => a.status === "in_progress").length, color: "text-blue-400" },
              { label: tr("learning.statCompleted", "Complétés"), count: done, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-4 py-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Activities */}
          {activities.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">{tr("learning.noActivitiesAssigned", "Aucune activité assignée")}</p>
          ) : (
            <div className="space-y-3">
              {["in_progress", "assigned", "completed", "skipped"].map(statusGroup => {
                const group = activities.filter(a => a.status === statusGroup);
                if (!group.length) return null;
                const cfg = STATUS_STYLE[statusGroup as keyof typeof STATUS_STYLE];
                const GroupIcon = cfg.icon;
                return (
                  <div key={statusGroup}>
                    <div className="flex items-center gap-2 mb-2">
                      <GroupIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{statusLabel(statusGroup)}</span>
                    </div>
                    <div className="space-y-2">
                      {group.sort((a, b) => a.sort_order - b.sort_order).map(act => {
                        const Icon = TYPE_ICONS[act.type] ?? BookOpen;
                        const isCompleted = act.status === "completed";
                        return (
                          <div key={act.id}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isCompleted ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[var(--bg-surface)] border-[var(--border)]"}`}>
                            <button
                              onClick={() => handleStatusToggle(act)}
                              disabled={updating === act.id}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                                isCompleted
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:bg-[var(--accent-dim)] hover:text-[var(--accent)]"
                              }`}
                            >
                              {updating === act.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : isCompleted
                                  ? <CheckCircle2 className="w-4 h-4" />
                                  : <Icon className="w-4 h-4" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${isCompleted ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                                {act.title}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-xs text-[var(--text-muted)]">{typeLabel(act.type)}</span>
                                {act.provider && <span className="text-xs text-[var(--text-muted)]">· {act.provider}</span>}
                                {act.estimated_hours && (
                                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />{act.estimated_hours}h
                                  </span>
                                )}
                                {act.due_date && !isCompleted && (
                                  <span className="text-xs text-amber-400">
                                    {tr("learning.dueDateShort", "Échéance {{date}}", { date: new Date(act.due_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US") })}
                                  </span>
                                )}
                                {act.completed_at && (
                                  <span className="text-xs text-emerald-400">
                                    ✓ {new Date(act.completed_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                                  </span>
                                )}
                              </div>
                            </div>
                            {act.url && (
                              <a href={act.url} target="_blank" rel="noopener noreferrer"
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors flex-shrink-0">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
