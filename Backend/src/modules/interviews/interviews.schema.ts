import { z } from "zod";

// ─── Interview Enums ──────────────────────────────────────────────────────────

const interviewStatusEnum = z.enum(["DRAFT", "SCHEDULED", "CANCELLED", "COMPLETED"], {
  message: "Invalid interview status",
});

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

const interviewParticipantSchema = z.object({
  userId: z.string().uuid(),
  profileText: z.string().nullable(),
  evaluationWeight: z.number(),
  role: z.enum(["MANDATORY", "SECONDARY"]).default("MANDATORY"),
  weight: z.number().nullable(),
  confirmedSecondary: z.boolean().default(false),
});

export type InterviewParticipantDTO = z.infer<typeof interviewParticipantSchema>;

const interviewSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  name: z.string(),
  interviewType: z.string(),
  status: interviewStatusEnum,
  scheduledAt: z.string().datetime().nullable(),
  meetingLink: z.string().nullable(),
  meetingLocation: z.string().nullable(),
  bookingToken: z.string().nullable(),
  notes: z.string().nullable(),
  participants: z.array(interviewParticipantSchema),
  secondaryCollectiveWeight: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type InterviewDTO = z.infer<typeof interviewSchema>;

const interviewGuideQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  objective: z.string(),
  scoreHint: z.string(),
});

export type InterviewGuideQuestionDTO = z.infer<typeof interviewGuideQuestionSchema>;

const interviewGuideVersionSchema = z.object({
  id: z.string().uuid(),
  interviewId: z.string().uuid(),
  version: z.number().int(),
  model: z.string(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  questions: z.array(interviewGuideQuestionSchema),
});

export type InterviewGuideVersionDTO = z.infer<typeof interviewGuideVersionSchema>;

const generatedQuestionSchema = z.object({
  id: z.string().uuid(),
  interviewId: z.string().uuid(),
  interviewerId: z.string().uuid(),
  questionType: z.enum(["DURING_INTERVIEW", "DEBRIEF", "TEMPLATE"]),
  questionText: z.string(),
  source: z.string(),
  createdAt: z.string().datetime(),
});

export type GeneratedQuestionDTO = z.infer<typeof generatedQuestionSchema>;

const interviewQuestionTemplateSchema = z.object({
  id: z.string().uuid(),
  templateKey: z.string(),
  title: z.string(),
  markdownContent: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
});

export type InterviewQuestionTemplateDTO = z.infer<typeof interviewQuestionTemplateSchema>;

const debriefAnswerSchema = z.object({
  id: z.string().uuid(),
  questionKey: z.string(),
  scoreOver10: z.number(),
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type DebriefAnswerDTO = z.infer<typeof debriefAnswerSchema>;

const interviewerQuestionPackSchema = z.object({
  interviewerId: z.string().uuid(),
  duringQuestions: z.array(generatedQuestionSchema),
  debriefQuestions: z.array(generatedQuestionSchema),
  debriefAnswers: z.array(debriefAnswerSchema),
  defaultTemplate: interviewQuestionTemplateSchema.nullable(),
});

export type InterviewerQuestionPackDTO = z.infer<typeof interviewerQuestionPackSchema>;

const interviewInterviewerScoreSchema = z.object({
  id: z.string().uuid(),
  interviewId: z.string().uuid(),
  interviewerId: z.string().uuid(),
  globalScoreOver10: z.number(),
  weightedContribution: z.number(),
  comment: z.string().nullable(),
  submittedAt: z.string().datetime(),
});

export type InterviewInterviewerScoreDTO = z.infer<typeof interviewInterviewerScoreSchema>;

const interviewScoreContributionSchema = z.object({
  interviewerId: z.string().uuid(),
  weight: z.number(),
  scoreOver10: z.number().nullable(),
  weightedContribution: z.number(),
  submitted: z.boolean(),
});

const interviewScoresSummarySchema = z.object({
  interviewId: z.string().uuid(),
  totalSubmitted: z.number().int(),
  weightedScoreOver10: z.number(),
  computedAt: z.string().datetime(),
  contributions: z.array(interviewScoreContributionSchema),
  details: z.record(z.string(), z.unknown()),
});

export type InterviewScoresSummaryDTO = z.infer<typeof interviewScoresSummarySchema>;

const scorecardTemplateCriterionSchema = z.object({
  criterionKey: z.string(),
  label: z.string(),
  weight: z.number().nullable(),
  position: z.number().int(),
});

const interviewScorecardEntrySchema = z.object({
  id: z.string().uuid(),
  criterionKey: z.string(),
  criterionLabel: z.string(),
  weight: z.number().nullable(),
  score: z.number().nullable(),
  comment: z.string().nullable(),
  redFlag: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const interviewScorecardSchema = z.object({
  id: z.string().uuid(),
  interviewId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  reviewerName: z.string(),
  status: z.enum(["DRAFT", "SUBMITTED", "ARCHIVED"]),
  overallComment: z.string().nullable(),
  submittedAt: z.string().datetime().nullable(),
  isModifiedAfterSubmit: z.boolean(),
  archivedAt: z.string().datetime().nullable(),
  templateSnapshot: z.object({
    templateId: z.string().uuid().nullable(),
    templateName: z.string(),
    roleId: z.string().uuid().nullable(),
    criteria: z.array(scorecardTemplateCriterionSchema),
  }),
  entries: z.array(interviewScorecardEntrySchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type InterviewScorecardDTO = z.infer<typeof interviewScorecardSchema>;

const interviewScorecardsListSchema = z.object({
  scorecards: z.array(interviewScorecardSchema),
  visibility: z.object({
    myReviewerId: z.string().uuid(),
    myScorecardStatus: z.enum(["NONE", "DRAFT", "SUBMITTED", "ARCHIVED"]),
    canViewOthers: z.boolean(),
    canReview: z.boolean(),
  }),
});

export type InterviewScorecardsListDTO = z.infer<typeof interviewScorecardsListSchema>;

const candidateInterviewHistoryItemSchema = z.object({
  interview: interviewSchema,
  scoreSummary: interviewScoresSummarySchema.nullable(),
  myScorecardStatus: z.enum(["NONE", "DRAFT", "SUBMITTED", "ARCHIVED"]).default("NONE"),
});

export type CandidateInterviewHistoryItemDTO = z.infer<typeof candidateInterviewHistoryItemSchema>;
