"use client";

import InterviewScheduler from "./InterviewScheduler";
import { useRequireInstitution } from "@/lib/auth";
import { useParams, useSearchParams } from "next/navigation";
import { appPath, interviewNotesPath, ROUTES } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

export default function ApplicationInterviewPage() {
  useRequireInstitution();
  const locale = getClientLocale();
  const routeParams = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const rescheduleId = searchParams.get("reschedule");

  if (!id) {
    return null;
  }

  const isReschedule = !!rescheduleId;

  return (
    <InterviewScheduler
      applicationId={id}
      rescheduleInterviewId={rescheduleId ?? undefined}
      backHref={isReschedule && rescheduleId ? interviewNotesPath(id, rescheduleId) : appPath(id)}
      backLabel={isReschedule ? t(locale, "interview.reschedule.backToScorecard", "Retour à la grille de notation") : undefined}
      redirectAfterScheduleTo={ROUTES.company.recruitment.interviews}
    />
  );
}
