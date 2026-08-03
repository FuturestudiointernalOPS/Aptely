"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listOnboardingTemplates,
  createOnboardingTemplate,
  deleteOnboardingTemplate,
  getPhase2Overview,
  getPhase2Funnel,
  getPhase2TimeToHire,
  type OnboardingTemplate,
} from "@/lib/api";
import {
  ClipboardList,
  PlusCircle,
  Trash2,
  Search,
  Loader2,
  ListChecks,
  UserCheck,
  Briefcase,
  X,
  Save,
  GripVertical,
  Pencil,
} from "lucide-react";
import { updateOnboardingTemplate } from "@/lib/api";
import Link from "next/link";
import { getClientLocale, t } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OnboardingPage() {
  const locale = getClientLocale();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTasks, setNewTasks] = useState<Array<{ title: string; description: string; assigneeType: "CANDIDATE" | "HR" }>>([
    { title: "", description: "", assigneeType: "HR" },
  ]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingTemplate, setEditingTemplate] = useState<OnboardingTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTasks, setEditTasks] = useState<Array<{ title: string; description: string; assigneeType: "CANDIDATE" | "HR" }>>([]);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<{ onboardingChecklists: number; acceptedOffers: number } | null>(null);
  const [funnel, setFunnel] = useState<{ onboardingStarted: number } | null>(null);
  const [timeToHire, setTimeToHire] = useState<{ averageDays: number } | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOnboardingTemplates({ limit: 50 });
      setTemplates(res.data || []);
    } catch (e) {
      console.error("[Onboarding] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [o, f, t] = await Promise.all([
          getPhase2Overview(),
          getPhase2Funnel(),
          getPhase2TimeToHire(),
        ]);
        setOverview(o ? { onboardingChecklists: o.onboardingChecklists, acceptedOffers: o.acceptedOffers } : null);
        setFunnel(f ? { onboardingStarted: f.onboardingStarted } : null);
        setTimeToHire(t ? { averageDays: t.averageDays } : null);
      } catch (e) {
        console.error("[Onboarding] Analytics error:", e);
      }
    };
    fetchAnalytics();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const validTasks = newTasks.filter((t) => t.title.trim());
    if (validTasks.length === 0) return;

    setCreating(true);
    try {
      await createOnboardingTemplate(newName, validTasks, newDescription || undefined);
      setShowCreateModal(false);
      setNewName("");
      setNewDescription("");
      setNewTasks([{ title: "", description: "", assigneeType: "HR" }]);
      await fetchTemplates();
    } catch (e) {
      console.error("[Onboarding] Create error:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    setDeleting(templateId);
    try {
      await deleteOnboardingTemplate(templateId);
      await fetchTemplates();
    } catch (e) {
      console.error("[Onboarding] Delete error:", e);
    } finally {
      setDeleting(null);
    }
  };

  const addTask = () => {
    setNewTasks([...newTasks, { title: "", description: "", assigneeType: "HR" }]);
  };

  const removeTask = (idx: number) => {
    setNewTasks(newTasks.filter((_, i) => i !== idx));
  };

  const updateTask = (idx: number, field: string, value: string) => {
    const updated = [...newTasks];
    (updated[idx] as any)[field] = value;
    setNewTasks(updated);
  };

  const openEditModal = (template: OnboardingTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || "");
    setEditTasks(
      (template.tasks_json || []).map((t: any) => ({
        title: t.title || "",
        description: t.description || "",
        assigneeType: t.assigneeType || "HR",
      }))
    );
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate || !editName.trim()) return;
    const validTasks = editTasks.filter((t) => t.title.trim());
    if (validTasks.length === 0) return;
    setSaving(true);
    try {
      await updateOnboardingTemplate(editingTemplate.id, {
        name: editName,
        description: editDescription || undefined,
        tasks: validTasks,
      });
      setEditingTemplate(null);
      await fetchTemplates();
    } catch (e) {
      console.error("[Onboarding] Edit error:", e);
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = searchQuery
    ? templates.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : templates;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <PageHeader
        className="animate-fade-in-up"
        icon={<ClipboardList className="w-5 h-5 text-[var(--accent)]" />}
        title={t(locale, "onboarding.title", "Onboarding Engine")}
        subtitle={t(locale, "onboarding.subtitle", "Create templates and track onboarding checklists")}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} iconLeft={<PlusCircle className="w-4 h-4" />}>
            {t(locale, "onboarding.newTemplate", "New Template")}
          </Button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in-up delay-75">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/10 flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-[var(--text-primary)]">{templates.length}</p>
            <p className="text-xs text-[var(--text-muted)]">{t(locale, "onboarding.templatesCreated", "Templates Created")}</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-400/10 border border-emerald-400/10 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
              {templates.reduce((acc, t) => acc + (t.tasks_json?.length || 0), 0)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{t(locale, "onboarding.totalTasks", "Total Tasks Defined")}</p>
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-sky-400/10 border border-sky-400/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
              {templates.reduce((acc, t) => acc + (t.tasks_json?.filter((tk: any) => tk.assigneeType === "CANDIDATE").length || 0), 0)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{t(locale, "onboarding.candidateTasks", "Candidate Tasks")}</p>
          </div>
        </div>
      </div>

      {/* Phase 2 Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in-up delay-90">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t(locale, "onboarding.acceptedOffers", "Accepted Offers")}</p>
          <p className="text-2xl font-display font-bold text-emerald-400">{overview?.acceptedOffers ?? 0}</p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t(locale, "onboarding.started", "Onboarding Started")}</p>
          <p className="text-2xl font-display font-bold text-sky-400">{funnel?.onboardingStarted ?? overview?.onboardingChecklists ?? 0}</p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t(locale, "onboarding.avgTimeToHire", "Avg Time To Hire")}</p>
          <p className="text-2xl font-display font-bold text-[var(--accent)]">{timeToHire?.averageDays ?? 0}d</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 animate-fade-in-up delay-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder={t(locale, "onboarding.searchPlaceholder", "Search templates...")}
            className="glass-input w-full pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-8 w-full rounded-lg mt-2" />
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)]">
          <EmptyState
            icon={<ClipboardList className="w-6 h-6" />}
            title={t(locale, "onboarding.empty.title", "No onboarding templates")}
            description={t(locale, "onboarding.empty.subtitle", "Create your first template to streamline onboarding for new hires.")}
            action={(
              <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-sm font-semibold hover:bg-[var(--accent)] hover:text-white transition-all">
                <PlusCircle className="w-4 h-4" />
                {t(locale, "onboarding.createTemplate", "Create Template")}
              </button>
            )}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up delay-150">
          {filteredTemplates.map((template, idx) => {
            const taskCount = template.tasks_json?.length || 0;
            const hrTasks = template.tasks_json?.filter((t: any) => t.assigneeType !== "CANDIDATE").length || 0;
            const candidateTasks = taskCount - hrTasks;

            return (
              <div
                key={template.id}
                className="bg-[var(--bg-surface)] border border-[var(--border)]-hover p-5 flex flex-col animate-fade-in-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[var(--text-primary)] font-display font-bold text-sm truncate">{template.name}</h3>
                    {template.description && (
                      <p className="text-[var(--text-muted)] text-xs mt-1 line-clamp-2">{template.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                      title={t(locale, "onboarding.editTemplate", "Edit template")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      disabled={deleting === template.id}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                      title={t(locale, "onboarding.deleteTemplate", "Delete template")}
                    >
                      {deleting === template.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Task Preview */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-2 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-bold">
                      {t(locale, "onboarding.tasks", "{{count}} tasks", { count: taskCount })}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {hrTasks} {t(locale, "onboarding.hr", "HR")} · {candidateTasks} {t(locale, "onboarding.candidate", "Candidate")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {(template.tasks_json || []).slice(0, 4).map((task: any, tIdx: number) => (
                      <div key={tIdx} className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          task.assigneeType === "CANDIDATE" ? "bg-sky-400" : "bg-[var(--accent)]"
                        }`} />
                        <span className="text-[var(--text-secondary)] truncate">{task.title}</span>
                      </div>
                    ))}
                    {taskCount > 4 && (
                      <p className="text-xs text-[var(--text-muted)]">{t(locale, "onboarding.moreTasks", "+{{count}} more tasks", { count: taskCount - 4 })}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                  {t(locale, "onboarding.created", "Created {{date}}", { date: new Date(template.created_at).toLocaleDateString() })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <Modal
          open
          onClose={() => setEditingTemplate(null)}
          size="lg"
          title={t(locale, "onboarding.editModal.title", "Edit Template")}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditingTemplate(null)} disabled={saving}>
                {t(locale, "common.cancel", "Cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                isLoading={saving}
                iconLeft={<Save className="w-4 h-4" />}
                disabled={saving || !editName.trim() || !editTasks.some((task) => task.title.trim())}
              >
                {t(locale, "onboarding.saveTemplate", "Save Changes")}
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t(locale, "onboarding.modal.name", "Template Name *")}</label>
                <input
                  type="text"
                  className="glass-input w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t(locale, "onboarding.modal.description", "Description")}</label>
                <textarea
                  className="glass-input w-full h-16 resize-none"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "onboarding.modal.tasks", "Tasks *")}</label>
                  <button
                    onClick={() => setEditTasks([...editTasks, { title: "", description: "", assigneeType: "HR" }])}
                    className="text-[var(--accent)] text-xs font-bold hover:underline flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {t(locale, "onboarding.modal.addTask", "Add Task")}
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                  {editTasks.map((task, idx) => (
                    <div key={idx} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        <input
                          type="text"
                          className="glass-input flex-1 text-sm py-1.5"
                          placeholder={t(locale, "onboarding.modal.taskTitlePlaceholder", "Task {{index}} title", { index: idx + 1 })}
                          value={task.title}
                          onChange={(e) => {
                            const updated = [...editTasks];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setEditTasks(updated);
                          }}
                        />
                        <select
                          className="glass-input text-xs py-1.5 w-28"
                          value={task.assigneeType}
                          onChange={(e) => {
                            const updated = [...editTasks];
                            updated[idx] = { ...updated[idx], assigneeType: e.target.value as "CANDIDATE" | "HR" };
                            setEditTasks(updated);
                          }}
                        >
                          <option value="HR">{t(locale, "onboarding.hr", "HR")}</option>
                          <option value="CANDIDATE">{t(locale, "onboarding.candidate", "Candidate")}</option>
                        </select>
                        {editTasks.length > 1 && (
                          <button
                            onClick={() => setEditTasks(editTasks.filter((_, i) => i !== idx))}
                            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-400 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        className="glass-input w-full text-xs py-1.5 ml-6"
                        placeholder={t(locale, "onboarding.modal.taskDescriptionPlaceholder", "Task description (optional)")}
                        value={task.description}
                        onChange={(e) => {
                          const updated = [...editTasks];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setEditTasks(updated);
                        }}
                        style={{ width: "calc(100% - 1.5rem)" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
        </Modal>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <Modal
          open
          onClose={() => setShowCreateModal(false)}
          size="lg"
          title={t(locale, "onboarding.modal.title", "New Onboarding Template")}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)} disabled={creating}>
                {t(locale, "common.cancel", "Cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                isLoading={creating}
                iconLeft={<Save className="w-4 h-4" />}
                disabled={creating || !newName.trim() || !newTasks.some((task) => task.title.trim())}
              >
                {t(locale, "onboarding.createTemplate", "Create Template")}
              </Button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t(locale, "onboarding.modal.name", "Template Name *")}</label>
                <input
                  type="text"
                  className="glass-input w-full"
                  placeholder={t(locale, "onboarding.modal.namePlaceholder", "e.g. Engineering Onboarding")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t(locale, "onboarding.modal.description", "Description")}</label>
                <textarea
                  className="glass-input w-full h-16 resize-none"
                  placeholder={t(locale, "onboarding.modal.descriptionPlaceholder", "Brief description of this template...")}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "onboarding.modal.tasks", "Tasks *")}</label>
                  <button
                    onClick={addTask}
                    className="text-[var(--accent)] text-xs font-bold hover:underline flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {t(locale, "onboarding.modal.addTask", "Add Task")}
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                  {newTasks.map((task, idx) => (
                    <div key={idx} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        <input
                          type="text"
                          className="glass-input flex-1 text-sm py-1.5"
                          placeholder={t(locale, "onboarding.modal.taskTitlePlaceholder", "Task {{index}} title", { index: idx + 1 })}
                          value={task.title}
                          onChange={(e) => updateTask(idx, "title", e.target.value)}
                        />
                        <select
                          className="glass-input text-xs py-1.5 w-28"
                          value={task.assigneeType}
                          onChange={(e) => updateTask(idx, "assigneeType", e.target.value)}
                        >
                          <option value="HR">{t(locale, "onboarding.hr", "HR")}</option>
                          <option value="CANDIDATE">{t(locale, "onboarding.candidate", "Candidate")}</option>
                        </select>
                        {newTasks.length > 1 && (
                          <button
                            onClick={() => removeTask(idx)}
                            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-400 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        className="glass-input w-full text-xs py-1.5 ml-6"
                        placeholder={t(locale, "onboarding.modal.taskDescriptionPlaceholder", "Task description (optional)")}
                        value={task.description}
                        onChange={(e) => updateTask(idx, "description", e.target.value)}
                        style={{ width: "calc(100% - 1.5rem)" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
        </Modal>
      )}
    </div>
  );
}
