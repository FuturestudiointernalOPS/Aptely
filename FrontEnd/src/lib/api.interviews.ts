import { apiFetch, isApiSuccess } from "./apiHelper";
import type {
  CandidateInterviewHistoryEnrichedItem,
  DebriefAnswer,
  GeneratedQuestion,
  Interview,
  InstitutionInterviewListItem,
  InterviewActivityEvent,
  InterviewAvailabilityQuery,
  InterviewInterviewerScore,
  InterviewQuestionTemplate,
  InterviewReminderStatus,
  InterviewScorecard,
  InterviewScorecardsList,
  InterviewScoresSummary,
  InterviewSlot,
  InterviewerQuestionPack,
  ScorecardCriterionInput,
  ScorecardStatus,
} from "./api.types";
import {
  API,
  mkApiPath,
  interviewQuestionTemplatesDefaultApi,
  interviewsAssignedToMeApi,
  interviewsInstitutionListApi,
  communicationsDispatchDecisionApi,
} from "@/lib/routes";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeEntityId(value: unknown): string {
  const raw = asNonEmptyString(value);
  if (!raw) return "";

  const lowered = raw.toLowerCase();
  if (lowered === "unknown" || lowered === "undefined" || lowered === "null") {
    return "";
  }

  return raw;
}

export async function createInterview(payload: {
  applicationId: string;
  name: string;
  interviewType: string;
  durationMinutes?: number;
  timezone?: string;
  meetingProvider?: "GOOGLE_MEET" | "TEAMS" | "MANUAL" | "JITSI";
  interviewerProfiles?: Array<{
    userId: string;
    profileText?: string;
    evaluationWeight: number;
    role?: "MANDATORY" | "SECONDARY";
  }>;
  secondaryCollectiveWeight?: number | null;
}): Promise<Interview | null> {
  const res = await apiFetch(API.interviews, "HR", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // A 403 comes back as a truthy { isPermissionError } object: not a success.
  if (!isApiSuccess(res)) return null;

  return {
    id: res.id,
    applicationId: res.applicationId,
    name: res.name,
    interviewType: res.interviewType,
    status: res.status,
    scheduledAt: res.scheduledAt ?? null,
    meetingLink: res.meetingLink ?? null,
    meetingLocation: res.meetingLocation ?? null,
    bookingToken: res.bookingToken ?? null,
    notes: res.notes ?? null,
    participants: Array.isArray(res.participants)
      ? res.participants.map((it: any) => ({
          userId: it.userId ?? it.user_id,
          profileText: it.profileText ?? it.profile_text,
          evaluationWeight: Number(it.evaluationWeight ?? it.evaluation_weight),
        }))
      : [],
    createdAt: res.createdAt ?? res.created_at,
    updatedAt: res.updatedAt ?? res.updated_at,
  };
}

export async function assignInterviewers(
  interviewId: string,
  interviewerProfiles: Array<{
    userId: string;
    profileText?: string;
    evaluationWeight: number;
    role?: "MANDATORY" | "SECONDARY";
  }>,
  secondaryCollectiveWeight: number | null
): Promise<Interview | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/interviewers`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ interviewerProfiles, secondaryCollectiveWeight }),
  });

  if (!isApiSuccess(res)) return null;

  return {
    id: res.id ?? interviewId,
    applicationId: res.applicationId,
    name: res.name,
    interviewType: res.interviewType,
    status: res.status,
    scheduledAt: res.scheduledAt ?? null,
    meetingLink: res.meetingLink ?? null,
    meetingLocation: res.meetingLocation ?? null,
    bookingToken: res.bookingToken ?? null,
    notes: res.notes ?? null,
    participants: Array.isArray(res.participants)
      ? res.participants.map((it: any) => ({
          userId: it.userId ?? it.user_id,
          profileText: it.profileText ?? it.profile_text,
          evaluationWeight: Number(it.evaluationWeight ?? it.evaluation_weight),
        }))
      : [],
    createdAt: res.createdAt ?? res.created_at,
    updatedAt: res.updatedAt ?? res.updated_at,
  };
}

export async function getInterviewAvailability(
  interviewId: string,
  query: InterviewAvailabilityQuery
): Promise<{ slots: InterviewSlot[]; connectedParticipants: number; totalParticipants: number }> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    slotMinutes: String(query.slotMinutes ?? 30),
    timezone: query.timezone ?? "UTC",
    workingHoursStart: String(query.workingHoursStart ?? 9),
    workingHoursEnd: String(query.workingHoursEnd ?? 18),
  });

  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/availability?${params.toString()}`), "HR");
  const slots = Array.isArray(res?.slots)
    ? res.slots.map((s: any) => ({
        start: s.start,
        end: s.end,
        availableParticipants: Array.isArray(s.availableParticipants) ? s.availableParticipants : undefined,
        unavailableParticipants: Array.isArray(s.unavailableParticipants) ? s.unavailableParticipants : undefined,
        availableMandatory: Array.isArray(s.availableMandatory) ? s.availableMandatory : undefined,
        unavailableMandatory: Array.isArray(s.unavailableMandatory) ? s.unavailableMandatory : undefined,
        availableSecondary: Array.isArray(s.availableSecondary) ? s.availableSecondary : undefined,
        unavailableSecondary: Array.isArray(s.unavailableSecondary) ? s.unavailableSecondary : undefined,
        isValid: typeof s.isValid === "boolean" ? s.isValid : undefined,
      }))
    : [];
  return {
    slots,
    connectedParticipants: res?.connectedParticipants ?? 0,
    totalParticipants: res?.totalParticipants ?? 0,
  };
}

export async function scheduleInterview(
  interviewId: string,
  payload: { start: string; timezone: string; meetingLocation?: string; manualMeetingUrl?: string }
): Promise<Interview | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/schedule`), "HR", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!isApiSuccess(res)) return null;

  return {
    id: res.id ?? interviewId,
    applicationId: res.applicationId,
    name: res.name,
    interviewType: res.interviewType,
    status: res.status,
    scheduledAt: res.scheduledAt ?? null,
    meetingLink: res.meetingLink ?? null,
    meetingLocation: res.meetingLocation ?? null,
    bookingToken: res.bookingToken ?? null,
    notes: res.notes ?? null,
    participants: Array.isArray(res.participants)
      ? res.participants.map((it: any) => ({
          userId: it.userId ?? it.user_id,
          profileText: it.profileText ?? it.profile_text,
          evaluationWeight: Number(it.evaluationWeight ?? it.evaluation_weight),
        }))
      : [],
    createdAt: res.createdAt ?? res.created_at,
    updatedAt: res.updatedAt ?? res.updated_at,
  };
}

export async function generateDuringInterviewQuestions(
  interviewId: string,
  payload?: { questionsCount?: number; locale?: string }
): Promise<GeneratedQuestion[]> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/questions/generate-during`), "HR", {
    method: "POST",
    body: JSON.stringify({ questionsCount: payload?.questionsCount ?? 6 }),
    headers: payload?.locale ? { "x-locale": payload.locale } : undefined,
  } as any);

  const rows = Array.isArray(res?.generated) ? res.generated : [];
  return rows.map((q: any) => ({
    id: q.id,
    interviewId: q.interviewId ?? q.interview_id ?? interviewId,
    interviewerId: q.interviewerId ?? q.interviewer_id ?? "",
    questionType: q.questionType ?? q.question_type ?? "DURING_INTERVIEW",
    questionText: q.questionText ?? q.question_text ?? "",
    source: q.source ?? "unknown",
    createdAt: q.createdAt ?? q.created_at ?? new Date().toISOString(),
  }));
}

export async function getInterviewerQuestionPack(
  interviewId: string,
  interviewerId: string
): Promise<InterviewerQuestionPack | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/questions/by-interviewer/${interviewerId}`), "HR", {
    method: "GET",
  });
  if (!res) return null;

  const mapQuestion = (q: any): GeneratedQuestion => ({
    id: q.id,
    interviewId: q.interviewId ?? q.interview_id ?? interviewId,
    interviewerId: q.interviewerId ?? q.interviewer_id ?? interviewerId,
    questionType: q.questionType ?? q.question_type ?? "DURING_INTERVIEW",
    questionText: q.questionText ?? q.question_text ?? "",
    source: q.source ?? "unknown",
    createdAt: q.createdAt ?? q.created_at ?? new Date().toISOString(),
  });

  return {
    interviewerId: res.interviewerId ?? res.interviewer_id ?? interviewerId,
    duringQuestions: Array.isArray(res.duringQuestions ?? res.during_questions)
      ? (res.duringQuestions ?? res.during_questions).map(mapQuestion)
      : [],
    debriefQuestions: Array.isArray(res.debriefQuestions ?? res.debrief_questions)
      ? (res.debriefQuestions ?? res.debrief_questions).map(mapQuestion)
      : [],
    debriefAnswers: Array.isArray(res.debriefAnswers ?? res.debrief_answers)
      ? (res.debriefAnswers ?? res.debrief_answers).map((a: any) => ({
          id: a.id,
          questionKey: a.questionKey ?? a.question_key ?? "",
          scoreOver10: Number(a.scoreOver10 ?? a.score_over_10 ?? 0),
          comment: a.comment ?? null,
          createdAt: a.createdAt ?? a.created_at ?? new Date().toISOString(),
        }))
      : [],
    defaultTemplate: res.defaultTemplate ?? res.default_template
      ? {
          id: (res.defaultTemplate ?? res.default_template).id,
          templateKey: (res.defaultTemplate ?? res.default_template).templateKey
            ?? (res.defaultTemplate ?? res.default_template).template_key,
          title: (res.defaultTemplate ?? res.default_template).title,
          markdownContent: (res.defaultTemplate ?? res.default_template).markdownContent
            ?? (res.defaultTemplate ?? res.default_template).markdown_content
            ?? "",
          isDefault: Boolean((res.defaultTemplate ?? res.default_template).isDefault
            ?? (res.defaultTemplate ?? res.default_template).is_default),
          createdAt: (res.defaultTemplate ?? res.default_template).createdAt
            ?? (res.defaultTemplate ?? res.default_template).created_at
            ?? new Date().toISOString(),
        }
      : null,
  };
}

export async function getDefaultInterviewQuestionTemplate(): Promise<InterviewQuestionTemplate | null> {
  const res = await apiFetch(interviewQuestionTemplatesDefaultApi, "HR", {
    method: "GET",
  });
  if (!res) return null;

  return {
    id: res.id,
    templateKey: res.templateKey ?? res.template_key ?? "default_interview_template",
    title: res.title ?? "Default Interview Template",
    markdownContent: res.markdownContent ?? res.markdown_content ?? "",
    isDefault: Boolean(res.isDefault ?? res.is_default),
    createdAt: res.createdAt ?? res.created_at ?? new Date().toISOString(),
  };
}

export async function submitDebriefForm(
  interviewId: string,
  interviewerId: string,
  answers: Array<{ questionKey: string; scoreOver10: number; comment?: string }>
): Promise<DebriefAnswer[]> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/debrief-forms/${interviewerId}`), "HR", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });

  const rows = Array.isArray(res?.answers) ? res.answers : [];
  return rows.map((a: any) => ({
    id: a.id,
    questionKey: a.questionKey ?? a.question_key ?? "",
    scoreOver10: Number(a.scoreOver10 ?? a.score_over_10 ?? 0),
    comment: a.comment ?? null,
    createdAt: a.createdAt ?? a.created_at ?? new Date().toISOString(),
  }));
}

export async function submitInterviewerScore(
  interviewId: string,
  interviewerId: string,
  payload: {
    criteriaScores: ScorecardCriterionInput[];
    globalScoreOver10: number;
    comment?: string;
  }
): Promise<InterviewInterviewerScore | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scores/${interviewerId}`), "HR", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res) return null;

  return {
    id: res.id,
    interviewId: res.interviewId ?? res.interview_id ?? interviewId,
    interviewerId: res.interviewerId ?? res.interviewer_id ?? interviewerId,
    globalScoreOver10: Number(res.globalScoreOver10 ?? res.global_score_over_10 ?? 0),
    weightedContribution: Number(res.weightedContribution ?? res.weighted_contribution ?? 0),
    comment: res.comment ?? null,
    submittedAt: res.submittedAt ?? res.submitted_at ?? new Date().toISOString(),
  };
}

export async function getInterviewScoresSummary(
  interviewId: string
): Promise<InterviewScoresSummary | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scores/summary`), "HR", {
    method: "GET",
  });

  if (!res) return null;

  const contributions = Array.isArray(res.contributions)
    ? res.contributions
    : Array.isArray(res.details?.contributions)
    ? res.details.contributions
    : [];

  return {
    interviewId: res.interviewId ?? res.interview_id ?? interviewId,
    totalSubmitted: Number(res.totalSubmitted ?? res.total_submitted ?? 0),
    weightedScoreOver10: Number(res.weightedScoreOver10 ?? res.weighted_score_over_10 ?? 0),
    computedAt: res.computedAt ?? res.computed_at ?? new Date().toISOString(),
    contributions: contributions.map((item: any) => ({
      interviewerId: item.interviewerId ?? item.interviewer_id ?? "",
      weight: Number(item.weight ?? 0),
      scoreOver10: item.scoreOver10 === null || item.score_over_10 === null
        ? null
        : Number(item.scoreOver10 ?? item.score_over_10 ?? 0),
      weightedContribution: Number(item.weightedContribution ?? item.weighted_contribution ?? 0),
      submitted: Boolean(item.submitted),
    })),
    details: {
      formula: res.details?.formula ?? "sum(score_over_10 * evaluation_weight) / 100",
      totalParticipants: Number(res.details?.totalParticipants ?? res.details?.total_participants ?? 0),
    },
  };
}

export async function getBookingByToken(token: string): Promise<{
  interviewId?: string;
  roleTitle?: string;
  status?: string;
  slots: InterviewSlot[];
} | null> {
  const res = await apiFetch(mkApiPath(`/interviews/booking/${token}`), "none");
  if (!res) return null;
  return {
    interviewId: res.interviewId ?? res.id,
    roleTitle: res.roleTitle,
    status: res.status,
    slots: Array.isArray(res.slots)
      ? res.slots.map((s: any) => ({ start: s.start, end: s.end }))
      : [],
  };
}

export async function confirmBooking(
  token: string,
  payload: { start: string; timezone: string }
): Promise<{
  success: boolean;
  meetingLink?: string | null;
  reason?: "INVALID_START" | "NO_AVAILABLE_SLOT" | "SLOT_NO_LONGER_AVAILABLE";
  message?: string;
  availableSlots?: InterviewSlot[];
}>
{
  const res = await apiFetch(mkApiPath(`/interviews/booking/${token}/confirm`), "none", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res) {
    return {
      success: false,
      reason: "NO_AVAILABLE_SLOT",
      message: "Unable to confirm this slot right now.",
      availableSlots: [],
    };
  }

  const refreshedSlots = Array.isArray(res.availableSlots)
    ? res.availableSlots.map((s: any) => ({ start: s.start, end: s.end }))
    : [];

  return {
    success: Boolean(res.success),
    meetingLink: res.meetingLink ?? null,
    reason: res.reason,
    message: res.message,
    availableSlots: refreshedSlots,
  };
}

export async function updateApplicationStatus(applicationId: string, status: string): Promise<boolean> {
  try {
    const res = await apiFetch(mkApiPath(`/applications/${applicationId}/status`), "HR", {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    // A 401/403 comes back as a truthy error object: only a real success counts,
    // otherwise the role page keeps an optimistic status that was never saved.
    return isApiSuccess(res);
  } catch (err) {
    console.error("Failed to update application status", err);
    return false;
  }
}

export async function relaunchApplicationMatching(applicationId: string): Promise<boolean> {
  try {
    const res = await apiFetch(mkApiPath(`/applications/${applicationId}/relaunch-matching`), "HR", {
      method: "POST",
    });
    return isApiSuccess(res);
  } catch (err) {
    console.error("Failed to relaunch application matching", err);
    return false;
  }
}

export async function getCandidateInterviewHistory(candidateId: string): Promise<Interview[]> {
  const safeCandidateId = safeEntityId(candidateId);
  if (!safeCandidateId) return [];

  const res = await apiFetch(mkApiPath(`/candidates/${safeCandidateId}/interviews/history`), "HR", {
    cache: "no-store",
  });
  if (!res || !Array.isArray(res.history)) return [];

  return res.history.map((item: any) => ({
    id: item.id,
    applicationId: item.applicationId,
    name: item.name,
    interviewType: item.interviewType,
    status: item.status,
    scheduledAt: item.scheduledAt ?? null,
    meetingLink: item.meetingLink ?? null,
    meetingLocation: item.meetingLocation ?? null,
    bookingToken: item.bookingToken ?? null,
    notes: item.notes ?? null,
    participants: Array.isArray(item.participants)
      ? item.participants.map((it: any) => ({
          userId: it.userId ?? it.user_id,
          profileText: it.profileText ?? it.profile_text,
          evaluationWeight: Number(it.evaluationWeight ?? it.evaluation_weight),
        }))
      : [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
}

export async function getCandidateInterviewHistoryEnriched(
  candidateId: string
): Promise<CandidateInterviewHistoryEnrichedItem[]> {
  const safeCandidateId = safeEntityId(candidateId);
  if (!safeCandidateId) return [];

  const res = await apiFetch(mkApiPath(`/candidates/${safeCandidateId}/interviews/history/enriched`), "HR", {
    cache: "no-store",
  });

  if (!res || !Array.isArray(res.history)) return [];

  return res.history.map((item: any) => ({
    interview: {
      id: item.interview?.id,
      applicationId: item.interview?.applicationId,
      name: item.interview?.name,
      interviewType: item.interview?.interviewType,
      status: item.interview?.status,
      scheduledAt: item.interview?.scheduledAt ?? null,
      meetingLink: item.interview?.meetingLink ?? null,
      meetingLocation: item.interview?.meetingLocation ?? null,
      bookingToken: item.interview?.bookingToken ?? null,
      notes: item.interview?.notes ?? null,
      participants: Array.isArray(item.interview?.participants)
        ? item.interview.participants.map((p: any) => ({
            userId: p.userId ?? p.user_id,
            profileText: p.profileText ?? p.profile_text,
            evaluationWeight: Number(p.evaluationWeight ?? p.evaluation_weight ?? 0),
          }))
        : [],
      createdAt: item.interview?.createdAt,
      updatedAt: item.interview?.updatedAt,
    },
    scoreSummary: item.scoreSummary
      ? {
          interviewId: item.scoreSummary.interviewId ?? item.scoreSummary.interview_id,
          totalSubmitted: Number(item.scoreSummary.totalSubmitted ?? item.scoreSummary.total_submitted ?? 0),
          weightedScoreOver10: Number(item.scoreSummary.weightedScoreOver10 ?? item.scoreSummary.weighted_score_over_10 ?? 0),
          computedAt: item.scoreSummary.computedAt ?? item.scoreSummary.computed_at,
          contributions: Array.isArray(item.scoreSummary.contributions)
            ? item.scoreSummary.contributions.map((c: any) => ({
                interviewerId: c.interviewerId ?? c.interviewer_id,
                weight: Number(c.weight ?? 0),
                scoreOver10: c.scoreOver10 === null ? null : Number(c.scoreOver10 ?? c.score_over_10 ?? 0),
                weightedContribution: Number(c.weightedContribution ?? c.weighted_contribution ?? 0),
                submitted: Boolean(c.submitted),
              }))
            : [],
          details: {
            formula: item.scoreSummary.details?.formula ?? "sum(score_over_10 * evaluation_weight) / 100",
            totalParticipants: Number(item.scoreSummary.details?.totalParticipants ?? item.scoreSummary.details?.total_participants ?? 0),
          },
        }
      : null,
    myScorecardStatus: (item.myScorecardStatus ?? "NONE") as ScorecardStatus,
  }));
}

export async function getApplicationInterviewHistoryEnriched(
  applicationId: string
): Promise<CandidateInterviewHistoryEnrichedItem[]> {
  const res = await apiFetch(mkApiPath(`/interviews/history/application/${applicationId}/enriched`), "HR", {
    cache: "no-store",
  });

  if (!res || !Array.isArray(res.history)) return [];

  return res.history.map((item: any) => ({
    interview: {
      id: item.interview?.id,
      applicationId: item.interview?.applicationId,
      name: item.interview?.name,
      interviewType: item.interview?.interviewType,
      status: item.interview?.status,
      scheduledAt: item.interview?.scheduledAt ?? null,
      meetingLink: item.interview?.meetingLink ?? null,
      meetingLocation: item.interview?.meetingLocation ?? null,
      bookingToken: item.interview?.bookingToken ?? null,
      notes: item.interview?.notes ?? null,
      participants: Array.isArray(item.interview?.participants)
        ? item.interview.participants.map((p: any) => ({
            userId: p.userId ?? p.user_id,
            profileText: p.profileText ?? p.profile_text,
            evaluationWeight: Number(p.evaluationWeight ?? p.evaluation_weight ?? 0),
          }))
        : [],
      createdAt: item.interview?.createdAt,
      updatedAt: item.interview?.updatedAt,
    },
    scoreSummary: item.scoreSummary
      ? {
          interviewId: item.scoreSummary.interviewId ?? item.scoreSummary.interview_id,
          totalSubmitted: Number(item.scoreSummary.totalSubmitted ?? item.scoreSummary.total_submitted ?? 0),
          weightedScoreOver10: Number(item.scoreSummary.weightedScoreOver10 ?? item.scoreSummary.weighted_score_over_10 ?? 0),
          computedAt: item.scoreSummary.computedAt ?? item.scoreSummary.computed_at,
          contributions: Array.isArray(item.scoreSummary.contributions)
            ? item.scoreSummary.contributions.map((c: any) => ({
                interviewerId: c.interviewerId ?? c.interviewer_id,
                weight: Number(c.weight ?? 0),
                scoreOver10: c.scoreOver10 === null ? null : Number(c.scoreOver10 ?? c.score_over_10 ?? 0),
                weightedContribution: Number(c.weightedContribution ?? c.weighted_contribution ?? 0),
                submitted: Boolean(c.submitted),
              }))
            : [],
          details: {
            formula: item.scoreSummary.details?.formula ?? "sum(score_over_10 * evaluation_weight) / 100",
            totalParticipants: Number(item.scoreSummary.details?.totalParticipants ?? item.scoreSummary.details?.total_participants ?? 0),
          },
        }
      : null,
    myScorecardStatus: (item.myScorecardStatus ?? "NONE") as ScorecardStatus,
  }));
}

export async function getInterviewScorecards(interviewId: string): Promise<InterviewScorecardsList | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scorecards`), "HR", { method: "GET" });
  if (!res) return null;

  const scorecards: InterviewScorecard[] = Array.isArray(res.scorecards)
    ? res.scorecards.map((card: any) => ({
        id: card.id,
        interviewId: card.interviewId ?? card.interview_id,
        reviewerId: card.reviewerId ?? card.reviewer_id,
        reviewerName: card.reviewerName ?? card.reviewer_name ?? (card.reviewerId ?? card.reviewer_id),
        status: card.status,
        overallComment: card.overallComment ?? card.comment ?? null,
        submittedAt: card.submittedAt ?? card.submitted_at ?? null,
        isModifiedAfterSubmit: Boolean(card.isModifiedAfterSubmit ?? card.is_modified_after_submit),
        archivedAt: card.archivedAt ?? card.archived_at ?? null,
        templateSnapshot: {
          templateId: card.templateSnapshot?.templateId ?? card.template_snapshot?.template_id ?? null,
          templateName: card.templateSnapshot?.templateName ?? card.template_snapshot?.template_name ?? "Template entretien",
          roleId: card.templateSnapshot?.roleId ?? card.template_snapshot?.role_id ?? null,
          criteria: Array.isArray(card.templateSnapshot?.criteria)
            ? card.templateSnapshot.criteria.map((criterion: any) => ({
                criterionKey: criterion.criterionKey ?? criterion.criterion_key,
                label: criterion.label,
                weight: criterion.weight === null || criterion.weight === undefined ? null : Number(criterion.weight),
                position: Number(criterion.position ?? 0),
              }))
            : [],
        },
        entries: Array.isArray(card.entries)
          ? card.entries.map((entry: any) => ({
              id: entry.id,
              criterionKey: entry.criterionKey ?? entry.criterion_key,
              criterionLabel: entry.criterionLabel ?? entry.criterion_label,
              weight: entry.weight === null || entry.weight === undefined ? null : Number(entry.weight),
              score: entry.score === null || entry.score === undefined ? null : Number(entry.score),
              comment: entry.comment ?? null,
              redFlag: Boolean(entry.redFlag ?? entry.red_flag ?? false),
              createdAt: entry.createdAt ?? entry.created_at,
              updatedAt: entry.updatedAt ?? entry.updated_at,
            }))
          : [],
        createdAt: card.createdAt ?? card.created_at,
        updatedAt: card.updatedAt ?? card.updated_at,
      }))
    : [];

  return {
    scorecards,
    visibility: {
      myReviewerId: String(res.visibility?.myReviewerId ?? res.visibility?.my_reviewer_id ?? ""),
      myScorecardStatus: (res.visibility?.myScorecardStatus ?? "NONE") as ScorecardStatus,
      canViewOthers: Boolean(res.visibility?.canViewOthers),
      canReview: Boolean(res.visibility?.canReview),
    },
  };
}

export async function createInterviewScorecard(interviewId: string): Promise<InterviewScorecard | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scorecards`), "HR", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const list = await getInterviewScorecards(interviewId);
  if (!res) {
    // 409 already exists — return the existing scorecard for this reviewer
    return list?.scorecards.find((card) => card.reviewerId === list.visibility.myReviewerId) ?? null;
  }
  return list?.scorecards.find((card) => card.id === (res.id ?? res.scorecardId)) ?? null;
}

export async function updateInterviewScorecard(
  interviewId: string,
  scorecardId: string,
  payload: {
    entries?: Array<{ criterionKey: string; score?: number | null; comment?: string | null; redFlag?: boolean }>;
    overallComment?: string | null;
    archive?: boolean;
  }
): Promise<InterviewScorecard | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scorecards/${scorecardId}`), "HR", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res) return null;

  const list = await getInterviewScorecards(interviewId);
  return list?.scorecards.find((card) => card.id === scorecardId) ?? null;
}

export async function submitInterviewScorecard(
  interviewId: string,
  scorecardId: string
): Promise<InterviewScorecard | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scorecards/${scorecardId}/submit`), "HR", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res) return null;

  const list = await getInterviewScorecards(interviewId);
  return list?.scorecards.find((card) => card.id === scorecardId) ?? null;
}

export async function updateInterviewScorecardTemplate(
  interviewId: string,
  payload: {
    templateName?: string;
    criteria: Array<{ criterionKey: string; label: string; weight?: number | null; position?: number }>;
  }
): Promise<{ templateName: string; criteria: Array<{ criterionKey: string; label: string; weight: number | null; position: number }> } | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scorecard-template`), "HR", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res || !res.templateName) return null;
  return {
    templateName: res.templateName as string,
    criteria: Array.isArray(res.criteria) ? res.criteria.map((c: any) => ({
      criterionKey: c.criterionKey ?? c.criterion_key,
      label: c.label,
      weight: c.weight === null || c.weight === undefined ? null : Number(c.weight),
      position: Number(c.position ?? 0),
    })) : [],
  };
}

export async function getInterviewScorecardTemplate(
  interviewId: string
): Promise<{ templateName: string; criteria: Array<{ criterionKey: string; label: string; weight: number | null; position: number }> } | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/scorecard-template`), "HR", { method: "GET" });
  if (!res || !res.templateName) return null;
  return {
    templateName: res.templateName as string,
    criteria: Array.isArray(res.criteria) ? res.criteria.map((c: any) => ({
      criterionKey: c.criterionKey ?? c.criterion_key,
      label: c.label,
      weight: c.weight === null || c.weight === undefined ? null : Number(c.weight),
      position: Number(c.position ?? 0),
    })) : [],
  };
}

export async function getInterviewActivityFeed(
  interviewId: string,
  query?: { eventTypes?: string[]; page?: number; pageSize?: number }
): Promise<{
  events: InterviewActivityEvent[];
  reminders: InterviewReminderStatus | null;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
} | null> {
  const params = new URLSearchParams();
  if (Array.isArray(query?.eventTypes) && query?.eventTypes.length > 0) {
    params.set("eventTypes", query.eventTypes.join(","));
  }
  if (query?.page) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/activity${suffix}`), "HR", { method: "GET" });
  if (!res) return null;

  const events = Array.isArray(res.events)
    ? res.events.map((event: any) => ({
        id: event.id,
        interviewId: event.interviewId ?? event.interview_id ?? interviewId,
        eventType: event.eventType ?? event.event_type ?? "UNKNOWN",
        actorId: event.actorId ?? event.actor_id ?? null,
        payloadJson: (event.payloadJson ?? event.payload_json ?? {}) as Record<string, unknown>,
        createdAt: event.createdAt ?? event.created_at ?? new Date().toISOString(),
      }))
    : [];

  const reminders = res.reminders
    ? {
        totalJobs: Number(res.reminders.totalJobs ?? res.reminders.total_jobs ?? 0),
        pendingJobs: Number(res.reminders.pendingJobs ?? res.reminders.pending_jobs ?? 0),
        sentJobs: Number(res.reminders.sentJobs ?? res.reminders.sent_jobs ?? 0),
        failedJobs: Number(res.reminders.failedJobs ?? res.reminders.failed_jobs ?? 0),
        nextSendAt: res.reminders.nextSendAt ?? res.reminders.next_send_at ?? null,
        lastSentAt: res.reminders.lastSentAt ?? res.reminders.last_sent_at ?? null,
      }
    : null;

  return {
    events,
    reminders,
    pagination: {
      page: Number(res.pagination?.page ?? 1),
      pageSize: Number(res.pagination?.pageSize ?? res.pagination?.page_size ?? events.length),
      total: Number(res.pagination?.total ?? events.length),
      totalPages: Number(res.pagination?.totalPages ?? res.pagination?.total_pages ?? 1),
    },
  };
}

export async function scheduleInterview24hReminder(
  interviewId: string,
  payload: { channels: string[] }
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/reminders/24h/schedule`), "HR", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return Boolean(res);
}

export async function notifyInterviewerQuestionPacks(
  interviewId: string,
  payload?: { sendEmail?: boolean }
): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/notify-interviewers-questions`), "HR", {
    method: "POST",
    body: JSON.stringify({ sendEmail: payload?.sendEmail ?? true }),
  });

  return Boolean(res);
}

// ─── T6: AI Summary ──────────────────────────────────────────────────────────

export interface InterviewSummary {
  id: string;
  interviewId: string;
  version: number;
  content: string;
  recommendation: "STRONG_YES" | "YES" | "NEUTRAL" | "NO" | "STRONG_NO" | string;
  model: string;
  createdBy: string | null;
  createdAt: string;
}

export async function generateInterviewSummary(interviewId: string): Promise<InterviewSummary | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/summary/generate`), "HR", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res) return null;
  const data = res.data ?? res;
  return {
    id: data.id,
    interviewId: data.interviewId ?? data.interview_id ?? interviewId,
    version: Number(data.version ?? 1),
    content: data.content ?? "",
    recommendation: data.recommendation ?? "NEUTRAL",
    model: data.model ?? "",
    createdBy: data.createdBy ?? data.created_by ?? null,
    createdAt: data.createdAt ?? data.created_at ?? new Date().toISOString(),
  };
}

export async function getLatestInterviewSummary(interviewId: string): Promise<InterviewSummary | null> {
  const res = await apiFetch(mkApiPath(`/interviews/${interviewId}/summary/latest`), "HR", {
    method: "GET",
    cache: "no-store",
  });
  if (!res) return null;
  const data = res.data ?? res;
  if (!data || !data.id) return null;
  return {
    id: data.id,
    interviewId: data.interviewId ?? data.interview_id ?? interviewId,
    version: Number(data.version ?? 1),
    content: data.content ?? "",
    recommendation: data.recommendation ?? "NEUTRAL",
    model: data.model ?? "",
    createdBy: data.createdBy ?? data.created_by ?? null,
    createdAt: data.createdAt ?? data.created_at ?? new Date().toISOString(),
  };
}

// ─── T8: Assigned-to-me ───────────────────────────────────────────────────────

export interface AssignedInterview {
  id: string;
  applicationId: string;
  name: string;
  interviewType: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  candidateName: string | null;
  roleTitle: string | null;
  myScorecardStatus: "NONE" | "DRAFT" | "SUBMITTED" | "ARCHIVED";
  meetingLocation: string | null;
  meetingLink: string | null;
  createdAt: string;
}

export async function getAssignedToMeInterviews(): Promise<AssignedInterview[]> {
  const res = await apiFetch(interviewsAssignedToMeApi, "HR", {
    method: "GET",
    cache: "no-store",
  });
  if (!res) return [];
  const rows = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
  return rows.map((row: any) => ({
    id: String(row.id ?? ""),
    applicationId: String(row.applicationId ?? row.application_id ?? ""),
    name: String(row.name ?? "Interview"),
    interviewType: String(row.interviewType ?? row.interview_type ?? ""),
    status: String(row.status ?? "DRAFT"),
    scheduledAt: row.scheduledAt ?? row.scheduled_at ?? null,
    durationMinutes: Number(row.durationMinutes ?? row.duration_minutes ?? 60),
    candidateName: row.candidateName ?? row.candidate_name ?? null,
    roleTitle: row.roleTitle ?? row.role_title ?? null,
    myScorecardStatus: (row.myScorecardStatus ?? row.my_scorecard_status ?? "NONE") as AssignedInterview["myScorecardStatus"],
    meetingLocation: row.meetingLocation ?? row.meeting_location ?? null,
    meetingLink: row.meetingLink ?? row.meeting_link ?? null,
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
  }));
}

export async function getInstitutionInterviews(): Promise<InstitutionInterviewListItem[]> {
  const res = await apiFetch(interviewsInstitutionListApi, "HR", {
    method: "GET",
    cache: "no-store",
  });

  const rows = Array.isArray(res?.interviews) ? res.interviews : [];

  return rows.map((row: any) => ({
    id: String(row.id ?? ""),
    applicationId: String(row.applicationId ?? row.application_id ?? ""),
    candidateId: String(row.candidateId ?? row.candidate_id ?? ""),
    candidateName: String(row.candidateName ?? row.candidate_name ?? "Candidate"),
    candidateEmail: row.candidateEmail ?? row.candidate_email ?? null,
    roleTitle: String(row.roleTitle ?? row.role_title ?? "Role"),
    name: String(row.name ?? "Interview"),
    status: String(row.status ?? "DRAFT"),
    interviewType: String(row.interviewType ?? row.interview_type ?? ""),
    scheduledAt: row.scheduledAt ?? row.scheduled_at ?? null,
    meetingLocation: row.meetingLocation ?? row.meeting_location ?? null,
    interviewers: Array.isArray(row.interviewers)
      ? row.interviewers.map((item: any) => ({
          userId: String(item.userId ?? item.user_id ?? ""),
          email: item.email ?? null,
          fullName: item.fullName ?? item.full_name ?? null,
          evaluationWeight: Number(item.evaluationWeight ?? item.evaluation_weight ?? 0),
        }))
      : [],
  }));
}

export async function dispatchInterviewDecision(payload: {
  applicationId: string;
  decisionAction: "ACCEPT" | "REJECT";
  subject?: string;
  message?: string;
  sendEmail?: boolean;
}): Promise<{ success: boolean; preview?: { recipient: string; subject: string; body: string } }> {
  const res = await apiFetch(communicationsDispatchDecisionApi, "HR", {
    method: "POST",
    body: JSON.stringify({ ...payload, sendEmail: payload.sendEmail ?? true }),
  });
  if (!res) return { success: false };
  return {
    success: true,
    preview: res.preview ?? res.data?.preview ?? undefined,
  };
}
