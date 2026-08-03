"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen, Plus, CheckCircle2, Clock, AlertCircle, Loader2,
  Trash2, ExternalLink, ChevronDown, ChevronUp, Sparkles, TrendingUp,
  Code2, Users, FileText, Award, Zap
} from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import {
  learningPlanApi, learningPlansApi, learningActivitiesApi, learningActivityApi,
  learningSkillGapsApi, learningSkillGapsComputeApi, withParams
} from "@/lib/routes";
import { useRequireInstitution } from "@/lib/auth";
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

interface SkillGap {
  id: string;
  skill_name: string;
  current_level: number;
  required_level: number;
  gap_priority: "LOW" | "MEDIUM" | "HIGH";
}

const STATUS_STYLE = {
  assigned:    { color: "bg-[var(--bg-raised)] text-[var(--text-muted)]", icon: Clock },
  in_progress: { color: "bg-blue-500/15 text-blue-400",                   icon: Zap },
  completed:   { color: "bg-emerald-500/15 text-emerald-400",              icon: CheckCircle2 },
  skipped:     { color: "bg-[var(--bg-raised)] text-[var(--text-muted)]", icon: AlertCircle },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  course: BookOpen, book: FileText, mentor: Users,
  project: Code2, certification: Award, other: Zap,
};

const PRIORITY_COLOR = {
  HIGH:   "bg-rose-500/15 text-rose-400",
  MEDIUM: "bg-amber-500/15 text-amber-400",
  LOW:    "bg-emerald-500/15 text-emerald-400",
};

export default function EmployeeLearningPage() {
  useRequireInstitution();
  const { userId } = useParams<{ userId: string }>();
  const locale = getClientLocale();
  const tr = (k: string, fb: string, params?: Record<string, string | number>) => t(locale, k, fb, params);
  const statusLabel = (s: string) => tr(`learning.status.${s}`, s);
  const typeLabel = (ty: string) => tr(`learning.type.${ty}`, ty);

  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [computingGaps, setComputingGaps] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGaps, setShowGaps] = useState(true);
  const [newActivity, setNewActivity] = useState({
    title: "", type: "course" as string, provider: "", url: "",
    estimated_hours: "", due_date: "", description: "",
  });

  const load = async () => {
    setLoading(true);
    const [plansRaw, gapsRaw] = await Promise.all([
      apiFetch(withParams(learningPlansApi, `employee_user_id=${userId}`), "HR") as Promise<any>,
      apiFetch(learningSkillGapsApi(userId), "HR") as Promise<any>,
    ]);

    // Find plan for this employee
    const allPlans: LearningPlan[] = (Array.isArray(plansRaw) ? plansRaw : plansRaw?.data ?? []);
    const emp = allPlans.find(p => p.employee_user_id === userId);
    setPlan(emp ?? null);
    setGaps(Array.isArray(gapsRaw) ? gapsRaw : gapsRaw?.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const handleCreatePlan = async () => {
    setCreatingPlan(true);
    const res = await apiFetch(learningPlansApi, "HR", {
      method: "POST",
      body: JSON.stringify({ employee_user_id: userId }),
    }) as any;
    if (res?.data || res?.id) {
      await load();
    }
    setCreatingPlan(false);
  };

  const handleAddActivity = async () => {
    if (!plan || !newActivity.title) return;
    await apiFetch(learningActivitiesApi(plan.id), "HR", {
      method: "POST",
      body: JSON.stringify({
        title: newActivity.title,
        type: newActivity.type,
        provider: newActivity.provider || undefined,
        url: newActivity.url || undefined,
        estimated_hours: newActivity.estimated_hours ? parseInt(newActivity.estimated_hours) : undefined,
        due_date: newActivity.due_date || undefined,
        description: newActivity.description || undefined,
      }),
    });
    setNewActivity({ title: "", type: "course", provider: "", url: "", estimated_hours: "", due_date: "", description: "" });
    setShowAddForm(false);
    await load();
  };

  const handleStatusChange = async (actId: string, status: string) => {
    if (!plan) return;
    await apiFetch(learningActivityApi(plan.id, actId), "HR", {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const handleDelete = async (actId: string) => {
    if (!plan) return;
    await apiFetch(learningActivityApi(plan.id, actId), "HR", { method: "DELETE" });
    await load();
  };

  const handleComputeGaps = async () => {
    setComputingGaps(true);
    await apiFetch(learningSkillGapsComputeApi(userId), "HR", { method: "POST" });
    const gapsRaw = await apiFetch(learningSkillGapsApi(userId), "HR") as any;
    setGaps(Array.isArray(gapsRaw) ? gapsRaw : gapsRaw?.data ?? []);
    setComputingGaps(false);
  };

  const activities = plan?.learning_activities ?? [];
  const done = activities.filter(a => a.status === "completed").length;
  const completionPct = activities.length > 0 ? Math.round((done / activities.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{tr("learning.title", "Learning & Development")}</h2>
            <p className="text-xs text-[var(--text-muted)]">{tr("learning.subtitle", "Plan de développement des compétences")}</p>
          </div>
        </div>
        {plan && (
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            {tr("learning.addActivity", "Ajouter une activité")}
          </button>
        )}
      </div>

      {/* Skill Gaps */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4"
          onClick={() => setShowGaps(!showGaps)}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {tr("learning.skillGaps", "Écarts de compétences ({{count}})", { count: gaps.length })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={e => { e.stopPropagation(); handleComputeGaps(); }}
              disabled={computingGaps}
              className="text-xs px-3 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {computingGaps ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {tr("learning.computeGaps", "Calculer depuis Talent DNA")}
            </button>
            {showGaps ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </div>
        </button>
        {showGaps && (
          <div className="px-5 pb-4 border-t border-[var(--border)]">
            {gaps.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4 text-center">{tr("learning.noGaps", "Aucun écart détecté — cliquez «Calculer» pour analyser")}</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-4">
                {gaps.map(g => (
                  <span key={g.id} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${PRIORITY_COLOR[g.gap_priority]}`}>
                    {g.skill_name}
                    <span className="opacity-60">{g.current_level}→{g.required_level}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* No plan state */}
      {!plan && (
        <div className="flex flex-col items-center gap-4 py-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl">
          <BookOpen className="w-12 h-12 text-[var(--text-muted)]" style={{ opacity: 0.3 }} />
          <div className="text-center">
            <p className="font-bold text-[var(--text-primary)]">{tr("learning.noPlan", "Aucun plan L&D")}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{tr("learning.noPlanHint", "Créez un plan pour structurer le développement de cet employé")}</p>
          </div>
          <button onClick={handleCreatePlan} disabled={creatingPlan}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {creatingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {tr("learning.createPlan", "Créer un plan")}
          </button>
        </div>
      )}

      {/* Plan exists */}
      {plan && (
        <>
          {/* Progress strip */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{plan.title}</span>
              <span className="text-sm font-bold text-[var(--accent)]">{tr("learning.activitiesProgress", "{{done}}/{{count}} activités", { done, count: activities.length })}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-raised)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">{tr("learning.completedPct", "{{pct}}% complété", { pct: completionPct })}</p>
          </div>

          {/* Add activity form */}
          {showAddForm && (
            <div className="bg-[var(--bg-surface)] border border-[var(--accent)]/30 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{tr("learning.newActivity", "Nouvelle activité")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="col-span-2 px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  placeholder={tr("learning.fieldTitle", "Titre *")}
                  value={newActivity.title}
                  onChange={e => setNewActivity(p => ({ ...p, title: e.target.value }))}
                />
                <select
                  className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  value={newActivity.type}
                  onChange={e => setNewActivity(p => ({ ...p, type: e.target.value }))}
                >
                  {Object.keys(TYPE_ICONS).map(v => (
                    <option key={v} value={v}>{typeLabel(v)}</option>
                  ))}
                </select>
                <input
                  className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  placeholder={tr("learning.fieldProvider", "Fournisseur (ex: Coursera)")}
                  value={newActivity.provider}
                  onChange={e => setNewActivity(p => ({ ...p, provider: e.target.value }))}
                />
                <input
                  className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  placeholder={tr("learning.fieldUrl", "URL (optionnel)")}
                  value={newActivity.url}
                  onChange={e => setNewActivity(p => ({ ...p, url: e.target.value }))}
                />
                <input
                  type="number"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  placeholder={tr("learning.fieldHours", "Heures estimées")}
                  value={newActivity.estimated_hours}
                  onChange={e => setNewActivity(p => ({ ...p, estimated_hours: e.target.value }))}
                />
                <input
                  type="date"
                  className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  value={newActivity.due_date}
                  onChange={e => setNewActivity(p => ({ ...p, due_date: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  {tr("learning.cancel", "Annuler")}
                </button>
                <button onClick={handleAddActivity} disabled={!newActivity.title}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {tr("learning.add", "Ajouter")}
                </button>
              </div>
            </div>
          )}

          {/* Activities list */}
          {activities.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl">
              <BookOpen className="w-10 h-10 text-[var(--text-muted)]" style={{ opacity: 0.3 }} />
              <p className="text-sm text-[var(--text-muted)]">{tr("learning.noActivities", "Aucune activité — ajoutez la première")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.sort((a, b) => a.sort_order - b.sort_order).map(act => {
                const cfg = STATUS_STYLE[act.status];
                const Icon = TYPE_ICONS[act.type] ?? BookOpen;
                const StatusIcon = cfg.icon;
                return (
                  <div key={act.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] group">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-raised)] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{act.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)]">
                          {typeLabel(act.type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {act.provider && <span className="text-xs text-[var(--text-muted)]">{act.provider}</span>}
                        {act.estimated_hours && (
                          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />{act.estimated_hours}h
                          </span>
                        )}
                        {act.due_date && (
                          <span className="text-xs text-[var(--text-muted)]">
                            {tr("learning.dueDate", "Échéance : {{date}}", { date: new Date(act.due_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US") })}
                          </span>
                        )}
                        {act.url && (
                          <a href={act.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-[var(--accent)] flex items-center gap-1 hover:underline">
                            <ExternalLink className="w-3 h-3" />{tr("learning.open", "Ouvrir")}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={act.status}
                        onChange={e => handleStatusChange(act.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 font-semibold cursor-pointer outline-none ${cfg.color}`}
                        style={{ background: "transparent" }}
                      >
                        <option value="assigned">{statusLabel("assigned")}</option>
                        <option value="in_progress">{statusLabel("in_progress")}</option>
                        <option value="completed">{statusLabel("completed")}</option>
                        <option value="skipped">{statusLabel("skipped")}</option>
                      </select>
                      <button
                        onClick={() => handleDelete(act.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
