"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import InterviewScheduler from "@/app/company/recruitment/applications/[id]/interview/InterviewScheduler";
import { useRequireInstitution } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, appInterviewPath, candidateInterviewsPath } from "@/lib/routes";


function safeRouteId(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const lowered = trimmed.toLowerCase();
  if (lowered === "unknown" || lowered === "undefined" || lowered === "null") return "";
  return trimmed;
}

export default function CandidateInterviewPlanningPage() {
  useRequireInstitution();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const candidateIdParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const candidateId = safeRouteId(candidateIdParam);
  const applicationId = searchParams.get("applicationId") || "";

  const historyHref = useMemo(() => {
    if (!applicationId) {
      if (!candidateId) return ROUTES.company.recruitment.applications;
      return candidateInterviewsPath(candidateId);
    }

    if (!candidateId) return appInterviewPath(applicationId);
    return `${candidateInterviewsPath(candidateId)}?applicationId=${encodeURIComponent(applicationId)}`;
  }, [applicationId, candidateId]);

  if (!applicationId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{tr("candidates.interviews.new.unavailableTitle", "Planning unavailable")}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {tr("candidates.interviews.new.unavailableSubtitle", "No application identifier was provided. Return to history and click on \"Schedule an interview\".")}
          </p>
          <Link
            href={historyHref}
            className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {tr("candidates.interviews.new.backHistory", "Back to history")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <InterviewScheduler
      applicationId={applicationId}
      mode="full"
      backHref={historyHref}
      backLabel={tr("candidates.interviews.new.backInterviewHistory", "Back to interview history")}
      redirectAfterScheduleTo={historyHref}
    />
  );
}
