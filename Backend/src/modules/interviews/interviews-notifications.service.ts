import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";
import { AppError } from "@/middleware/error.middleware";
import { generateICS, sendEmailDirect, type EmailAttachment } from "@/services/email.service";
import type { NotifyInterviewInput } from "./interviews.schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InterviewRowForNotification {
  id: string;
  application_id: string;
  name: string;
  role_snapshot: Record<string, unknown>;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  meeting_link: string | null;
  meeting_location: string | null;
  booking_token: string;
}

interface NotificationContext {
  candidateProfile: { full_name: string | null; email: string | null } | null;
  participantProfiles: Array<{ userId: string; fullName: string | null; email: string | null }>;
  actorProfile: { full_name: string | null; email: string | null } | null;
  institutionName: string;
  roleTitle: string;
  candidateName: string;
  scheduledAtText: string;
  formatLabel: string;
  locationLabel: string;
  meetingLink: string | null;
  participantNames: string;
  baseDefaultBody: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function interpolateTemplate(template: string, replacements: Record<string, string>): string {
  let content = template;

  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    content = content.replace(pattern, value);
  }

  return content;
}

async function loadNotificationContext(
  interview: InterviewRowForNotification
): Promise<NotificationContext> {
  const { data: application, error: appError } = await supabaseAdmin
    .from("applications")
    .select("candidate_id, role_id")
    .eq("id", interview.application_id)
    .single();

  if (appError || !application) {
    throw new AppError(404, "Interview application not found");
  }

  const [{ data: participantRows, error: participantError }, { data: candidateProfile, error: candidateError }] = await Promise.all([
    supabaseAdmin
      .from("interview_participants")
      .select("user_id, profiles!user_id(full_name, email)")
      .eq("interview_id", interview.id),
    supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", application.candidate_id)
      .maybeSingle(),
  ]);

  if (participantError) {
    throw new AppError(500, "Failed to load interview participants");
  }
  if (candidateError) {
    throw new AppError(500, "Failed to load candidate profile");
  }

  let institutionName = "Institution";
  const { data: role } = await supabaseAdmin
    .from("roles")
    .select("institution_id")
    .eq("id", application.role_id)
    .maybeSingle();

  if (role?.institution_id) {
    const { data: inst } = await supabaseAdmin
      .from("institutions")
      .select("name")
      .eq("id", role.institution_id)
      .maybeSingle();

    if (inst) {
      institutionName = inst.name || "Institution";
    }
  }

  const roleSnapshot = (interview.role_snapshot ?? {}) as Record<string, unknown>;
  const roleTitle = (roleSnapshot.title as string) || "Role";
  const candidateName = candidateProfile?.full_name || "Candidate";

  const participantProfiles = (participantRows ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id as string,
      fullName: profile?.full_name || null,
      email: profile?.email || null,
    };
  });

  const participantNames = participantProfiles
    .map((p) => p.fullName || p.email || p.userId)
    .filter(Boolean)
    .join(", ");

  const scheduledAtText = interview.scheduled_at
    ? new Date(interview.scheduled_at).toISOString()
    : "TBD";

  const formatLabel = interview.meeting_location ? "IN_PERSON" : "REMOTE";
  const locationLabel = interview.meeting_location || interview.meeting_link || "TBD";

  const meetingLink = interview.meeting_link || null;

  const baseDefaultBody = [
    `Interview: ${interview.name}`,
    `Candidate: ${candidateName}`,
    `Role: ${roleTitle}`,
    `Institution: ${institutionName}`,
    `DateTime: ${scheduledAtText}`,
    `Format: ${formatLabel}`,
    `Location/Link: ${locationLabel}`,
    `Interviewers: ${participantNames || "TBD"}`,
    ...(meetingLink ? [``, `Meeting link: ${meetingLink}`] : []),
  ].join("\n");

  return {
    candidateProfile,
    participantProfiles,
    actorProfile: null,
    institutionName,
    roleTitle,
    candidateName,
    scheduledAtText,
    formatLabel,
    locationLabel,
    meetingLink,
    participantNames,
    baseDefaultBody,
  };
}

function buildRecipientList(
  input: NotifyInterviewInput,
  candidateProfile: { full_name: string | null; email: string | null } | null,
  participantProfiles: Array<{ userId: string; fullName: string | null; email: string | null }>,
  actorProfile: { full_name: string | null; email: string | null } | null
): { recipients: Array<{ email: string; type: "candidate" | "interviewer" | "hr"; fullName: string | null }>; skippedNoEmail: number } {
  const requestedType = input.recipientType;
  const recipientsRaw: Array<{ email: string | null; type: "candidate" | "interviewer" | "hr"; fullName: string | null }> = [];

  if (requestedType === "candidate" || requestedType === "all") {
    recipientsRaw.push({
      email: candidateProfile?.email || null,
      type: "candidate",
      fullName: candidateProfile?.full_name || null,
    });
  }

  if (requestedType === "interviewers" || requestedType === "all") {
    for (const participant of participantProfiles) {
      recipientsRaw.push({
        email: participant.email,
        type: "interviewer",
        fullName: participant.fullName,
      });
    }
  }

  if (requestedType === "hr" || requestedType === "all") {
    recipientsRaw.push({
      email: actorProfile?.email || null,
      type: "hr",
      fullName: actorProfile?.full_name || null,
    });
  }

  const uniqueByEmail = new Map<string, { email: string; type: "candidate" | "interviewer" | "hr"; fullName: string | null }>();
  let skippedNoEmail = 0;

  for (const recipient of recipientsRaw) {
    if (!recipient.email || recipient.email.trim().length === 0) {
      skippedNoEmail += 1;
      continue;
    }

    const normalizedEmail = recipient.email.trim().toLowerCase();
    if (uniqueByEmail.has(normalizedEmail)) continue;

    uniqueByEmail.set(normalizedEmail, {
      email: normalizedEmail,
      type: recipient.type,
      fullName: recipient.fullName,
    });
  }

  return { recipients: Array.from(uniqueByEmail.values()), skippedNoEmail };
}

async function queueNotificationEmails(
  recipients: Array<{ email: string; type: "candidate" | "interviewer" | "hr"; fullName: string | null }>,
  input: NotifyInterviewInput,
  context: NotificationContext,
  interview: InterviewRowForNotification
): Promise<void> {
  const queueRows = recipients.map((recipient) => {
    const recipientName = recipient.fullName || recipient.email;
    const subject = input.subject?.trim() || `Interview update — ${context.candidateName} (${context.roleTitle})`;
    const textBody = interpolateTemplate(input.body?.trim() || context.baseDefaultBody, {
      recipientName,
      candidateName: context.candidateName,
      roleTitle: context.roleTitle,
      institutionName: context.institutionName,
      interviewName: interview.name,
      dateTime: context.scheduledAtText,
      format: context.formatLabel,
      location: context.locationLabel,
      interviewers: context.participantNames || "TBD",
    });

    const htmlBody = `<div style=\"font-family:Arial,sans-serif;white-space:pre-wrap;color:#0f172a;\">${escapeHtml(textBody)}</div>`;

    return {
      recipient: recipient.email,
      subject,
      html: htmlBody,
      text: textBody,
      status: "pending",
    };
  });

  if (queueRows.length > 0) {
    const { error: queueError } = await supabaseAdmin
      .from("email_queue")
      .insert(queueRows);

    if (queueError) {
      throw new AppError(500, "Failed to queue interview notification emails");
    }
  }

  if (interview.scheduled_at) {
    const startDate = new Date(interview.scheduled_at);
    const durationMs = (interview.duration_minutes ?? 60) * 60 * 1000;
    const endDate = new Date(startDate.getTime() + durationMs);
    const icsContent = generateICS({
      uid: interview.id,
      title: `${interview.name} — ${context.candidateName}`,
      start: startDate,
      end: endDate,
      location: interview.meeting_location || interview.meeting_link || undefined,
      description: `Entretien ${context.roleTitle} chez ${context.institutionName}\nCandidat : ${context.candidateName}`,
      organizerEmail: context.actorProfile?.email || env.RESEND_FROM_EMAIL,
      attendeeEmails: recipients.map((r) => r.email),
    });
    const attachment: EmailAttachment = {
      filename: "entretien.ics",
      content: Buffer.from(icsContent).toString("base64"),
      contentType: "text/calendar; method=REQUEST",
    };
    const subject = queueRows[0]?.subject ?? `Interview update — ${context.candidateName} (${context.roleTitle})`;
    for (const recipient of recipients) {
      const row = queueRows.find((r) => r.recipient === recipient.email);
      if (!row) continue;
      sendEmailDirect(recipient.email, subject, row.html, row.text, [attachment]).catch((err) => {
        console.error(`[ICS] Failed to send .ics to ${recipient.email}:`, err);
      });
    }
  }
}

// ─── Exported Functions ─────────────────────────────────────────────────────

export async function notifyInterviewRecipients(
  interview: InterviewRowForNotification,
  input: NotifyInterviewInput,
  actorUserId: string
): Promise<{
  queued: number;
  recipients: Array<{ email: string; type: "candidate" | "interviewer" | "hr" }>;
  skippedNoEmail: number;
  sendEmail: boolean;
}> {
  const context = await loadNotificationContext(interview);

  const { data: actorProfile, error: actorError } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", actorUserId)
    .maybeSingle();
  if (actorError) {
    throw new AppError(500, "Failed to load actor profile");
  }
  context.actorProfile = actorProfile;

  const { recipients, skippedNoEmail } = buildRecipientList(
    input, context.candidateProfile, context.participantProfiles, actorProfile
  );

  if (!input.sendEmail) {
    return {
      queued: 0,
      recipients: recipients.map((r) => ({ email: r.email, type: r.type })),
      skippedNoEmail,
      sendEmail: false,
    };
  }

  await queueNotificationEmails(recipients, input, context, interview);

  return {
    queued: recipients.length,
    recipients: recipients.map((r) => ({ email: r.email, type: r.type })),
    skippedNoEmail,
    sendEmail: true,
  };
}

export async function notifyInterviewerQuestionPacks(
  interview: InterviewRowForNotification,
  input: { sendEmail: boolean },
  getQuestionPack: (interviewId: string, interviewerId: string, institutionId: string) => Promise<{ duringQuestions: Array<{ questionText: string }> }>,
  institutionId: string
): Promise<{
  queued: number;
  recipients: Array<{ email: string; interviewerId: string }>;
  skippedNoEmail: number;
  skippedNoQuestions: number;
  sendEmail: boolean;
}> {
  const [{ data: participants, error: participantsError }, { data: application, error: appError }] = await Promise.all([
    supabaseAdmin
      .from("interview_participants")
      .select("user_id, profiles!user_id(full_name, email)")
      .eq("interview_id", interview.id),
    supabaseAdmin
      .from("applications")
      .select("id")
      .eq("id", interview.application_id)
      .single(),
  ]);

  if (participantsError) {
    throw new AppError(500, "Failed to load interview participants");
  }
  if (appError || !application) {
    throw new AppError(404, "Interview application not found");
  }

  const participantRows = (participants ?? []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      interviewerId: row.user_id as string,
      fullName: (profile?.full_name as string | null) ?? null,
      email: (profile?.email as string | null) ?? null,
    };
  });

  let skippedNoEmail = 0;
  let skippedNoQuestions = 0;

  const queueRows: Array<{
    recipient: string;
    subject: string;
    html: string;
    text: string;
    status: "pending";
  }> = [];

  const notifiedRecipients: Array<{ email: string; interviewerId: string }> = [];

  const CONCURRENCY = 5;
  const validParticipants = participantRows.filter((p) => {
    if (!p.email?.trim()) { skippedNoEmail += 1; return false; }
    return true;
  });

  for (let i = 0; i < validParticipants.length; i += CONCURRENCY) {
    const batch = validParticipants.slice(i, i + CONCURRENCY);
    const packs = await Promise.all(
      batch.map((participant) =>
        getQuestionPack(interview.id, participant.interviewerId, institutionId)
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const participant = batch[j];
      const pack = packs[j];
      const email = participant.email!.trim().toLowerCase();

      if (pack.duringQuestions.length === 0) {
        skippedNoQuestions += 1;
        continue;
      }

      const interviewerName = participant.fullName || email;
      const scheduledAt = interview.scheduled_at ? new Date(interview.scheduled_at).toISOString() : "TBD";
      const questionsList = pack.duringQuestions
        .map((question, index) => `${index + 1}. ${question.questionText}`)
        .join("\n");

      const textBody = [
        `Hello ${interviewerName},`,
        "",
        `Here is your interview question pack for: ${interview.name}`,
        `Scheduled at: ${scheduledAt}`,
        "",
        "Questions:",
        questionsList,
        "",
        "Please review these questions before the interview.",
      ].join("\n");

      queueRows.push({
        recipient: email,
        subject: `Interview question pack - ${interview.name}`,
        html: `<div style=\"font-family:Arial,sans-serif;white-space:pre-wrap;color:#0f172a;\">${escapeHtml(textBody)}</div>`,
        text: textBody,
        status: "pending",
      });

      notifiedRecipients.push({ email, interviewerId: participant.interviewerId });
    }
  }

  if (!input.sendEmail) {
    return {
      queued: 0,
      recipients: notifiedRecipients,
      skippedNoEmail,
      skippedNoQuestions,
      sendEmail: false,
    };
  }

  if (queueRows.length > 0) {
    const { error: queueError } = await supabaseAdmin
      .from("email_queue")
      .insert(queueRows);

    if (queueError) {
      throw new AppError(500, "Failed to queue interviewer question emails");
    }
  }

  return {
    queued: queueRows.length,
    recipients: notifiedRecipients,
    skippedNoEmail,
    skippedNoQuestions,
    sendEmail: true,
  };
}
