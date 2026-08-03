"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import {
  ClipboardList, CheckSquare, Square, Loader2, AlertTriangle,
  Building2, ChevronDown, ChevronUp, CheckCircle2, Upload, FileText, XCircle,
} from "lucide-react";
import { useRef } from "react";
import { onboardingChecklistApi, onboardingTaskStatusApi, individualsMyApplicationsApi, onboardingDocPresignApi, onboardingDocCompleteApi } from "@/lib/routes";

interface Application {
  id: string;
  status: string;
  role: { id: string | null; title: string; institution_name: string | null };
}

interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  assignee_type: "CANDIDATE" | "HR";
  position: number;
  status: string;
}

interface OnboardingDocument {
  id: string;
  task_id: string | null;
  file_name: string;
  mime_type: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface OnboardingChecklist {
  id: string;
  status: string;
  tasks: OnboardingTask[];
  documents: OnboardingDocument[];
  progress: { total: number; completed: number; percentage: number };
}

interface AppWithChecklist {
  app: Application;
  checklist: OnboardingChecklist | null;
  loading: boolean;
  expanded: boolean;
}

export default function IndividualOnboardingPage() {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [items, setItems] = useState<AppWithChecklist[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [taskUpdating, setTaskUpdating] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // checklistId being uploaded
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ checklistId: string; appId: string } | null>(null);

  const fetchData = useCallback(async () => {
    setPageLoading(true);
    try {
      const res = await apiFetch(individualsMyApplicationsApi, "HR", { method: "GET", cache: "no-store", headers: { "X-Workspace-Id": "individual" } });
      const apps: Application[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];

      // Only show applications that may have an onboarding checklist (VALIDATED, FINISHED)
      const eligible = apps.filter((a) =>
        ["VALIDATED", "FINISHED", "HIRED"].includes(a.status)
      );

      const withChecklists: AppWithChecklist[] = await Promise.all(
        eligible.map(async (app) => {
          try {
            const cl = await apiFetch(onboardingChecklistApi(app.id), "HR", { method: "GET", cache: "no-store" });
            const checklist = cl?.data ?? cl ?? null;
            return { app, checklist, loading: false, expanded: true };
          } catch {
            return { app, checklist: null, loading: false, expanded: false };
          }
        })
      );

      // Also include apps with checklists even if status doesn't match
      const allApps = await Promise.all(
        apps
          .filter((a) => !eligible.find((e) => e.id === a.id))
          .map(async (app) => {
            try {
              const cl = await apiFetch(onboardingChecklistApi(app.id), "HR", { method: "GET", cache: "no-store" });
              const checklist = cl?.data ?? cl ?? null;
              if (!checklist) return null;
              return { app, checklist, loading: false, expanded: true };
            } catch {
              return null;
            }
          })
      );

      const combined = [
        ...withChecklists,
        ...allApps.filter((x): x is AppWithChecklist => x !== null),
      ].filter((item) => item.checklist !== null);

      setItems(combined);
    } catch {
      // silent
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpanded = (appId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.app.id === appId ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  const handleTaskToggle = async (appId: string, taskId: string, currentStatus: string) => {
    if (currentStatus !== "PENDING" && currentStatus !== "COMPLETED") return;
    setTaskUpdating(taskId);
    const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await apiFetch(onboardingTaskStatusApi(taskId), "HR", {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      // Refresh checklist for this app
      const cl = await apiFetch(onboardingChecklistApi(appId), "HR", { method: "GET", cache: "no-store" });
      const checklist = cl?.data ?? cl ?? null;
      setItems((prev) =>
        prev.map((item) => (item.app.id === appId ? { ...item, checklist } : item))
      );
    } catch {
      // silent
    } finally {
      setTaskUpdating(null);
    }
  };

  const handleFileUpload = async (file: File, checklistId: string, appId: string) => {
    setUploading(checklistId);
    try {
      const presign = await apiFetch(onboardingDocPresignApi, "HR", {
        method: "POST",
        body: JSON.stringify({ checklistId, fileName: file.name, mimeType: file.type }),
      });
      if (!presign?.documentId) return;

      await fetch(presign.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      await apiFetch(onboardingDocCompleteApi, "HR", {
        method: "POST",
        body: JSON.stringify({ documentId: presign.documentId, storagePath: presign.storagePath }),
      });

      const cl = await apiFetch(onboardingChecklistApi(appId), "HR", { method: "GET", cache: "no-store" });
      const checklist = cl?.data ?? cl ?? null;
      setItems((prev) => prev.map((item) => (item.app.id === appId ? { ...item, checklist } : item)));
    } catch {
      // silent
    } finally {
      setUploading(null);
    }
  };

  const triggerUpload = (checklistId: string, appId: string) => {
    uploadTargetRef.current = { checklistId, appId };
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = uploadTargetRef.current;
    if (file && target) handleFileUpload(file, target.checklistId, target.appId);
    e.target.value = "";
  };

  const docStatusColor = (status: string) => {
    if (status === "VERIFIED") return "text-emerald-400";
    if (status === "REJECTED") return "text-red-400";
    return "text-[var(--text-muted)]";
  };

  const candidateTasks = (checklist: OnboardingChecklist) =>
    checklist.tasks.filter((t) => t.assignee_type === "CANDIDATE");

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10 px-4 pt-6">
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent)/80] flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--text-primary)]">
            {tr("individual.onboarding.title", "My Onboarding")}
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            {tr("individual.onboarding.subtitle", "Track your onboarding tasks before Day 1")}
          </p>
        </div>
      </div>

      {pageLoading ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-16 flex flex-col items-center gap-3 animate-fade-in-up">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          <p className="text-[var(--text-muted)] text-sm">{tr("individual.onboarding.loading", "Loading your checklist...")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-16 flex flex-col items-center gap-4 animate-fade-in-up">
          <AlertTriangle className="w-10 h-10 text-[var(--text-muted)]" />
          <p className="text-[var(--text-primary)] font-display font-bold text-lg">
            {tr("individual.onboarding.empty.title", "No onboarding checklist yet")}
          </p>
          <p className="text-[var(--text-muted)] text-sm text-center max-w-sm">
            {tr("individual.onboarding.empty.subtitle", "Once your offer is accepted, your onboarding checklist will appear here.")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(({ app, checklist, expanded }) => {
            if (!checklist) return null;
            const myTasks = candidateTasks(checklist);
            const myCompleted = myTasks.filter((t) => t.status === "COMPLETED").length;
            const allDone = checklist.progress.percentage === 100;

            return (
              <div key={app.id} className="bg-[var(--bg-surface)] border border-[var(--border)] animate-fade-in-up">
                {/* Card header */}
                <button
                  className="w-full flex items-center justify-between p-5 text-left"
                  onClick={() => toggleExpanded(app.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <p className="text-[var(--text-primary)] font-bold text-sm">{app.role.title}</p>
                      <p className="text-[var(--text-muted)] text-xs">{app.role.institution_name || "Institution"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {allDone ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {tr("individual.onboarding.done", "Complete")}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">
                        {myCompleted}/{myTasks.length} {tr("individual.onboarding.yourTasks", "your tasks")}
                      </span>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                </button>

                {expanded && (
                  <div className="px-5 pb-5 border-t border-[var(--border)] pt-4 space-y-3">
                    {/* Overall progress */}
                    <div>
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>{tr("individual.onboarding.progress", "Overall progress")}</span>
                        <span>{checklist.progress.percentage}%</span>
                      </div>
                      <div className="w-full bg-[var(--border)] rounded-full h-1.5">
                        <div
                          className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${checklist.progress.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Candidate tasks */}
                    {myTasks.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                          {tr("individual.onboarding.yourTasksLabel", "Your tasks")}
                        </p>
                        <div className="space-y-2">
                          {myTasks.map((task) => (
                            <div key={task.id} className="flex items-start gap-3">
                              <button
                                onClick={() => handleTaskToggle(app.id, task.id, task.status)}
                                disabled={taskUpdating === task.id || (task.status !== "PENDING" && task.status !== "COMPLETED")}
                                className="mt-0.5 flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                              >
                                {taskUpdating === task.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : task.status === "COMPLETED" ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${task.status === "COMPLETED" ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{task.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HR tasks (read-only) */}
                    {checklist.tasks.filter((t) => t.assignee_type === "HR").length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                          {tr("individual.onboarding.hrTasksLabel", "HR tasks (read-only)")}
                        </p>
                        <div className="space-y-1.5">
                          {checklist.tasks
                            .filter((t) => t.assignee_type === "HR")
                            .map((task) => (
                              <div key={task.id} className="flex items-center gap-2 text-xs">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === "COMPLETED" ? "bg-emerald-400" : "bg-t-muted"}`} />
                                <span className={task.status === "COMPLETED" ? "line-through text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}>
                                  {task.title}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {checklist.tasks.length === 0 && (
                      <p className="text-[var(--text-muted)] text-sm">
                        {tr("individual.onboarding.noTasks", "No tasks yet.")}
                      </p>
                    )}

                    {/* Documents */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          {tr("individual.onboarding.documents", "Documents")}
                        </p>
                        <button
                          onClick={() => triggerUpload(checklist.id, app.id)}
                          disabled={uploading === checklist.id}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-50"
                        >
                          {uploading === checklist.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3" />
                          )}
                          {tr("individual.onboarding.upload", "Upload")}
                        </button>
                      </div>
                      {(checklist.documents ?? []).length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">{tr("individual.onboarding.noDocs", "No documents uploaded yet.")}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(checklist.documents ?? []).map((doc) => (
                            <div key={doc.id} className="flex items-center gap-2 text-xs">
                              {doc.status === "REJECTED" ? (
                                <XCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />
                              )}
                              <span className="flex-1 truncate text-[var(--text-secondary)]">{doc.file_name}</span>
                              <span className={`font-bold ${docStatusColor(doc.status)}`}>{doc.status}</span>
                              {doc.notes && <span className="text-[var(--text-muted)] italic truncate max-w-[80px]">{doc.notes}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
