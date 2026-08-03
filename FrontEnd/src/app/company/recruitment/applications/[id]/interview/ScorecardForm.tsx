"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";

import type { InterviewScorecard } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";

export interface DraftScoreEntry {
  criterionKey: string;
  score: number | null;
  comment: string | null;
  redFlag: boolean;
}

interface ScorecardFormProps {
  scorecard: InterviewScorecard;
  saving: boolean;
  readOnly?: boolean;
  onSaveDraft?: (entries: DraftScoreEntry[], overallComment: string | null) => void;
  onSubmit?: (entries: DraftScoreEntry[], overallComment: string | null) => void;
}

const CRITERION_I18N_MAP: Record<string, string> = {
  role_fit: "interview.scorecard.criteria.roleFit",
  technical_depth: "interview.scorecard.criteria.technicalDepth",
  communication: "interview.scorecard.criteria.communication",
  problem_solving: "interview.scorecard.criteria.problemSolving",
};

function trLabel(criterionKey: string, dbLabel: string, locale: "fr" | "en"): string {
  const k = CRITERION_I18N_MAP[criterionKey];
  return k ? t(locale, k, dbLabel) : dbLabel;
}

export default function ScorecardForm({
  scorecard,
  saving,
  readOnly = false,
  onSaveDraft,
  onSubmit,
}: ScorecardFormProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [entries, setEntries] = useState(scorecard.entries);
  const [overallComment, setOverallComment] = useState<string | null>(scorecard.overallComment ?? null);

  useEffect(() => {
    setEntries(scorecard.entries);
    setOverallComment(scorecard.overallComment ?? null);
  }, [scorecard]);

  const redFlagCount = entries.filter((e) => e.redFlag).length;

  const buildDraftEntries = () =>
    entries.map((row) => ({
      criterionKey: row.criterionKey,
      score: row.score,
      comment: row.comment,
      redFlag: Boolean(row.redFlag),
    }));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{tr("interview.scorecard.form.title", "Scorecard form")}</h3>
          <p className="text-xs text-[var(--text-muted)]">
            {tr("interview.scorecard.form.template", "Template")}: {scorecard.templateSnapshot.templateName} · {tr("interview.scorecard.form.evaluator", "Evaluator")}: {scorecard.reviewerName}
          </p>
        </div>
        {redFlagCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
            <Flag className="w-3 h-3" />
            {redFlagCount} red flag{redFlagCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {entries.map((entry) => {
          const isRedFlagged = Boolean(entry.redFlag);
          const displayLabel = trLabel(entry.criterionKey, entry.criterionLabel, locale);
          return (
            <div
              key={entry.id}
              className={`rounded-xl border p-3 space-y-2 transition-colors ${
                isRedFlagged
                  ? "border-rose-500/30 bg-rose-500/5"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-semibold ${isRedFlagged ? "text-rose-300" : "text-[var(--text-primary)]"}`}>
                  {displayLabel}
                  {isRedFlagged && <Flag className="inline w-3 h-3 ml-1.5 text-rose-400" />}
                </p>
                <span className="text-xs text-[var(--text-muted)]">{tr("interview.scorecard.form.weight", "Weight")}: {entry.weight ?? 0}%</span>
              </div>

              {readOnly ? (
                <>
                  <p className="text-sm text-[var(--text-secondary)]">{tr("interview.scorecard.form.scoreLabel", "Score")}: {entry.score ?? "--"} / 5</p>
                  <p className="text-xs text-[var(--text-muted)]">{entry.comment || tr("interview.scorecard.form.noComment", "No comment")}</p>
                  {isRedFlagged && (
                    <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
                      <Flag className="w-3 h-3" /> {tr("interview.scorecard.form.redFlagReported", "Red flag reported")}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                        {tr("interview.scorecard.form.scoreLabel", "Score")} /5
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        step={0.5}
                        value={entry.score ?? ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEntries((prev) =>
                            prev.map((row) =>
                              row.criterionKey === entry.criterionKey
                                ? { ...row, score: isNaN(val) ? null : Math.min(5, Math.max(1, val)) }
                                : row
                            )
                          );
                        }}
                        className="w-full mt-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                        {tr("interview.scorecard.form.comment", "Comment")}
                      </label>
                      <input
                        type="text"
                        value={entry.comment ?? ""}
                        onChange={(e) => {
                          setEntries((prev) =>
                            prev.map((row) =>
                              row.criterionKey === entry.criterionKey
                                ? { ...row, comment: e.target.value || null }
                                : row
                            )
                          );
                        }}
                        placeholder={tr("interview.scorecard.form.commentPlaceholder", "Observation")}
                        className="w-full mt-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.redFlag}
                      onChange={(e) => {
                        setEntries((prev) =>
                          prev.map((row) =>
                            row.criterionKey === entry.criterionKey
                              ? { ...row, redFlag: e.target.checked }
                              : row
                          )
                        );
                      }}
                      className="rounded border-[var(--border)]"
                    />
                    {tr("interview.scorecard.form.redFlag", "Red flag (vague answer, role mismatch…)")}
                  </label>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase">
          {tr("interview.scorecard.form.globalComment", "Overall comment")}
        </label>
        {readOnly ? (
          <p className="text-sm text-[var(--text-secondary)]">{overallComment || tr("interview.scorecard.form.noComment", "No comment")}</p>
        ) : (
          <input
            type="text"
            value={overallComment ?? ""}
            onChange={(e) => setOverallComment(e.target.value || null)}
            placeholder={tr("interview.scorecard.form.globalCommentPlaceholder", "Synthesis")}
            className="w-full bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-2 pt-2">
          {onSaveDraft && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onSaveDraft(buildDraftEntries(), overallComment)}
              className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
            >
              {saving ? tr("interview.scorecard.form.saving", "Saving...") : tr("interview.scorecard.form.saveDraft", "Save as draft")}
            </button>
          )}
          {onSubmit && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onSubmit(buildDraftEntries(), overallComment)}
              className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? tr("interview.scorecard.form.submitting", "Submitting...") : tr("interview.scorecard.form.submit", "Submit")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
