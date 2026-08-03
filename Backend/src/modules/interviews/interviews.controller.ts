import { Response } from "express";
import { env } from "@/config/env";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { createNotification, NOTIF_LINKS, NOTIF_TITLES } from "@/modules/notifications/notifications.service";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import * as interviewsService from "./interviews.service";
import { computeSlotsWithParticipantAvailability } from "./availability.service";
import type {
  CreateInterviewInput,
  UpdateInterviewersInput,
  ListAvailabilityQuery,
  ScheduleInterviewInput,
  ScheduleInterviewReminderInput,
  ListInterviewActivityQuery,
  NotifyInterviewInput,
  NotifyInterviewerQuestionsInput,
  UpdateInterviewNotesInput,
  ConfirmBookingInput,
  GenerateInterviewGuideInput,
  GenerateDuringQuestionsInput,
  SubmitDebriefFormInput,
  SubmitInterviewerScoreInput,
  UpdateInterviewScorecardInput,
  UpdateInterviewScorecardTemplateInput,
} from "./interviews.schema";

// ─── HR Routes ────────────────────────────────────────────────────────────

/**
 * @route   POST /interviews
 * @desc    HR creates an interview draft for an application
 * @access  HR
 */
export const createInterview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const input = req.body as CreateInterviewInput;
    const hrId = req.user!.id;
    const institutionId = req.user!.institutionId;

    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const interview = await interviewsService.createInterviewDraft(input, hrId, institutionId);

    res.status(201).json(interview);
  }
);

/**
 * @route   GET /interviews/:id
 * @desc    HR gets a single interview by ID
 * @access  HR
 */
export const getInterview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data, error } = await supabaseAdmin
      .from("interviews")
      .select("*, interview_participants(*)")
      .eq("id", id)
      .single();

    if (error || !data) throw new AppError(404, "Interview not found");

    // Map DB fields to frontend-expected format
    const mapped = {
      id: data.id,
      name: data.name,
      interviewType: data.interview_type,
      durationMinutes: data.duration_minutes,
      scheduledAt: data.scheduled_at,
      meetingProvider: data.meeting_provider,
      meetingLink: data.meeting_link,
      meetingLocation: data.meeting_location,
      interviewers: (data.interview_participants || []).map((p: Record<string, unknown>) => ({
        userId: p.user_id,
        fullName: (p as any).profiles?.full_name || null,
        email: (p as any).profiles?.email || null,
        role: p.role,
        weight: p.weight,
      })),
    };

    res.status(200).json({ data: mapped });
  }
);

/**
 * @route   GET /interviews/institution/list
 * @desc    HR lists interviews for current institution
 * @access  HR
 */
export const listInstitutionInterviews = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const interviews = await interviewsService.listInstitutionInterviews(institutionId);
    res.status(200).json({ interviews });
  }
);

/**
 * @route   POST /interviews/:id/reminders/24h/schedule
 */
export const scheduleInterview24hReminder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const interviewId = id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as ScheduleInterviewReminderInput;
    const result = await interviewsService.scheduleInterview24hReminder(
      interviewId,
      institutionId,
      req.user!.id,
      input.channels
    );

    res.status(200).json(result);
  }
);

/**
 * @route   PATCH /interviews/:id/interviewers
 * @desc    HR assigns interviewers to an interview
 * @access  HR
 */
export const assignInterviewers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const input = req.body as UpdateInterviewersInput;
    const institutionId = req.user!.institutionId;

    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const secondaryCollectiveWeight = input.secondaryCollectiveWeight ?? null;

    const interview = await interviewsService.assignInterviewers(
      id,
      input.interviewerProfiles,
      secondaryCollectiveWeight,
      institutionId
    );

    res.status(200).json(interview);
  }
);

/**
 * @route   GET /interviews/:id/availability
 * @desc    HR retrieves available slots (from all assigned interviewers' calendars)
 * @access  HR
 *
 * Uses connected calendar providers when available.
 */
export const getInterviewAvailability = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    if (!id) {
      throw new AppError(400, "Missing interview id");
    }

    const query = (res.locals["query"] as ListAvailabilityQuery) || req.query;

    const from = Array.isArray(query.from) ? query.from[0] : query.from;
    const to = Array.isArray(query.to) ? query.to[0] : query.to;
    const slotMinutesStr = Array.isArray(query.slotMinutes) ? query.slotMinutes[0] : query.slotMinutes;
    const timezone = Array.isArray(query.timezone) ? query.timezone[0] : query.timezone || "UTC";

    const slotMinutes = parseInt(slotMinutesStr || "30", 10) || 30;
    const workingHoursStart = Number((query as any).workingHoursStart ?? 9) || 9;
    const workingHoursEnd = Number((query as any).workingHoursEnd ?? 18) || 18;

    if (!from || !to) {
      throw new AppError(400, "Missing required query params: from, to");
    }

    const participants = await interviewsService.getBusyWindowsPerParticipantForInterview(
      id,
      { from, to },
      institutionId
    );

    const slots = computeSlotsWithParticipantAvailability(
      participants,
      { from, to },
      slotMinutes,
      timezone,
      workingHoursStart,
      workingHoursEnd
    );

    res.status(200).json({
      slots,
      connectedParticipants: participants.filter((p) => p.calendarConnected).length,
      totalParticipants: participants.length,
    });
  }
);

/**
 * @route   GET /interviews/:id/activity
 * @desc    HR fetches interview activity timeline + reminder status
 * @access  HR
 */
export const getInterviewActivityFeed = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const query = (res.locals["query"] as ListInterviewActivityQuery) || req.query;
    const page = Number(query.page || 1) || 1;
    const pageSize = Number(query.pageSize || 10) || 10;
    const rawEventTypes = Array.isArray(query.eventTypes) ? query.eventTypes[0] : query.eventTypes;
    const eventTypes = rawEventTypes
      ? rawEventTypes.split(",").map((value: string) => value.trim()).filter(Boolean)
      : [];

    const feed = await interviewsService.getInterviewActivityFeed(id, institutionId, {
      eventTypes,
      page,
      pageSize,
    });

    res.status(200).json(feed);
  }
);

/**
 * @route   POST /interviews/:id/schedule
 * @desc    HR schedules the interview at a specific slot
 * @access  HR
 */
export const scheduleInterview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const input = req.body as ScheduleInterviewInput;
    const institutionId = req.user!.institutionId;

    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const interview = await interviewsService.scheduleInterviewSlot(
      id,
      input.start,
      input.timezone,
      input.meetingLocation ?? null,
      institutionId,
      input.manualMeetingUrl ?? null
    );

    // Notify candidate
    if (interview.applicationId) {
      void (async () => {
        const { supabaseAdmin } = await import("@/config/supabase");
        const { data: app } = await supabaseAdmin
          .from("applications")
          .select("candidate_id")
          .eq("id", interview.applicationId)
          .single();
        if (app?.candidate_id) {
          await createNotification({
            userId: app.candidate_id as string,
            type: "INTERVIEW_SCHEDULED",
            title: NOTIF_TITLES.INTERVIEW_SCHEDULED,
            link: NOTIF_LINKS.candidateDashboard,
          });
        }
      })();
    }

    res.status(200).json(interview);
  }
);

/**
 * @route   POST /interviews/:id/propose-window
 * @desc    HR proposes a time window; sets PENDING_CANDIDATE_BOOKING + stores window
 * @access  HR
 */
export const proposeAvailabilityWindow = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { from, to, workingHoursStart, workingHoursEnd } = req.body as {
      from: string;
      to: string;
      workingHoursStart?: string;
      workingHoursEnd?: string;
    };

    if (!from || !to) throw new AppError(400, "from and to are required");

    const result = await interviewsService.proposeAvailabilityWindow(id, institutionId, {
      from,
      to,
      workingHoursStart: workingHoursStart ?? "09:00",
      workingHoursEnd: workingHoursEnd ?? "18:00",
    });

    res.status(200).json({ data: result });
  }
);

/**
 * @route   POST /interviews/:id/notify
 * @desc    Queue interview notification emails (candidate/interviewers/hr/all)
 * @access  HR
 */
export const notifyInterview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as NotifyInterviewInput;
    const result = await interviewsService.notifyInterviewRecipients(
      id,
      institutionId,
      input,
      req.user!.id
    );

    res.status(200).json(result);
  }
);

/**
 * @route   POST /interviews/:id/notify-interviewers-questions
 * @desc    Queue personalized interviewer question pack emails
 * @access  HR
 */
export const notifyInterviewerQuestions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as NotifyInterviewerQuestionsInput;
    const result = await interviewsService.notifyInterviewerQuestionPacks(
      id,
      institutionId,
      { sendEmail: input.sendEmail }
    );

    res.status(200).json(result);
  }
);

/**
 * @route   PATCH /interviews/:id/notes
 * @desc    HR updates notes attached to an interview
 * @access  HR
 */
export const updateInterviewNotes = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const input = req.body as UpdateInterviewNotesInput;
    const institutionId = req.user!.institutionId;

    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const interview = await interviewsService.updateInterviewNotes(
      id,
      input.notes,
      institutionId
    );

    res.status(200).json(interview);
  }
);

/**
 * @route   POST /interviews/:id/guide/generate
 * @desc    Generate AI interview guide and persist version
 * @access  HR
 */
function reqLocale(req: AuthenticatedRequest): "fr" | "en" {
  return req.headers["x-locale"] === "en" ? "en" : "fr";
}

export const generateInterviewGuide = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as GenerateInterviewGuideInput;
    const result = await interviewsService.generateInterviewGuide(
      id,
      institutionId,
      userId,
      { questionsCount: input.questionsCount },
      reqLocale(req)
    );

    res.status(201).json(result);
  }
);

/**
 * @route   GET /interviews/:id/guide/versions
 * @desc    List persisted interview guide versions
 * @access  HR
 */
export const listInterviewGuideVersions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const versions = await interviewsService.listInterviewGuideVersions(id, institutionId);
    res.status(200).json({ versions });
  }
);

/**
 * @route   POST /interviews/:id/questions/generate-during
 * @desc    Generate during-interview question packs for assigned interviewers
 * @access  HR
 */
export const generateDuringQuestions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as GenerateDuringQuestionsInput;
    const generated = await interviewsService.generateDuringQuestions(
      id,
      institutionId,
      userId,
      { questionsCount: input.questionsCount },
      reqLocale(req)
    );

    res.status(201).json({ generated });
  }
);

/**
 * @route   GET /interviews/:id/questions/by-interviewer/:userId
 * @desc    Return one interviewer question pack (during + debrief + default template)
 * @access  HR
 */
export const getInterviewerQuestionPack = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id, userId } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (Array.isArray(userId)) userId = userId[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const pack = await interviewsService.getInterviewerQuestionPack(id, userId, institutionId);
    res.status(200).json(pack);
  }
);

/**
 * @route   GET /interviews/question-templates/default
 * @desc    Return default markdown template for interviews
 * @access  HR
 */
export const getDefaultQuestionTemplate = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const template = await interviewsService.getDefaultQuestionTemplate();
    res.status(200).json(template);
  }
);

/**
 * @route   POST /interviews/:id/debrief-forms/:userId
 * @desc    Submit debrief answers (/10) for an interviewer
 * @access  HR
 */
export const submitDebriefForm = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id, userId } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (Array.isArray(userId)) userId = userId[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as SubmitDebriefFormInput;
    const saved = await interviewsService.submitDebriefForm(id, userId, institutionId, input.answers);
    res.status(201).json({ answers: saved });
  }
);

/**
 * @route   POST /interviews/:id/scores/:interviewerId
 * @desc    Submit final score for one assigned interviewer
 * @access  HR
 */
export const submitInterviewerScore = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id, interviewerId } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (Array.isArray(interviewerId)) interviewerId = interviewerId[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    if (!interviewerId) {
      throw new AppError(400, "Missing interviewerId");
    }

    const input = req.body as SubmitInterviewerScoreInput;
    const score = await interviewsService.submitInterviewerScore(
      id,
      interviewerId,
      institutionId,
      input
    );

    res.status(201).json(score);
  }
);

/**
 * @route   GET /interviews/:id/scores/summary
 * @desc    Return weighted interview score summary
 * @access  HR
 */
export const getInterviewScoresSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const summary = await interviewsService.getInterviewScoresSummary(id, institutionId);
    res.status(200).json(summary);
  }
);

/**
 * @route   GET /interviews/:id/scorecards
 * @desc    List scorecards visible to current HR reviewer
 * @access  HR
 */
export const listInterviewScorecards = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const result = await interviewsService.listInterviewScorecards(id, institutionId, userId);
    res.status(200).json(result);
  }
);

/**
 * @route   POST /interviews/:id/scorecards
 * @desc    Create draft scorecard for current reviewer
 * @access  HR
 */
export const createInterviewScorecard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const scorecard = await interviewsService.createInterviewScorecard(id, institutionId, userId);
    res.status(201).json(scorecard);
  }
);

/**
 * @route   PATCH /interviews/:id/scorecards/:scorecardId
 * @desc    Update draft or submitted scorecard (owner only)
 * @access  HR
 */
export const updateInterviewScorecard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id, scorecardId } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (Array.isArray(scorecardId)) scorecardId = scorecardId[0];

    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as UpdateInterviewScorecardInput;
    const scorecard = await interviewsService.updateInterviewScorecard(
      id,
      scorecardId,
      institutionId,
      userId,
      input
    );
    res.status(200).json(scorecard);
  }
);

/**
 * @route   POST /interviews/:id/scorecards/:scorecardId/submit
 * @desc    Submit scorecard for current reviewer
 * @access  HR
 */
export const submitInterviewScorecard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id, scorecardId } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (Array.isArray(scorecardId)) scorecardId = scorecardId[0];

    const institutionId = req.user!.institutionId;
    const userId = req.user!.id;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const scorecard = await interviewsService.submitInterviewScorecard(
      id,
      scorecardId,
      institutionId,
      userId
    );

    res.status(200).json(scorecard);
  }
);

// ─── Public Routes (Candidate) ─────────────────────────────────────────────

/**
 * @route   GET /interviews/booking/:token
 * @desc    Candidate views interview details & available slots via public token
 * @access  Public (no auth)
 *
 * Rate limited separately.
 */
export const getBookingByToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { token } = req.params;
    if (Array.isArray(token)) token = token[0];

    if (!token || token.length < 24) {
      throw new AppError(400, "Invalid booking token");
    }

    const booking = await interviewsService.getBookingByToken(token);

    res.status(200).json(booking);
  }
);

/**
 * @route   POST /interviews/booking/:token/confirm
 * @desc    Candidate confirms interview at a specific slot
 * @access  Public (no auth)
 *
 * Rate limited separately.
 */
export const confirmBooking = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { token } = req.params;
    if (Array.isArray(token)) token = token[0];
    const input = req.body as ConfirmBookingInput;

    if (!token || token.length < 24) {
      throw new AppError(400, "Invalid booking token");
    }

    const result = await interviewsService.confirmBooking(
      token,
      input.start,
      input.timezone
    );

    res.status(200).json(result);
  }
);
/**
 * @route   GET /candidates/:candidateId/interviews/history
 * @desc    HR views full interview history for a candidate
 * @access  HR
 */
export const getCandidateInterviewHistory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { candidateId } = req.params;
    if (Array.isArray(candidateId)) candidateId = candidateId[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    if (!candidateId) {
      throw new AppError(400, "Missing candidateId");
    }

    const history = await interviewsService.getCandidateInterviewHistory(
      candidateId,
      institutionId
    );

    res.status(200).json({ history });
  }
);

/**
 * @route   GET /candidates/:candidateId/interviews/history/enriched
 * @desc    HR views interview history + score summary for a candidate
 * @access  HR
 */
export const getCandidateInterviewHistoryEnriched = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { candidateId } = req.params;
    if (Array.isArray(candidateId)) candidateId = candidateId[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    if (!candidateId) {
      throw new AppError(400, "Missing candidateId");
    }

    const history = await interviewsService.getCandidateInterviewHistoryEnriched(
      candidateId,
      institutionId,
      req.user!.id
    );

    res.status(200).json({ history });
  }
);

/**
 * @route   GET /interviews/history/application/:applicationId/enriched
 * @desc    HR views interview history + score summary for one application
 * @access  HR
 */
export const getApplicationInterviewHistoryEnriched = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { applicationId } = req.params;
    if (Array.isArray(applicationId)) applicationId = applicationId[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    if (!applicationId) {
      throw new AppError(400, "Missing applicationId");
    }

    const history = await interviewsService.getApplicationInterviewHistoryEnriched(
      applicationId,
      institutionId,
      req.user!.id
    );

    res.status(200).json({ history });
  }
);

/**
 * @route   POST /interviews/:id/summary/generate
 * @desc    HR generates AI post-interview summary via Gemini
 * @access  HR
 */
export const generateInterviewSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    const summary = await interviewsService.generateInterviewSummary(id, institutionId, req.user!.id, reqLocale(req));
    res.status(201).json({ data: summary });
  }
);

/**
 * @route   GET /interviews/:id/summary/latest
 * @desc    HR fetches the latest AI summary for an interview
 * @access  HR
 */
export const getLatestInterviewSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    const summary = await interviewsService.getLatestInterviewSummary(id, institutionId);
    res.status(200).json({ data: summary });
  }
);

/**
 * @route   GET /interviews/assigned-to-me
 * @desc    Interviewer fetches all interviews they are assigned to
 * @access  HR
 */
export const getAssignedToMeInterviews = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    const interviews = await interviewsService.getAssignedToMeInterviews(userId, institutionId);
    res.status(200).json({ data: interviews });
  }
);

/**
 * @route   GET /interviews/:id/scorecard-template
 * @desc    HR gets the current scoring criteria template for an interview
 * @access  HR
 */
export const getInterviewScorecardTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const result = await interviewsService.getInterviewScorecardTemplate(id, institutionId);
    res.status(200).json(result);
  }
);

/**
 * @route   PATCH /interviews/:id/scorecard-template
 * @desc    HR sets or updates the scoring criteria template for an interview
 * @access  HR
 */
export const updateInterviewScorecardTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const institutionId = req.user!.institutionId;
    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    const input = req.body as UpdateInterviewScorecardTemplateInput;
    const result = await interviewsService.updateInterviewScorecardTemplate(id, institutionId, input);
    res.status(200).json(result);
  }
);

/**
 * @route   PATCH /interviews/:id/confirm-secondary
 * @desc    HR confirms one SECONDARY participant as the active secondary
 * @access  HR
 */
export const confirmSecondaryParticipant = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const { userId } = req.body;
    const institutionId = req.user!.institutionId;

    if (!institutionId) {
      throw new AppError(403, "You are not linked to any institution");
    }

    if (!userId || typeof userId !== "string") {
      throw new AppError(400, "userId required");
    }

    await interviewsService.confirmSecondary(id, userId, institutionId);
    res.status(200).json({ success: true });
  }
);

/**
 * POST /interviews/send-reminders
 * Called by pg_cron to trigger pending interview reminder emails.
 * Protected by X-Cron-Secret header.
 */
export const sendInterviewReminders = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const secret = req.headers["x-cron-secret"];
    if (!secret || secret !== env.CRON_SECRET) {
      throw new AppError(401, "Unauthorized");
    }
    const { processInterviewReminders } = await import("@/services/email.service");
    const sent = await processInterviewReminders();
    res.status(200).json({ sent });
  }
);
