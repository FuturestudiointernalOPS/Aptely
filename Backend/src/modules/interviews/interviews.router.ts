import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  createInterviewSchema,
  updateInterviewersSchema,
  listAvailabilityQuerySchema,
  scheduleInterviewSchema,
  scheduleInterviewReminderSchema,
  notifyInterviewSchema,
  notifyInterviewerQuestionsSchema,
  updateInterviewNotesSchema,
  confirmBookingSchema,
  listInterviewActivityQuerySchema,
  generateInterviewGuideSchema,
  generateDuringQuestionsSchema,
  submitDebriefFormSchema,
  submitInterviewerScoreSchema,
  createInterviewScorecardSchema,
  updateInterviewScorecardSchema,
  updateInterviewScorecardTemplateSchema,
  confirmSecondarySchema,
} from "./interviews.schema";
import {
  createInterview,
  listInstitutionInterviews,
  assignInterviewers,
  getInterviewAvailability,
  scheduleInterview,
  proposeAvailabilityWindow,
  notifyInterview,
  notifyInterviewerQuestions,
  updateInterviewNotes,
  getBookingByToken,
  confirmBooking,
  generateInterviewGuide,
  listInterviewGuideVersions,
  generateDuringQuestions,
  getInterviewerQuestionPack,
  getDefaultQuestionTemplate,
  submitDebriefForm,
  submitInterviewerScore,
  getInterviewScoresSummary,
  listInterviewScorecards,
  createInterviewScorecard,
  updateInterviewScorecard,
  submitInterviewScorecard,
  getInterviewScorecardTemplate,
  updateInterviewScorecardTemplate,
  getCandidateInterviewHistory,
  getCandidateInterviewHistoryEnriched,
  getApplicationInterviewHistoryEnriched,
  scheduleInterview24hReminder,
  getInterviewActivityFeed,
  generateInterviewSummary,
  getLatestInterviewSummary,
  getAssignedToMeInterviews,
  sendInterviewReminders,
  confirmSecondaryParticipant,
  getInterview,
} from "./interviews.controller";

const router = Router();

/**
 * @route   POST /interviews/send-reminders
 * @desc    Cron-triggered endpoint — sends pending 48h/2h interview reminders
 * @access  Internal (X-Cron-Secret header)
 */
router.post("/send-reminders", sendInterviewReminders);

// ─── PUBLIC routes (no auth required) ──────────────────────────────────────

/**
 * @route   GET /interviews/booking/:token
 * @desc    Candidate views interview & slots via public token
 * @access  Public
 */
router.get("/booking/:token", getBookingByToken);

/**
 * @route   POST /interviews/booking/:token/confirm
 * @desc    Candidate confirms a specific time slot
 * @access  Public
 */
router.post("/booking/:token/confirm", validate(confirmBookingSchema), confirmBooking);


// ─── Protected HR routes ───────────────────────────────────────────────────

// All routes below require auth + HR role
router.use(authGuard, requirePermission("interviews.manage"));

/**
 * @route   POST /interviews
 * @desc    HR creates interview draft for an application
 * @access  HR
 */
router.post("/", validate(createInterviewSchema), createInterview);

/**
 * @route   GET /interviews/institution/list
 * @desc    HR lists interviews of current institution
 * @access  HR
 */
router.get("/institution/list", listInstitutionInterviews);

/**
 * @route   PATCH /interviews/:id/interviewers
 * @desc    HR assigns interviewers to an interview
 * @access  HR
 */
router.patch("/:id/interviewers", validate(updateInterviewersSchema), assignInterviewers);

/**
 * @route   PATCH /interviews/:id/confirm-secondary
 * @desc    HR confirms one SECONDARY participant as the active secondary
 * @access  HR
 */
router.patch("/:id/confirm-secondary", validate(confirmSecondarySchema), confirmSecondaryParticipant);

/**
 * @route   GET /interviews/:id/availability
 * @desc    HR retrieves available slots for interview scheduling
 * @access  HR
 */
router.get("/:id/availability", validateQuery(listAvailabilityQuerySchema), getInterviewAvailability);

/**
 * @route   GET /interviews/:id/activity
 * @desc    HR retrieves interview timeline events + reminder status
 * @access  HR
 */
router.get("/:id/activity", validateQuery(listInterviewActivityQuerySchema), getInterviewActivityFeed);

/**
 * @route   POST /interviews/:id/schedule
 * @desc    HR schedules interview at a specific time slot
 * @access  HR
 */
router.post("/:id/schedule", validate(scheduleInterviewSchema), scheduleInterview);
router.post("/:id/propose-window", proposeAvailabilityWindow);

/**
 * @route   POST /interviews/:id/notify
 * @desc    Queue notifications for candidate/interviewers/hr/all
 * @access  HR
 */
router.post("/:id/notify", validate(notifyInterviewSchema), notifyInterview);
router.post("/:id/notify-interviewers-questions", validate(notifyInterviewerQuestionsSchema), notifyInterviewerQuestions);

/**
 * @route   POST /interviews/:id/reminders/24h/schedule
 * @desc    Schedule the 24h reminder
 * @access  HR
 */
router.post(
  "/:id/reminders/24h/schedule",
  validate(scheduleInterviewReminderSchema),
  scheduleInterview24hReminder
);

/**
 * @route   PATCH /interviews/:id/notes
 * @desc    HR updates interview notes
 * @access  HR
 */
router.patch("/:id/notes", validate(updateInterviewNotesSchema), updateInterviewNotes);

/**
 * @route   POST /interviews/:id/guide/generate
 * @desc    HR generates AI interview guide for an interview
 * @access  HR
 */
router.post("/:id/guide/generate", validate(generateInterviewGuideSchema), generateInterviewGuide);

/**
 * @route   GET /interviews/:id/guide/versions
 * @desc    HR lists generated interview guide versions
 * @access  HR
 */
router.get("/:id/guide/versions", listInterviewGuideVersions);

/**
 * @route   POST /interviews/:id/questions/generate-during
 * @desc    HR generates during-interview question pack
 * @access  HR
 */
router.post("/:id/questions/generate-during", validate(generateDuringQuestionsSchema), generateDuringQuestions);

/**
 * @route   GET /interviews/:id/questions/by-interviewer/:userId
 * @desc    HR gets question pack for one interviewer
 * @access  HR
 */
router.get("/:id/questions/by-interviewer/:userId", getInterviewerQuestionPack);

/**
 * @route   GET /interviews/question-templates/default
 * @desc    HR gets default markdown interview template
 * @access  HR
 */
router.get("/question-templates/default", getDefaultQuestionTemplate);

/**
 * @route   GET /interviews/assigned-to-me
 * @desc    Interviewer lists all interviews they are assigned to
 * @access  HR
 */
router.get("/assigned-to-me", getAssignedToMeInterviews);

/**
 * @route   GET /interviews/:id
 * @desc    HR retrieves full interview detail by ID
 * @access  HR
 */
router.get("/:id", getInterview);

/**
 * @route   POST /interviews/:id/debrief-forms/:userId
 * @desc    HR submits debrief answers (/10) for interviewer
 * @access  HR
 */
router.post("/:id/debrief-forms/:userId", validate(submitDebriefFormSchema), submitDebriefForm);

/**
 * @route   POST /interviews/:id/scores/:interviewerId
 * @desc    Save final score of one interviewer
 * @access  HR
 */
router.post("/:id/scores/:interviewerId", validate(submitInterviewerScoreSchema), submitInterviewerScore);

/**
 * @route   GET /interviews/:id/scorecards
 * @desc    List scorecards visible to current reviewer
 * @access  HR
 */
router.get("/:id/scorecards", listInterviewScorecards);

/**
 * @route   POST /interviews/:id/scorecards
 * @desc    Create my draft scorecard for interview
 * @access  HR
 */
router.post("/:id/scorecards", validate(createInterviewScorecardSchema), createInterviewScorecard);

/**
 * @route   PATCH /interviews/:id/scorecards/:scorecardId
 * @desc    Update draft/submitted scorecard (owner only)
 * @access  HR
 */
router.patch("/:id/scorecards/:scorecardId", validate(updateInterviewScorecardSchema), updateInterviewScorecard);

/**
 * @route   POST /interviews/:id/scorecards/:scorecardId/submit
 * @desc    Submit scorecard
 * @access  HR
 */
router.post("/:id/scorecards/:scorecardId/submit", submitInterviewScorecard);

/**
 * @route   GET /interviews/:id/scorecard-template
 * @desc    HR reads the current scoring criteria template for an interview
 * @access  HR
 */
router.get("/:id/scorecard-template", getInterviewScorecardTemplate);

/**
 * @route   PATCH /interviews/:id/scorecard-template
 * @desc    HR sets scoring criteria template for an interview
 * @access  HR
 */
router.patch("/:id/scorecard-template", validate(updateInterviewScorecardTemplateSchema), updateInterviewScorecardTemplate);

/**
 * @route   GET /interviews/:id/scores/summary
 * @desc    HR gets weighted score summary for an interview
 * @access  HR
 */
router.get("/:id/scores/summary", getInterviewScoresSummary);

/**
 * @route   POST /interviews/:id/summary/generate
 * @desc    HR generates AI post-interview summary
 * @access  HR
 */
router.post("/:id/summary/generate", generateInterviewSummary);

/**
 * @route   GET /interviews/:id/summary/latest
 * @desc    HR fetches latest AI summary for an interview
 * @access  HR
 */
router.get("/:id/summary/latest", getLatestInterviewSummary);

/**
 * @route   GET /interviews/history/application/:applicationId/enriched
 * @desc    HR views interview history + score summary for one application
 * @access  HR
 */
router.get("/history/application/:applicationId/enriched", getApplicationInterviewHistoryEnriched);

/**
 * @route   GET /interviews/history/:candidateId
 * @desc    HR views full interview history for a candidate
 * @access  HR
 */
router.get("/history/:candidateId", getCandidateInterviewHistory);
router.get("/history/:candidateId/enriched", getCandidateInterviewHistoryEnriched);

export default router;
