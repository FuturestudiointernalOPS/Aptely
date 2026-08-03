"use client";

import { CalendarDays, CheckCircle2, Bell, AlertTriangle, ClipboardList, MessageSquareText, Award } from "lucide-react";
import type { InterviewActivityEvent } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";

interface TimelineEventItemProps {
  event: InterviewActivityEvent;
}

function eventIcon(eventType: string) {
  if (eventType.includes("SCHEDULED") || eventType.includes("BOOKING")) {
    return <CalendarDays className="w-4 h-4 text-[var(--accent)]" />;
  }
  if (eventType.includes("QUESTION")) {
    return <ClipboardList className="w-4 h-4 text-sky-400" />;
  }
  if (eventType.includes("DEBRIEF")) {
    return <MessageSquareText className="w-4 h-4 text-amber-400" />;
  }
  if (eventType.includes("SCORE")) {
    return <Award className="w-4 h-4 text-emerald-400" />;
  }
  if (eventType.includes("FAILED")) {
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  }
  if (eventType.includes("REMINDER")) {
    return <Bell className="w-4 h-4 text-violet-400" />;
  }
  return <CheckCircle2 className="w-4 h-4 text-[var(--text-muted)]" />;
}

function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    INTERVIEW_DRAFT_CREATED: "Brouillon créé",
    INTERVIEWERS_ASSIGNED: "Intervenants assignés",
    INTERVIEW_SCHEDULED: "Entretien planifié",
    INTERVIEW_BOOKING_CONFIRMED: "Créneau confirmé",
    QUESTION_PACK_GENERATED: "Pack de questions généré",
    DEBRIEF_SUBMITTED: "Debrief soumis",
    INTERVIEW_SCORE_SUBMITTED: "Score soumis",
    REMINDER_24H_SCHEDULED: "Rappel 24h planifié",
    REMINDER_SENT: "Rappel envoyé",
    REMINDER_FAILED: "Rappel en échec",
  };

  return labels[eventType] ?? eventType;
}

export default function TimelineEventItem({ event }: TimelineEventItemProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  function localizedEventLabel(eventType: string): string {
    const keys: Record<string, string> = {
      INTERVIEW_DRAFT_CREATED: "interview.timeline.event.INTERVIEW_DRAFT_CREATED",
      INTERVIEWERS_ASSIGNED: "interview.timeline.event.INTERVIEWERS_ASSIGNED",
      INTERVIEW_SCHEDULED: "interview.timeline.event.INTERVIEW_SCHEDULED",
      INTERVIEW_BOOKING_CONFIRMED: "interview.timeline.event.INTERVIEW_BOOKING_CONFIRMED",
      QUESTION_PACK_GENERATED: "interview.timeline.event.QUESTION_PACK_GENERATED",
      DEBRIEF_SUBMITTED: "interview.timeline.event.DEBRIEF_SUBMITTED",
      INTERVIEW_SCORE_SUBMITTED: "interview.timeline.event.INTERVIEW_SCORE_SUBMITTED",
      REMINDER_24H_SCHEDULED: "interview.timeline.event.REMINDER_24H_SCHEDULED",
      REMINDER_SENT: "interview.timeline.event.REMINDER_SENT",
      REMINDER_FAILED: "interview.timeline.event.REMINDER_FAILED",
    };
    return tr(keys[eventType] || "", eventLabel(eventType));
  }

  return (
    <div className="relative pl-8 border-l border-[var(--border)] py-3">
      <div className="absolute left-[-10px] top-5 w-5 h-5 rounded-full bg-[var(--bg-deep)] border border-[var(--border)] flex items-center justify-center">
        {eventIcon(event.eventType)}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-bold text-[var(--text-primary)]">{localizedEventLabel(event.eventType)}</p>
          <p className="text-xs text-[var(--text-muted)] whitespace-nowrap">
            {new Date(event.createdAt).toLocaleString(localeTag)}
          </p>
        </div>

        {event.payloadJson && Object.keys(event.payloadJson).length > 0 && (
          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">
            {JSON.stringify(event.payloadJson, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
