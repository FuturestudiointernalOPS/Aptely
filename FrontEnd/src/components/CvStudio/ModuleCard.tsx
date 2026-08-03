"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle, Loader2, SkipForward } from "lucide-react";

interface ModuleCardProps {
  moduleKey: string;
  label: string;
  description: string;
  status: string;
  score: number | null;
  resultJson: Record<string, unknown> | null;
  t: (key: string, fallback?: string) => string;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 80
      ? "var(--success)"
      : score >= 60
        ? "var(--accent)"
        : score >= 40
          ? "var(--warning)"
          : "var(--error)";

  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-xs font-bold text-white min-w-[36px] h-[36px] px-1"
      style={{ backgroundColor: color }}
    >
      {score}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle size={16} style={{ color: "var(--success)" }} />;
    case "failed":
      return <XCircle size={16} style={{ color: "var(--error)" }} />;
    case "processing":
      return <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />;
    case "skipped":
      return <SkipForward size={16} style={{ color: "var(--text-muted)" }} />;
    default:
      return <AlertTriangle size={16} style={{ color: "var(--text-muted)" }} />;
  }
}

export default function ModuleCard({
  moduleKey: _moduleKey,
  label,
  description,
  status,
  score,
  resultJson,
  t,
}: ModuleCardProps) {
  const [expanded, setExpanded] = useState(false);

  const rawIssues = resultJson?.issues ?? resultJson?.problems;
  const issues = Array.isArray(rawIssues) ? rawIssues as Array<{ text: string; severity: string }> : [];

  const rawSuggestions = resultJson?.suggestions ?? resultJson?.recommendations;
  const suggestions = Array.isArray(rawSuggestions) ? rawSuggestions as string[] : [];

  const rawSpelling = resultJson?.spelling_errors;
  const spellingErrors = Array.isArray(rawSpelling) ? rawSpelling as Array<{ message: string }> : [];
  const rawGrammar = resultJson?.grammar_errors;
  const grammarErrors = Array.isArray(rawGrammar) ? rawGrammar as Array<{ message: string }> : [];

  return (
    <div
      className="rounded-xl border p-4 transition-colors"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <button
        onClick={() => status === "completed" && setExpanded(!expanded)}
        className="flex w-full items-center gap-3 text-left disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={status !== "completed"}
        aria-expanded={expanded}
        aria-label={`${label}: ${status === "completed" ? `score ${score}` : status}`}
      >
        <StatusIcon status={status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
              {label}
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {description}
          </span>
        </div>
        <ScoreBadge score={score} />
        {status === "completed" && (
          expanded ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
        )}
      </button>

      {status === "failed" && (
        <p className="mt-2 ml-7 text-xs" style={{ color: "var(--error)" }}>
          {t("cvStudio.moduleFailed", "Analysis failed — will retry on next run")}
        </p>
      )}
      {status === "skipped" && (
        <p className="mt-2 ml-7 text-xs" style={{ color: "var(--text-muted)" }}>
          {t("cvStudio.moduleSkipped", "Module skipped — not applicable")}
        </p>
      )}

      {expanded && resultJson && (
        <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          {resultJson.summary != null && (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {String(resultJson.summary)}
            </p>
          )}

          {issues.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {t("cvStudio.issues", "Problèmes")}
              </h4>
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span
                      className="inline-block w-2 h-2 rounded-full mt-1 shrink-0"
                      style={{
                        backgroundColor:
                          issue.severity === "high"
                            ? "var(--error)"
                            : issue.severity === "medium"
                              ? "var(--warning)"
                              : "var(--success)",
                      }}
                    />
                    {issue.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {spellingErrors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {t("cvStudio.spellingErrors", "Fautes d'orthographe")} ({spellingErrors.length})
              </h4>
              <ul className="space-y-1">
                {spellingErrors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {grammarErrors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {t("cvStudio.grammarErrors", "Erreurs grammaticales")} ({grammarErrors.length})
              </h4>
              <ul className="space-y-1">
                {grammarErrors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {t("cvStudio.suggestions", "Suggestions")}
              </h4>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    → {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
