"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createInterviewScorecard,
  getInterviewScorecards,
  getInterviewScorecardTemplate,
  submitInterviewScorecard,
  updateInterviewScorecard,
  type InterviewScorecard,
  type InterviewScorecardsList,
} from "@/lib/api";
import ScorecardForm, { type DraftScoreEntry } from "./ScorecardForm";
import { AlertTriangle, FileCheck2, Users, Check } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

interface ScorecardPanelProps {
  interviewId: string;
  interviewerProfiles?: Array<{ userId: string; label: string; evaluationWeight: number }>;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

interface CriterionDraft {
  key: string;
  label: string;
  weight: number;
}

export default function ScorecardPanel({ interviewId, interviewerProfiles, onError, onSuccess }: ScorecardPanelProps) {
  const locale = getClientLocale();
  const tr = useCallback((key: string, fallback: string) => t(locale, key, fallback), [locale]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<InterviewScorecardsList | null>(null);
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [editingMyScorecard, setEditingMyScorecard] = useState(false);

  const myScorecard = useMemo(
    () => data?.scorecards.find((card) => card.reviewerId === data.visibility.myReviewerId) ?? null,
    [data]
  );

  // Sync scorecard entries with current template criteria, preserving existing scores/comments
  const syncedMyScorecard = useMemo(() => {
    if (!myScorecard) return null;
    if (criteria.length === 0) return myScorecard;

    const syncedEntries = criteria.map((tc, idx) => {
      const existing = myScorecard.entries.find((e) => e.criterionKey === tc.key);
      if (existing) {
        return { ...existing, criterionLabel: tc.label, weight: tc.weight };
      }
      return {
        id: `new_${tc.key}_${idx}`,
        criterionKey: tc.key,
        criterionLabel: tc.label,
        weight: tc.weight,
        score: null,
        comment: null,
        redFlag: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    return { ...myScorecard, entries: syncedEntries, templateSnapshot: { ...myScorecard.templateSnapshot, criteria: criteria.map((c) => ({ criterionKey: c.key, label: c.label, weight: c.weight, position: 0 })) } };
  }, [myScorecard, criteria]);

  const others = useMemo(() => {
    if (!data) return [] as InterviewScorecard[];
    if (!myScorecard) return data.scorecards;
    return data.scorecards.filter((card) => card.id !== myScorecard.id);
  }, [data, myScorecard]);

  const consolidatedScores = useMemo(() => {
    if (!data || !interviewerProfiles || interviewerProfiles.length === 0) return null;
    const submitted = data.scorecards.filter((c) => c.status === "SUBMITTED");
    if (submitted.length === 0) return null;
    const weightByReviewer = new Map<string, number>();
    for (const p of interviewerProfiles) weightByReviewer.set(p.userId, p.evaluationWeight > 0 ? p.evaluationWeight : 0);
    const byKey = new Map<string, { label: string; wSum: number; wTotal: number }>();
    for (const card of submitted) {
      const w = weightByReviewer.get(card.reviewerId) ?? 0;
      for (const entry of card.entries) {
        if (entry.score == null) continue;
        if (!byKey.has(entry.criterionKey)) byKey.set(entry.criterionKey, { label: entry.criterionLabel, wSum: 0, wTotal: 0 });
        const b = byKey.get(entry.criterionKey)!;
        b.wSum += entry.score * w;
        b.wTotal += w;
      }
    }
    const criteriaList: Array<{ key: string; label: string; weightedAvg: number }> = [];
    let total = 0;
    for (const [key, b] of byKey) {
      const avg = b.wTotal > 0 ? Math.round((b.wSum / b.wTotal) * 10) / 10 : 0;
      criteriaList.push({ key, label: b.label, weightedAvg: avg });
      total += avg;
    }
    const overall = criteriaList.length > 0 ? Math.round((total / criteriaList.length) * 10) / 10 : 0;
    return { criteria: criteriaList, overall, submittedCount: submitted.length, totalInterviewers: interviewerProfiles.length };
  }, [data, interviewerProfiles]);

  const scoreConflicts = useMemo(() => {
    if (!data) return [] as Array<{ criterionKey: string; criterionLabel: string; min: number; max: number; variance: number }>;
    const submitted = data.scorecards.filter((c) => c.status === "SUBMITTED");
    if (submitted.length < 2) return [];

    const byKey = new Map<string, { label: string; scores: number[] }>();
    for (const card of submitted) {
      for (const entry of card.entries) {
        if (entry.score == null) continue;
        if (!byKey.has(entry.criterionKey)) {
          byKey.set(entry.criterionKey, { label: entry.criterionLabel, scores: [] });
        }
        byKey.get(entry.criterionKey)!.scores.push(entry.score);
      }
    }

    const conflicts: Array<{ criterionKey: string; criterionLabel: string; min: number; max: number; variance: number }> = [];
    for (const [key, { label, scores }] of byKey) {
      if (scores.length < 2) continue;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const variance = max - min;
      if (variance >= 2) conflicts.push({ criterionKey: key, criterionLabel: label, min, max, variance });
    }
    return conflicts;
  }, [data]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getInterviewScorecards(interviewId);
      setData(next);
      // Load template criteria for syncing entries
      const template = await getInterviewScorecardTemplate(interviewId);
      if (template && template.criteria.length > 0) {
        setCriteria(template.criteria.map((c) => ({
          key: c.criterionKey,
          label: c.label,
          weight: c.weight ?? 0,
        })));
      } else {
        // Fallback: read from first scorecard snapshot
        const snapshot = next?.scorecards[0]?.templateSnapshot;
        if (snapshot?.criteria?.length) {
          setCriteria(snapshot.criteria.map((c: { criterionKey: string; label: string; weight: number | null }) => ({
            key: c.criterionKey,
            label: c.label,
            weight: c.weight ?? 0,
          })));
        }
      }
    } catch (err) {
      console.warn("ScorecardPanel refresh failed:", err);
      onError?.(tr("interview.scorecard.panel.errors.load", "Unable to load scorecards."));
    } finally {
      setLoading(false);
    }
  }, [interviewId, tr, onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ensureMyScorecard = useCallback(async (): Promise<InterviewScorecard | null> => {
    if (!data?.visibility.canReview) {
      onError?.(tr("interview.scorecard.panel.errors.notReviewer", "You are not assigned as reviewer for this interview."));
      return null;
    }

    if (myScorecard) return myScorecard;

    const created = await createInterviewScorecard(interviewId);
    await refresh();
    if (!created) {
      return myScorecard ?? null;
    }
    return created;
  }, [data?.visibility.canReview, myScorecard, interviewId, refresh, onError]);

  const handleSaveDraft = useCallback(
    async (entries: DraftScoreEntry[], overallComment: string | null) => {
      setSaving(true);
      const target = await ensureMyScorecard();
      if (!target) { setSaving(false); return; }

      const updated = await updateInterviewScorecard(interviewId, target.id, { entries, overallComment });
      if (!updated) {
        onError?.(tr("interview.scorecard.panel.errors.saveDraft", "Unable to save draft."));
        setSaving(false);
        return;
      }

      await refresh();
      onSuccess?.(tr("interview.scorecard.panel.success.draftSaved", "Draft saved."));
      setSaving(false);
    },
    [ensureMyScorecard, interviewId, onError, onSuccess, refresh]
  );

  const handleSubmit = useCallback(
    async (entries: DraftScoreEntry[], overallComment: string | null) => {
      const missingScores = entries.filter((e) => e.score == null);
      if (missingScores.length > 0) {
        const missingLabels = missingScores.map((e) => e.criterionKey).join(", ");
        onError?.(tr("interview.scorecard.panel.errors.missingScores", `All criteria must be scored before submitting. Missing: ${missingLabels}`));
        return;
      }

      setSaving(true);
      const target = await ensureMyScorecard();
      if (!target) { setSaving(false); return; }

      const updated = await updateInterviewScorecard(interviewId, target.id, { entries, overallComment });
      if (!updated) {
        onError?.(tr("interview.scorecard.panel.errors.prepareSubmit", "Unable to prepare scorecard submission."));
        setSaving(false);
        return;
      }

      const submitted = await submitInterviewScorecard(interviewId, target.id);
      if (!submitted) {
        onError?.(tr("interview.scorecard.panel.errors.submit", "Unable to submit scorecard."));
        setSaving(false);
        return;
      }

      await refresh();
      setEditingMyScorecard(false);
      onSuccess?.(tr("interview.scorecard.panel.success.submitted", "Scorecard submitted successfully."));
      setSaving(false);
    },
    [ensureMyScorecard, interviewId, onError, onSuccess, refresh]
  );

  if (loading) {
    return <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 text-sm text-[var(--text-muted)]">{tr("interview.scorecard.panel.loading", "Loading scorecards...")}</div>;
  }

  if (!data) {
    return <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 text-sm text-[var(--text-muted)]">{tr("interview.scorecard.panel.noData", "No scorecard data available.")}</div>;
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[var(--text-primary)] font-bold text-lg">{tr("interview.scorecard.panel.title", "Scorecards by interview")}</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {tr("interview.scorecard.panel.personalStatus", "Personal status")}: {data.visibility.myScorecardStatus} · {tr("interview.scorecard.panel.othersVisibility", "Others visibility")}: {tr("interview.scorecard.panel.open", "open")}
          </p>
          {!data.visibility.canReview && (
            <p className="text-xs text-amber-400 mt-1">
              {tr("interview.scorecard.panel.readOnlyHint", "Access allowed: you can view notes for this interview. Editing is reserved for assigned reviewers.")}
            </p>
          )}
          {interviewerProfiles && interviewerProfiles.length > 0 && (() => {
            const submittedCount = data.scorecards.filter(c => c.status === "SUBMITTED").length;
            const totalInterviewers = interviewerProfiles.length;
            const text = tr("interview.scorecard.panel.submittedCount", `${submittedCount}/${totalInterviewers} scorecards submitted`)
              .replace("{{submitted}}", String(submittedCount))
              .replace("{{total}}", String(totalInterviewers));
            return (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                <Users className="w-3 h-3 inline mr-1" />
                {text}
              </p>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)]"
          >
            {tr("common.refresh", "Refresh")}
          </button>
        </div>
      </div>

      {/* ── Consolidated Score ── */}
      {consolidatedScores && consolidatedScores.submittedCount >= 1 && (
        <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--accent)]">
              <FileCheck2 className="w-4 h-4 inline mr-1.5" />
              {tr("interview.scorecard.panel.consolidated", "Consolidated score")}
            </h3>
            <span className="text-lg font-black text-[var(--accent)]">{consolidatedScores.overall}/5</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {consolidatedScores.criteria.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)]/60 px-3 py-1.5">
                <span className="text-xs text-[var(--text-secondary)]">{c.label}</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">{c.weightedAvg}/5</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            {tr("interview.scorecard.panel.consolidatedDesc", `Weighted average of ${consolidatedScores.submittedCount}/${consolidatedScores.totalInterviewers} submitted scorecards`)
              .replace("{{submitted}}", String(consolidatedScores.submittedCount))
              .replace("{{total}}", String(consolidatedScores.totalInterviewers))}
          </p>
        </div>
      )}

      {!myScorecard && !data.visibility.canReview ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {tr("interview.scorecard.panel.readOnlyInfo", "You are in read-only mode for this interview. If scorecards exist, they are visible below.")}
          </p>
        </div>
      ) : !myScorecard ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">{tr("interview.scorecard.panel.noPersonal", "No personal scorecard yet. Create your draft to start the evaluation.")}</p>
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              const created = await createInterviewScorecard(interviewId);
              await refresh();
              if (created) {
                onSuccess?.(tr("interview.scorecard.panel.success.created", "Scorecard created."));
              }
              setSaving(false);
            }}
            disabled={saving}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent)]-soft disabled:opacity-60"
          >
            {tr("interview.scorecard.panel.createMine", "Create my scorecard")}
          </button>
        </div>
      ) : myScorecard.status === "SUBMITTED" && !editingMyScorecard ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-400">{tr("interview.scorecard.panel.submitted", "Scorecard submitted")}</span>
            </div>
            <button
              type="button"
              onClick={() => setEditingMyScorecard(true)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {tr("interview.scorecard.panel.edit", "Edit")}
            </button>
          </div>
          <div className="space-y-2">
            {syncedMyScorecard?.entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">{entry.criterionLabel}</span>
                <span className="font-bold text-[var(--text-primary)]">{entry.score ?? "--"} / 5</span>
              </div>
            ))}
          </div>
          {syncedMyScorecard?.overallComment && (
            <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border)] pt-2">{syncedMyScorecard.overallComment}</p>
          )}
        </div>
      ) : (
        <ScorecardForm
          scorecard={syncedMyScorecard ?? myScorecard}
          saving={saving}
          readOnly={!data.visibility.canReview || myScorecard.status === "ARCHIVED"}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
        />
      )}

      {scoreConflicts.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-sm font-bold text-amber-400">
              {tr("interview.scorecard.panel.conflict.title", "Score conflicts detected — review required")}
            </p>
          </div>
          <p className="text-xs text-amber-400/80">
            {tr("interview.scorecard.panel.conflict.desc", "The following criteria have a score spread ≥ 2 points between reviewers. A calibration session is recommended before finalising the decision.")}
          </p>
          <div className="space-y-1">
            {scoreConflicts.map((c) => (
              <div key={c.criterionKey} className="flex items-center justify-between rounded-lg bg-amber-400/10 px-3 py-1.5">
                <span className="text-xs font-semibold text-amber-300">{c.criterionLabel}</span>
                <span className="text-xs text-amber-400 font-mono">
                  {c.min} → {c.max} ({tr("interview.scorecard.panel.conflict.spread", "spread")}: {c.variance})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Users className="w-4 h-4" />
          {tr("interview.scorecard.panel.available", "Available scorecards")} ({others.length})
        </div>

        {others.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{tr("interview.scorecard.panel.noneAvailable", "No scorecard has been created for this interview yet.")}</p>
        ) : (
          <div className="space-y-3">
            {others.map((card) => (
              <div key={card.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{card.reviewerName}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 uppercase">
                    {card.status}
                  </span>
                </div>

                <ScorecardForm scorecard={card} saving={false} readOnly />
                {card.isModifiedAfterSubmit && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-amber-400/10 text-amber-400">
                    <FileCheck2 className="w-3 h-3" />
                    {tr("interview.scorecard.panel.modifiedAfterSubmit", "Modified after submission")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
