import { z } from "zod";

// ─── Interview Enums ──────────────────────────────────────────────────────────

const meetingProviderEnum = z.enum(["GOOGLE_MEET", "TEAMS", "MANUAL", "JITSI"], {
  message: "Invalid meeting provider",
});

// ─── POST /interviews — Créer un brouillon d'interview ──────────────────────

export const createInterviewSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  name: z.string().min(2).max(100),
  interviewType: z.enum(["TECH_REVIEW", "CULTURE_FIT", "CUSTOM"]).default("CUSTOM"),
  durationMinutes: z.number().int().min(15).max(180).optional().default(60),
  timezone: z.string().optional().default("UTC"),
  meetingProvider: meetingProviderEnum.optional().default("MANUAL"),
  secondaryCollectiveWeight: z.number().min(0).max(100).nullable().optional(),
  interviewerProfiles: z.array(z.object({
    userId: z.string().uuid(),
    profileText: z.string().optional(),
    evaluationWeight: z.number().min(0).max(100).default(0),
    role: z.enum(["MANDATORY", "SECONDARY"]).optional().default("MANDATORY"),
  })).default([]),
}).refine((data) => {
  if (!data.interviewerProfiles || data.interviewerProfiles.length === 0) return true;
  const mandatory = data.interviewerProfiles.filter(
    p => (p.role ?? "MANDATORY") === "MANDATORY"
  );
  const secondary = data.interviewerProfiles.filter(p => p.role === "SECONDARY");
  const mandatorySum = mandatory.reduce((acc, p) => acc + (p.evaluationWeight ?? 0), 0);
  const scw = secondary.length > 0 ? (data.secondaryCollectiveWeight ?? 0) : 0;
  return Math.abs(mandatorySum + scw - 100) <= 0.01;
}, {
  message: "Sum of mandatory weights + secondary collective weight must equal 100",
  path: ["interviewerProfiles"],
});

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;

// ─── PATCH /interviews/:id/interviewers — Assigner des interviewers ─────────

export const updateInterviewersSchema = z.object({
  interviewerProfiles: z.array(z.object({
    userId: z.string().uuid(),
    profileText: z.string().optional(),
    evaluationWeight: z.number().min(0).max(100).default(0),
    role: z.enum(["MANDATORY", "SECONDARY"]).optional().default("MANDATORY"),
  })).min(1),
  secondaryCollectiveWeight: z.number().min(0).max(100).nullable().optional(),
});

export type UpdateInterviewersInput = z.infer<typeof updateInterviewersSchema>;

// ─── GET /interviews/:id/availability — Query params ───────────────────────

export const listAvailabilityQuerySchema = z.object({
  from: z.string().datetime("Invalid ISO datetime"),
  to: z.string().datetime("Invalid ISO datetime"),
  slotMinutes: z.coerce.number().default(30),
  timezone: z.string().default("UTC"),
  workingHoursStart: z.coerce.number().min(0).max(23).default(9),
  workingHoursEnd: z.coerce.number().min(1).max(24).default(18),
});

export type ListAvailabilityQuery = z.infer<typeof listAvailabilityQuerySchema>;

// ─── POST /interviews/:id/schedule — Booker un créneau ──────────────────────

export const scheduleInterviewSchema = z.object({
  start: z.string().datetime("Invalid ISO datetime"),
  timezone: z.string(),
  meetingLocation: z.string().min(3).max(300).optional(),
  manualMeetingUrl: z.string().url().max(500).optional(), // MANUAL/REMOTE: HR-provided meeting URL
});

export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;

// ─── POST /interviews/:id/reminders/24h/schedule ───────────────────────────

export const scheduleInterviewReminderSchema = z.object({
  channels: z.array(z.enum(["EMAIL", "PUSH"])).min(1).optional().default(["EMAIL"]),
});

export type ScheduleInterviewReminderInput = z.infer<typeof scheduleInterviewReminderSchema>;

// ─── GET /interviews/:id/activity — Query params ───────────────────────────

export const listInterviewActivityQuerySchema = z.object({
  eventTypes: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListInterviewActivityQuery = z.infer<typeof listInterviewActivityQuerySchema>;

// ─── POST /interviews/:id/notify — Notifier candidats/intervenants/RH ─────

export const notifyInterviewSchema = z.object({
  recipientType: z.enum(["candidate", "interviewers", "hr", "all"]).default("all"),
  subject: z.string().min(3).max(180).optional(),
  body: z.string().min(3).max(20000).optional(),
  sendEmail: z.boolean().optional().default(true),
});

export type NotifyInterviewInput = z.infer<typeof notifyInterviewSchema>;

export const notifyInterviewerQuestionsSchema = z.object({
  sendEmail: z.boolean().optional().default(true),
});

export type NotifyInterviewerQuestionsInput = z.infer<typeof notifyInterviewerQuestionsSchema>;

// ─── PATCH /interviews/:id/notes — Notes RH sur entretien ──────────────────

export const updateInterviewNotesSchema = z.object({
  notes: z.string().max(5000).nullable(),
});

export type UpdateInterviewNotesInput = z.infer<typeof updateInterviewNotesSchema>;

// ─── POST /interviews/:id/guide/generate ───────────────────────────────────

export const generateInterviewGuideSchema = z.object({
  questionsCount: z.coerce.number().int().min(3).max(12).optional().default(6),
});

export type GenerateInterviewGuideInput = z.infer<typeof generateInterviewGuideSchema>;

// ─── POST /interviews/:id/questions/generate-during ───────────────────────

export const generateDuringQuestionsSchema = z.object({
  questionsCount: z.coerce.number().int().min(3).max(12).optional().default(6),
});

export type GenerateDuringQuestionsInput = z.infer<typeof generateDuringQuestionsSchema>;

// ─── POST /interviews/:id/debrief-forms/:userId ───────────────────────────

export const submitDebriefFormSchema = z.object({
  answers: z.array(
    z.object({
      questionKey: z.string().min(1),
      scoreOver10: z.coerce.number().min(0).max(10),
      comment: z.string().max(1000).optional(),
    })
  ).min(1).max(30),
});

export type SubmitDebriefFormInput = z.infer<typeof submitDebriefFormSchema>;

// ─── POST /interviews/:id/scores/:interviewerId ───────────────────────────

const criteriaScoreSchema = z.object({
  criterion: z.string().min(2).max(120),
  scoreOver10: z.coerce.number().min(0).max(10),
  comment: z.string().max(1000).optional(),
});

export const submitInterviewerScoreSchema = z.object({
  criteriaScores: z.array(criteriaScoreSchema).min(1).max(20),
  globalScoreOver10: z.coerce.number().min(0).max(10),
  comment: z.string().max(2000).optional(),
});

export type SubmitInterviewerScoreInput = z.infer<typeof submitInterviewerScoreSchema>;

// ─── Interview Scorecards (template-based) ───────────────────────────────

export const createInterviewScorecardSchema = z.object({
  templateId: z.string().uuid().optional(),
});


const scorecardEntryInputSchema = z.object({
  criterionKey: z.string().min(1).max(120),
  score: z.coerce.number().min(1).max(5).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  redFlag: z.boolean().optional().default(false),
});

export const updateInterviewScorecardSchema = z.object({
  entries: z.array(scorecardEntryInputSchema).optional(),
  overallComment: z.string().max(4000).nullable().optional(),
  archive: z.boolean().optional(),
});

export type UpdateInterviewScorecardInput = z.infer<typeof updateInterviewScorecardSchema>;

// ─── PATCH /interviews/:id/scorecard-template ────────────────────────────────

const templateCriterionInputSchema = z.object({
  criterionKey: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  weight: z.number().min(0).max(100).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateInterviewScorecardTemplateSchema = z.object({
  templateName: z.string().min(1).max(200).optional(),
  criteria: z.array(templateCriterionInputSchema).min(1),
});

export type UpdateInterviewScorecardTemplateInput = z.infer<typeof updateInterviewScorecardTemplateSchema>;

// ─── POST /interviews/booking/:token/confirm — Public confirm ──────────────

export const confirmBookingSchema = z.object({
  start: z.string().datetime("Invalid ISO datetime"),
  timezone: z.string(),
});

export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;

// ─── PATCH /interviews/:id/confirm-secondary ────────────────────────────────

export const confirmSecondarySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
});

// ─── Response types ──────────────────────────────────────────────────────────
// These describe API response payloads. They are only ever consumed as
// TypeScript types (never validated at runtime), so they are declared as plain
// types instead of Zod schemas that would never be executed.

export interface InterviewParticipantDTO {
  userId: string;
  profileText: string | null;
  evaluationWeight: number;
  role: "MANDATORY" | "SECONDARY";
  weight: number | null;
  confirmedSecondary: boolean;
}

export interface InterviewDTO {
  id: string;
  applicationId: string;
  name: string;
  interviewType: string;
  status: "DRAFT" | "SCHEDULED" | "CANCELLED" | "COMPLETED";
  scheduledAt: string | null;
  meetingLink: string | null;
  meetingLocation: string | null;
  bookingToken: string | null;
  notes: string | null;
  participants: InterviewParticipantDTO[];
  secondaryCollectiveWeight: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewGuideQuestionDTO {
  id: string;
  question: string;
  objective: string;
  scoreHint: string;
}

export interface InterviewGuideVersionDTO {
  id: string;
  interviewId: string;
  version: number;
  model: string;
  createdBy: string;
  createdAt: string;
  questions: InterviewGuideQuestionDTO[];
}

export interface GeneratedQuestionDTO {
  id: string;
  interviewId: string;
  interviewerId: string;
  questionType: "DURING_INTERVIEW" | "DEBRIEF" | "TEMPLATE";
  questionText: string;
  source: string;
  createdAt: string;
}

export interface InterviewQuestionTemplateDTO {
  id: string;
  templateKey: string;
  title: string;
  markdownContent: string;
  isDefault: boolean;
  createdAt: string;
}

export interface DebriefAnswerDTO {
  id: string;
  questionKey: string;
  scoreOver10: number;
  comment: string | null;
  createdAt: string;
}

export interface InterviewerQuestionPackDTO {
  interviewerId: string;
  duringQuestions: GeneratedQuestionDTO[];
  debriefQuestions: GeneratedQuestionDTO[];
  debriefAnswers: DebriefAnswerDTO[];
  defaultTemplate: InterviewQuestionTemplateDTO | null;
}

export interface InterviewInterviewerScoreDTO {
  id: string;
  interviewId: string;
  interviewerId: string;
  globalScoreOver10: number;
  weightedContribution: number;
  comment: string | null;
  submittedAt: string;
}

interface InterviewScoreContributionDTO {
  interviewerId: string;
  weight: number;
  scoreOver10: number | null;
  weightedContribution: number;
  submitted: boolean;
}

export interface InterviewScoresSummaryDTO {
  interviewId: string;
  totalSubmitted: number;
  weightedScoreOver10: number;
  computedAt: string;
  contributions: InterviewScoreContributionDTO[];
  details: Record<string, unknown>;
}

interface ScorecardTemplateCriterionDTO {
  criterionKey: string;
  label: string;
  weight: number | null;
  position: number;
}

interface InterviewScorecardEntryDTO {
  id: string;
  criterionKey: string;
  criterionLabel: string;
  weight: number | null;
  score: number | null;
  comment: string | null;
  redFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewScorecardDTO {
  id: string;
  interviewId: string;
  reviewerId: string;
  reviewerName: string;
  status: "DRAFT" | "SUBMITTED" | "ARCHIVED";
  overallComment: string | null;
  submittedAt: string | null;
  isModifiedAfterSubmit: boolean;
  archivedAt: string | null;
  templateSnapshot: {
    templateId: string | null;
    templateName: string;
    roleId: string | null;
    criteria: ScorecardTemplateCriterionDTO[];
  };
  entries: InterviewScorecardEntryDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewScorecardsListDTO {
  scorecards: InterviewScorecardDTO[];
  visibility: {
    myReviewerId: string;
    myScorecardStatus: "NONE" | "DRAFT" | "SUBMITTED" | "ARCHIVED";
    canViewOthers: boolean;
    canReview: boolean;
  };
}

export interface CandidateInterviewHistoryItemDTO {
  interview: InterviewDTO;
  scoreSummary: InterviewScoresSummaryDTO | null;
  myScorecardStatus: "NONE" | "DRAFT" | "SUBMITTED" | "ARCHIVED";
}
