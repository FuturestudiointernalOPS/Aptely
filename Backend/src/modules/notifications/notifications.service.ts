import { supabaseAdmin } from "@/config/supabase";

export type NotificationType =
  | "OFFER_RECEIVED"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "OFFER_COUNTERED"
  | "APPLICATION_RECEIVED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_REMINDER"
  | "INTERVIEW_CANCELLED"
  | "DECISION_MADE"
  | "APPLICATION_STATUS_CHANGED"
  | "ONBOARDING_TASK_ASSIGNED"
  | "ONBOARDING_TASK_COMPLETED"
  | "TEAM_MEMBER_JOINED"
  | "GENERAL";

// Centralized frontend links referenced by notifications
export const NOTIF_LINKS = {
  candidateOffers:     "/candidate/offers",
  candidateDashboard:  "/candidate/dashboard",
  candidateOnboarding: "/candidate/onboarding",
  companyOffers:       "/company/recruitment/offers",
  companyInterviews:   "/company/recruitment/interviews",
  companyTeam:         "/company/settings/hr",
  companyApplications: "/company/recruitment/applications",
} as const;

// i18n keys — frontend translates via t(locale, title, fallback)
export const NOTIF_TITLES = {
  OFFER_RECEIVED:             "notification.offerReceived",
  OFFER_ACCEPTED:             "notification.offerAccepted",
  OFFER_REJECTED:             "notification.offerRejected",
  OFFER_COUNTERED:            "notification.offerCountered",
  APPLICATION_RECEIVED:        "notification.applicationReceived",
  INTERVIEW_SCHEDULED:        "notification.interviewScheduled",
  INTERVIEW_REMINDER:         "notification.interviewReminder",
  INTERVIEW_CANCELLED:        "notification.interviewCancelled",
  DECISION_MADE:              "notification.decisionMade",
  APPLICATION_STATUS_CHANGED: "notification.applicationStatusChanged",
  ONBOARDING_TASK_ASSIGNED:   "notification.onboardingTaskAssigned",
  ONBOARDING_TASK_COMPLETED:  "notification.onboardingTaskCompleted",
  TEAM_MEMBER_JOINED:         "notification.teamMemberJoined",
  GENERAL:                    "notification.general",
} satisfies Record<NotificationType, string>;

export interface CreateNotificationParams {
  userId: string;
  institutionId?: string | null;
  type: NotificationType;
  /** i18n key — use NOTIF_TITLES[type] */
  title: string;
  /** optional context stored alongside (role name, date, etc.) */
  body?: string | null;
  link?: string | null;
}

/**
 * Fire-and-forget — never throws. Designed to be called without awaiting in controllers.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id:        params.userId,
      institution_id: params.institutionId ?? null,
      type:           params.type,
      title:          params.title,
      body:           params.body ?? null,
      link:           params.link ?? null,
    });
    if (error) {
      console.error("[Notifications] Insert failed:", error.message);
    }
  } catch (err) {
    console.error("[Notifications] Unexpected error:", err);
  }
}
