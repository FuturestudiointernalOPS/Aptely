"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare, Square, Plus, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { employeePath, offboardingHrApi, offboardingHrTasksApi, offboardingHrTaskToggleApi } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";

type OffboardingReason = "RESIGNATION" | "TERMINATION" | "END_OF_CONTRACT" | "RETIREMENT" | "OTHER";
type OffboardingStatus = "IN_PROGRESS" | "COMPLETED";

interface OffboardingTask {
    id: string;
    title: string;
    completed: boolean;
    completed_at: string | null;
}

interface Offboarding {
    id: string;
    reason: OffboardingReason;
    last_day: string | null;
    exit_interview_done: boolean;
    tasks_json: OffboardingTask[];
    status: OffboardingStatus;
    created_at: string;
    profiles: { id: string; full_name: string } | null;
}

const REASONS: OffboardingReason[] = ["RESIGNATION","TERMINATION","END_OF_CONTRACT","RETIREMENT","OTHER"];

export default function OffboardingPage() {
    const { userId } = useParams<{ userId: string }>();
    const loc = getClientLocale();
    const router = useRouter();
    const { hasPermission } = useWorkspace();
    const canManage = hasPermission("employees.manage");

    const [checklist, setChecklist] = useState<Offboarding | null>(null);
    const [loading, setLoading] = useState(true);
    const [createMode, setCreateMode] = useState(false);
    const [form, setForm] = useState({ reason: "RESIGNATION" as OffboardingReason, last_day: "" });
    const [creating, setCreating] = useState(false);
    const [newTask, setNewTask] = useState("");
    const [addingTask, setAddingTask] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(offboardingHrApi(userId), "HR") as Offboarding | null;
            setChecklist(res ?? null);
        } catch { /* silent */ }
        setLoading(false);
    };

    useEffect(() => { void load(); }, [userId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await apiFetch(offboardingHrApi(userId), "HR", {
                method: "POST",
                body: JSON.stringify({ reason: form.reason, last_day: form.last_day || null }),
            });
            setCreateMode(false);
            void load();
        } finally { setCreating(false); }
    };

    const handleToggleTask = async (taskId: string) => {
        await apiFetch(offboardingHrTaskToggleApi(userId, taskId), "HR", { method: "PATCH" });
        void load();
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        setAddingTask(true);
        try {
            await apiFetch(offboardingHrTasksApi(userId), "HR", {
                method: "POST",
                body: JSON.stringify({ title: newTask.trim() }),
            });
            setNewTask("");
            void load();
        } finally { setAddingTask(false); }
    };

    const handleToggleExitInterview = async () => {
        if (!checklist) return;
        await apiFetch(offboardingHrApi(userId), "HR", {
            method: "PATCH",
            body: JSON.stringify({ exit_interview_done: !checklist.exit_interview_done }),
        });
        void load();
    };

    const handleToggleStatus = async () => {
        if (!checklist) return;
        await apiFetch(offboardingHrApi(userId), "HR", {
            method: "PATCH",
            body: JSON.stringify({ status: checklist.status === "IN_PROGRESS" ? "COMPLETED" : "IN_PROGRESS" }),
        });
        void load();
    };

    const handleDelete = async () => {
        await apiFetch(offboardingHrApi(userId), "HR", { method: "DELETE" });
        setDeleteConfirm(false);
        void load();
    };

    if (loading) {
        return (
            <div className="p-6 max-w-2xl mx-auto space-y-4">
                {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-[var(--bg-raised)] animate-pulse" />)}
            </div>
        );
    }

    const tasks = checklist?.tasks_json ?? [];
    const done = tasks.filter((t) => t.completed).length;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            {/* Back */}
            <button type="button" onClick={() => router.push(employeePath(userId))}
                className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <ArrowLeft size={14} />
                {t(loc, "nav.hr.employees", "Employés")}
            </button>

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                        {t(loc, "offboard.title", "Offboarding")}
                    </h1>
                    {checklist && (
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            {t(loc, `offboard.reason.${checklist.reason}`, checklist.reason)}
                            {checklist.last_day && ` · ${t(loc, "offboard.lastDay", "Dernier jour")} : ${checklist.last_day}`}
                        </p>
                    )}
                </div>
                {checklist && canManage && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={() => void handleToggleStatus()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                checklist.status === "IN_PROGRESS"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-500/20"
                                    : "bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-primary)]"
                            }`}>
                            {checklist.status === "IN_PROGRESS"
                                ? <><CheckCircle2 size={12} /> {t(loc, "offboard.complete", "Marquer terminé")}</>
                                : <><RotateCcw size={12} /> {t(loc, "offboard.reopen", "Réouvrir")}</>
                            }
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(true)}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Not started */}
            {!checklist && !createMode && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 text-center">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                        {t(loc, "offboard.notStarted", "Offboarding non démarré")}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 mb-5">
                        {t(loc, "offboard.notStartedDesc", "Créez une checklist d'offboarding pour gérer le départ de cet employé.")}
                    </p>
                    {canManage && (
                        <button type="button" onClick={() => setCreateMode(true)}
                            className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
                            {t(loc, "offboard.start", "Démarrer l'offboarding")}
                        </button>
                    )}
                </div>
            )}

            {/* Create form */}
            {createMode && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
                    <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                {t(loc, "offboard.reason", "Raison du départ")}
                            </label>
                            <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as OffboardingReason })}
                                className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
                                {REASONS.map((r) => (
                                    <option key={r} value={r}>{t(loc, `offboard.reason.${r}`, r)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                {t(loc, "offboard.lastDay", "Dernier jour")}
                            </label>
                            <input type="date" value={form.last_day} onChange={(e) => setForm({ ...form, last_day: e.target.value })}
                                className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setCreateMode(false)}
                                className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                {t(loc, "offboard.cancel", "Annuler")}
                            </button>
                            <button type="submit" disabled={creating}
                                className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                                {t(loc, "offboard.start", "Démarrer")}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Checklist */}
            {checklist && (
                <>
                    {/* Progress strip */}
                    <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-[var(--text-muted)]">
                                    {done}/{tasks.length} {t(loc, "offboard.tasks.title", "tâches")}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                    checklist.status === "COMPLETED"
                                        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
                                        : "bg-amber-400/10 text-amber-400 border-amber-400/30"
                                }`}>
                                    {t(loc, `offboard.status.${checklist.status}`, checklist.status)}
                                </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[var(--bg-raised)] overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                                    style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : "0%" }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Exit interview toggle */}
                    <div className="flex items-center justify-between px-5 py-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                        <span className="text-sm text-[var(--text-primary)]">
                            {t(loc, "offboard.exitInterview", "Entretien de sortie effectué")}
                        </span>
                        <button type="button" onClick={() => canManage && void handleToggleExitInterview()}
                            className={`transition-colors ${canManage ? "cursor-pointer" : "cursor-default"}`}>
                            {checklist.exit_interview_done
                                ? <CheckSquare size={18} className="text-[var(--accent)]" />
                                : <Square size={18} className="text-[var(--text-muted)]" />
                            }
                        </button>
                    </div>

                    {/* Tasks */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
                        <div className="px-5 py-4 border-b border-[var(--border)]">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                                {t(loc, "offboard.tasks.title", "Tâches")}
                            </p>
                        </div>
                        {tasks.length === 0 ? (
                            <p className="px-5 py-6 text-sm text-[var(--text-muted)]">
                                {t(loc, "offboard.tasks.empty", "Aucune tâche")}
                            </p>
                        ) : (
                            <div className="divide-y divide-[var(--border)]">
                                {tasks.map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-raised)] transition-colors">
                                        <button type="button"
                                            onClick={() => canManage && void handleToggleTask(task.id)}
                                            className={`flex-shrink-0 transition-colors ${canManage ? "cursor-pointer" : "cursor-default"}`}>
                                            {task.completed
                                                ? <CheckSquare size={16} className="text-[var(--accent)]" />
                                                : <Square size={16} className="text-[var(--text-muted)]" />
                                            }
                                        </button>
                                        <span className={`text-sm flex-1 ${task.completed ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                                            {task.title}
                                        </span>
                                        {task.completed_at && (
                                            <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                                                {new Date(task.completed_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Add task */}
                        {canManage && (
                            <form onSubmit={(e) => void handleAddTask(e)}
                                className="flex items-center gap-2 px-5 py-3 border-t border-[var(--border)]">
                                <input
                                    value={newTask}
                                    onChange={(e) => setNewTask(e.target.value)}
                                    placeholder={t(loc, "offboard.tasks.placeholder", "Titre de la tâche...")}
                                    className="flex-1 rounded-lg px-3 py-1.5 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                                />
                                <button type="submit" disabled={!newTask.trim() || addingTask}
                                    className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40">
                                    <Plus size={14} />
                                </button>
                            </form>
                        )}
                    </div>
                </>
            )}

            {/* Delete confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(false)} />
                    <div className="relative w-full max-w-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl p-6">
                        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-4">
                            {t(loc, "offboard.deleteConfirm", "Supprimer cet offboarding ?")}
                        </h3>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setDeleteConfirm(false)}
                                className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                {t(loc, "offboard.cancel", "Annuler")}
                            </button>
                            <button type="button" onClick={() => void handleDelete()}
                                className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:opacity-90 transition-opacity">
                                {t(loc, "offboard.delete", "Supprimer")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
