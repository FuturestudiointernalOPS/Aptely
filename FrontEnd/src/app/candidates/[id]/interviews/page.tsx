"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Clock, CalendarPlus, Eye } from "lucide-react";
import { useRequireInstitution } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import {

  getApplicationById,
  getCandidateInterviewHistoryEnriched,
  type CandidateInterviewHistoryEnrichedItem,
} from "@/lib/api";
import { ROUTES, interviewNotesPath, appInterviewPath, candidateInterviewsPath, candidateInterviewsNewPath } from "@/lib/routes";

function safeRouteId(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const lowered = trimmed.toLowerCase();
  if (lowered === "unknown" || lowered === "undefined" || lowered === "null") return "";
  return trimmed;
}

function statusBadge(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-400/10 text-emerald-400";
    case "SCHEDULED":
      return "bg-blue-400/10 text-blue-400";
    case "CANCELLED":
      return "bg-red-400/10 text-red-400";
    default:
      return "bg-[var(--bg-surface)] text-[var(--text-muted)]";
  }
}

export default function CandidateInterviewsHistoryPage() {
  useRequireInstitution();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const candidateIdParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const candidateId = safeRouteId(candidateIdParam);
  const initialApplicationId = searchParams.get("applicationId") || "";
  const refreshToken = searchParams.get("_t") || "";

  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState(tr("candidates.interviews.candidateFallback", "Candidate"));
  const [history, setHistory] = useState<CandidateInterviewHistoryEnrichedItem[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!candidateId && !initialApplicationId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      let effectiveCandidateId = candidateId;
      let candidateLabel = tr("candidates.interviews.candidateFallback", "Candidate");

      if (initialApplicationId) {
        const appData = await getApplicationById(initialApplicationId);
        const resolvedCandidateId =
          appData?.candidateId || appData?.candidate_id || appData?.profiles?.id || null;

        if (typeof resolvedCandidateId === "string") {
          const safeResolvedCandidateId = safeRouteId(resolvedCandidateId);
          if (safeResolvedCandidateId) {
            effectiveCandidateId = safeResolvedCandidateId;
          }
        }

        candidateLabel =
          appData?.candidateName || appData?.guest_name || appData?.profiles?.full_name || candidateLabel;
      }

      if (!effectiveCandidateId) {
        setCandidateName(candidateLabel);
        setHistory([]);
        setLoading(false);
        return;
      }

      const enriched = await getCandidateInterviewHistoryEnriched(effectiveCandidateId);
      setCandidateName(candidateLabel);

      const sorted = [...enriched].sort((a, b) => {
        const aDate = new Date(a.interview.scheduledAt || a.interview.createdAt || 0).getTime();
        const bDate = new Date(b.interview.scheduledAt || b.interview.createdAt || 0).getTime();
        return bDate - aDate;
      });
      setHistory(sorted);
      setLoading(false);
    };

    load();
  }, [candidateId, initialApplicationId, refreshToken]);

  const suggestedApplicationId = useMemo(() => {
    if (initialApplicationId) return initialApplicationId;
    return history[0]?.interview.applicationId || "";
  }, [history, initialApplicationId]);

  if (!candidateId && !initialApplicationId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-2">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{tr("candidates.interviews.unavailableTitle", "History unavailable")}</h1>
          <p className="text-sm text-[var(--text-muted)]">{tr("candidates.interviews.invalidCandidateId", "Invalid or missing candidate identifier.")}</p>
          <Link
            href={ROUTES.company.recruitment.applications}
            className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {tr("candidates.interviews.backToApplications", "Back to applications")}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">{tr("candidates.interviews.loading", "Loading interview history...")}</div>
      </div>
    );
  }

  const planningHref = suggestedApplicationId
    ? candidateId
      ? `${candidateInterviewsNewPath(candidateId)}?applicationId=${encodeURIComponent(suggestedApplicationId)}`
      : appInterviewPath(suggestedApplicationId)
    : candidateId
    ? candidateInterviewsNewPath(candidateId)
    : ROUTES.company.recruitment.applications;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("candidates.interviews.history", "Candidate history")}</p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{tr("candidates.interviews.of", "Interviews of")} {candidateName}</h1>
          <p className="text-sm text-[var(--text-muted)]">{tr("candidates.interviews.subtitle", "All past and scheduled interviews.")}</p>
        </div>

        <Link
          href={planningHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-aptely-orange px-5 py-3 text-sm font-bold text-white hover:bg-aptely-orange-soft"
        >
          <CalendarPlus className="w-4 h-4" />
          {tr("candidates.interviews.schedule", "Schedule an interview")}
        </Link>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-aptely-orange" />
          <p className="text-sm font-bold text-[var(--text-primary)]">{tr("candidates.interviews.list", "Interview list")} ({history.length})</p>
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{tr("candidates.interviews.emptyTitle", "No interview for this candidate.")}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{tr("candidates.interviews.emptySubtitle", "Use the button above to schedule the first interview.")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => {
              const scheduledAt = item.interview.scheduledAt;
              const interviewLabel = item.interview.name || tr("interviews.common.interview", "Interview");
              return (
                <div key={item.interview.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{interviewLabel}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusBadge(item.interview.status)}`}>
                          {item.interview.status}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-[var(--bg-surface)] text-[var(--text-muted)]">
                          {item.interview.interviewType || tr("candidates.interviews.custom", "CUSTOM")}
                        </span>
                      </div>
                    </div>

                    {item.interview.applicationId && item.interview.id && (
                      <Link
                        href={interviewNotesPath(item.interview.applicationId, item.interview.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {tr("candidates.interviews.notes", "Notes")}
                      </Link>
                    )}
                  </div>

                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    {scheduledAt
                      ? `${tr("candidates.interviews.scheduledOn", "Scheduled on")} ${new Date(scheduledAt).toLocaleString(locale === "en" ? "en-US" : "fr-FR")}`
                      : item.interview.createdAt
                      ? `${tr("candidates.interviews.createdOn", "Created on")} ${new Date(item.interview.createdAt).toLocaleString(locale === "en" ? "en-US" : "fr-FR")}`
                      : tr("candidates.interviews.unknownDate", "Unknown date")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
