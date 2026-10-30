import { Resend } from "resend";
import { env } from "@/config/env";
import { supabaseAdmin } from "@/config/supabase";
import { retryWithBackoff } from "@/utils/retry";

const resend = new Resend(env.RESEND_API_KEY);

/** Permanent Resend auth failures — retrying the queue is useless. */
function isPermanentResendAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("api key is invalid") ||
    m.includes("invalid api key") ||
    m.includes("missing api key") ||
    m.includes("unauthorized") ||
    /\b401\b/.test(m)
  );
}

export type EmailDeliveryMode = "live" | "log-only";

export function getEmailDeliveryStatus(): {
  mode: EmailDeliveryMode;
  from: string;
  hint?: string;
} {
  if (env.EMAIL_LOG_ONLY === "true") {
    return {
      mode: "log-only",
      from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
      hint: "EMAIL_LOG_ONLY=true — emails are logged, not sent via Resend",
    };
  }
  return {
    mode: "live",
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
  };
}

function logEmailDevOnly(to: string, subject: string, text: string): string {
  const id = `log-only-${Date.now()}`;
  process.stderr.write(
    `[EMAIL][LOG_ONLY] to=${to} subject=${JSON.stringify(subject)} id=${id}\n` +
      `[EMAIL][LOG_ONLY] preview=${JSON.stringify(text.slice(0, 240))}\n`
  );
  return id;
}

if (env.EMAIL_LOG_ONLY === "true") {
  process.stderr.write(
    "⚠️  EMAIL_LOG_ONLY=true — Resend disabled; emails are logged to stdout only\n"
  );
}

function esc(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface CandidateEmailContext {
  candidateEmail: string;
  candidateName: string;
  roleName: string;
  institutionName: string;
  approved: boolean;
  score?: number;
  customMessage?: string;
}

export interface GeneratedTemplates {
  approval: EmailTemplate;
  rejection: EmailTemplate;
}

export interface EmailQueueItem {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  max_attempts: number;
  last_error?: string;
  created_at: string;
  sent_at?: string;
}

// ─── Email Validation ─────────────────────────────────────────────────────────

/**
 * Validate email address format
 * Returns true if valid, false otherwise
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Check for disposable/temporary email domains
 * Returns true if email looks suspicious
 */
function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    "tempmail",
    "throwaway",
    "guerrillamail",
    "10minutemail",
    "yopmail",
    "maildrop",
  ];
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return disposableDomains.some((d) => domain.includes(d));
}

// ─── Email HTML wrapper ───────────────────────────────────────────────────────

function emailWrapper(body: string): string {
  return `<div style="background:#0f1117;padding:32px 0;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#1a1d2e;border-radius:12px;padding:40px;color:#f0f0f0;line-height:1.6;">
    ${body}
    <hr style="border:0;border-top:1px solid #2d3148;margin:24px 0;">
    <p style="font-size:12px;color:#6b7280;margin:0;">Sent via Aptely — Precision HR Software</p>
  </div>
</div>`;
}

// ─── Template generation via Gemini ──────────────────────────────────────────

/**
 * Uses Gemini to generate approval and rejection email templates
 * for a given role, returning structured HTML + text.
 */
export async function generateEmailTemplates(
  roleName: string,
  institutionName: string,
  approvalMessage?: string,
  rejectionMessage?: string
): Promise<GeneratedTemplates> {
  // Build approval template from user's custom message, preserving it verbatim.
  // Only use Gemini for the subject line.
  const approvalBody = approvalMessage
    ? approvalMessage.replace(/\{\{name\}\}/gi, "{{CANDIDATE_NAME}}").replace(/\{\{role\}\}/gi, roleName)
    : `<p>Dear {{CANDIDATE_NAME}},</p><p>We are pleased to inform you that your application for the <strong>${esc(roleName)}</strong> position at <strong>${esc(institutionName)}</strong> has been successful. We will contact you shortly to schedule the next steps.</p><p>Best regards,<br>${esc(institutionName)} Team</p>`;

  const rejectionBody = rejectionMessage
    ? rejectionMessage.replace(/\{\{name\}\}/gi, "{{CANDIDATE_NAME}}").replace(/\{\{role\}\}/gi, roleName)
    : `<p>Dear {{CANDIDATE_NAME}},</p><p>Thank you for your application for the <strong>${esc(roleName)}</strong> position at <strong>${esc(institutionName)}</strong>. After careful consideration, we have decided to move forward with other candidates at this time. We wish you the best in your job search.</p><p>Best regards,<br>${esc(institutionName)} Team</p>`;

  const isApprovalHtml = /<(!DOCTYPE|html|div|p|table|h[1-6])\b/i.test(approvalBody);
  const isRejectionHtml = /<(!DOCTYPE|html|div|p|table|h[1-6])\b/i.test(rejectionBody);

  return {
    approval: {
      subject: `Your application for ${roleName} at ${institutionName}`,
      html: isApprovalHtml ? approvalBody : emailWrapper(approvalBody.replace(/\n/g, "<br>")),
      text: approvalBody.replace(/<[^>]*>/g, ""),
    },
    rejection: {
      subject: `Your application for ${roleName} at ${institutionName}`,
      html: isRejectionHtml ? rejectionBody : emailWrapper(rejectionBody.replace(/\n/g, "<br>")),
      text: rejectionBody.replace(/<[^>]*>/g, ""),
    },
  };
}

// ─── ICS generation ───────────────────────────────────────────────────────────

export interface ICSEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  organizerEmail: string;
  attendeeEmails?: string[];
}

export function generateICS(event: ICSEvent): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aptely//Interview//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${event.uid}@aptely.com`,
    `DTSTART:${fmt(event.start)}`,
    `DTEND:${fmt(event.end)}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : "",
    event.location ? `LOCATION:${event.location}` : "",
    `ORGANIZER:mailto:${event.organizerEmail}`,
    ...(event.attendeeEmails ?? []).map((e) => `ATTENDEE;RSVP=TRUE:mailto:${e}`),
    "STATUS:CONFIRMED",
    `DTSTAMP:${fmt(new Date())}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

// ─── Send emails with retry logic ────────────────────────────────────────────

/**
 * Send a single email with retry logic and queue fallback
 * If email fails after retries, it's added to the queue for later retry
 */
async function sendEmailWithRetry(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Validate email
  if (!isValidEmail(to)) {
    const error = "Invalid email address format";
    console.warn(`[EMAIL] ${error}: ${to}`);
    return { success: false, error };
  }

  // Warn about disposable emails
  if (isDisposableEmail(to)) {
    console.warn(`[EMAIL] Disposable email detected: ${to}`);
  }

  // Dev degraded mode — never call Resend; treat as soft success so métier flows continue.
  if (env.EMAIL_LOG_ONLY === "true") {
    const id = logEmailDevOnly(to, subject, text);
    return { success: true, id };
  }

  try {
    // Try to send with Resend (with retry logic)
    const result = await retryWithBackoff(
      async () =>
        resend.emails.send({
          from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
          to,
          subject,
          html,
          text,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        }),
      { maxRetries: 3, operation: `Send Email to ${to}` }
    );

    if (!result || result.error) {
      throw new Error(result?.error?.message || "Failed to send email");
    }

    const emailId = result.data?.id;
    return { success: true, id: emailId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[EMAIL] Failed to send to ${to}: ${errorMsg}`);

    const permanent = isPermanentResendAuthError(errorMsg);
    if (permanent) {
      console.error(
        "[EMAIL] Permanent Resend auth error — not retrying. " +
          "Fix RESEND_API_KEY / RESEND_FROM_EMAIL (verified domain) or set EMAIL_LOG_ONLY=true for local dev."
      );
    }

    // Queue: pending for transient errors; failed immediately for permanent auth errors.
    try {
      const { data, error: queueError } = await supabaseAdmin
        .from("email_queue")
        .insert({
          recipient: to,
          subject,
          html,
          text,
          status: permanent ? "failed" : "pending",
          attempts: permanent ? 5 : 0,
          max_attempts: 5,
          last_error: errorMsg,
        })
        .select("id")
        .single();

      if (!queueError && data) {
        return {
          success: false,
          id: data.id,
          error: permanent
            ? `Email delivery misconfigured (Resend): ${errorMsg}`
            : `Queued for retry: ${errorMsg}`,
        };
      }
    } catch (queueErr) {
      console.error(
        `[EMAIL] Failed to queue email: ${queueErr instanceof Error ? queueErr.message : String(queueErr)}`
      );
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Sends an approval email to a candidate WITH RETRY & QUEUE
 */
function replaceTags(text: string, candidateName: string, roleName: string): string {
  return text
    .replace(/\{\{CANDIDATE_NAME\}\}/gi, candidateName)
    .replace(/\{\{name\}\}/gi, candidateName)
    .replace(/\{\{candidate\}\}/gi, candidateName)
    .replace(/\{\{role\}\}/gi, roleName);
}

export async function sendApprovalEmail(ctx: CandidateEmailContext): Promise<void> {
  const { candidateEmail, candidateName, roleName, institutionName, customMessage } = ctx;

  const processedMessageText = customMessage
    ? replaceTags(customMessage, candidateName, roleName)
    : "";
  // Detect if customMessage is already full HTML (from Gemini templates) vs plain text
  const isHtml = /<(!DOCTYPE|html|div|p|table|h[1-6])\b/i.test(customMessage || "");
  const processedMessageHtml = isHtml
    ? processedMessageText  // Gemini template: already HTML, already has wrapper
    : esc(processedMessageText).replace(/\n/g, "<br>");

  const html = isHtml
    ? processedMessageHtml
    : emailWrapper(
        customMessage
          ? processedMessageHtml
          : `<p>Dear ${esc(candidateName)},</p><p>We are pleased to inform you that your application for the <strong>${esc(roleName)}</strong> position at <strong>${esc(institutionName)}</strong> has been successful. We will contact you shortly to schedule the next steps.</p><p>Best regards,<br>${esc(institutionName)} Team</p>`
      );

  const text = customMessage
    ? processedMessageText
    : `Dear ${candidateName},\n\nWe are pleased to inform you that your application for the ${roleName} position at ${institutionName} has been successful. We will contact you shortly to schedule the next steps.\n\nBest regards,\n${institutionName} Team`;

  const result = await sendEmailWithRetry(
    candidateEmail,
    `Your application for ${roleName} at ${institutionName} — Next steps`,
    html,
    text
  );

  if (!result.success) {
    // Soft-fail: decision / métier flows must not crash when email infra is down.
    console.warn(`[EMAIL] Approval email not delivered: ${result.error}`);
  }
}

/**
 * Sends a rejection email to a candidate WITH RETRY & QUEUE
 */
export async function sendRejectionEmail(ctx: CandidateEmailContext): Promise<void> {
  const { candidateEmail, candidateName, roleName, institutionName, customMessage } = ctx;

  const processedMessageText = customMessage
    ? replaceTags(customMessage, candidateName, roleName)
    : "";
  // Detect if customMessage is already full HTML (from Gemini templates) vs plain text
  const isHtml = /<(!DOCTYPE|html|div|p|table|h[1-6])\b/i.test(customMessage || "");
  const processedMessageHtml = isHtml
    ? processedMessageText
    : esc(processedMessageText).replace(/\n/g, "<br>");

  const html = isHtml
    ? processedMessageHtml
    : emailWrapper(
        customMessage
          ? processedMessageHtml
          : `<p>Dear ${esc(candidateName)},</p><p>Thank you for applying for the <strong>${esc(roleName)}</strong> position at <strong>${esc(institutionName)}</strong>. After careful consideration, we regret to inform you that we have decided to move forward with other candidates at this time. We wish you the best in your job search.</p><p>Best regards,<br>${esc(institutionName)} Team</p>`
      );

  const text = customMessage
    ? processedMessageText
    : `Dear ${candidateName},\n\nThank you for applying for the ${roleName} position at ${institutionName}. After careful consideration, we regret to inform you that we have decided to move forward with other candidates at this time. We wish you the best in your job search.\n\nBest regards,\n${institutionName} Team`;

  const result = await sendEmailWithRetry(
    candidateEmail,
    `Your application for ${roleName} at ${institutionName}`,
    html,
    text
  );

  if (!result.success) {
    console.warn(`[EMAIL] Rejection email not delivered: ${result.error}`);
  }
}

/**
 * Sends emails to multiple candidates based on their approval status.
 * Returns a summary of sent/failed emails.
 * Failed emails are automatically queued for retry.
 */
export async function sendBulkEmails(
  candidates: CandidateEmailContext[]
): Promise<{ sent: number; failed: number; queued: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  let queued = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      candidate.approved ? await sendApprovalEmail(candidate) : await sendRejectionEmail(candidate);

      sent++;
    } catch (err) {
      // Already queued in sendEmailWithRetry, just count it
      queued++;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      // Only add to errors if explicitly failed (not queued)
      if (!errorMsg.includes("Queued")) {
        failed++;
        errors.push(`Failed to send email to ${candidate.candidateEmail}: ${errorMsg}`);
      }
    }
  }

  return { sent, failed, queued, errors };
}

// ─── Email Queue Processing ───────────────────────────────────────────────────

/**
 * Process pending emails in the queue
 * Runs automatically every 5 minutes
 * Retries up to max_attempts times with exponential backoff
 */
async function processEmailQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const { data: pendingEmails, error: fetchError } = await supabaseAdmin
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50); // Process max 50 at a time

  if (fetchError) {
    console.error(`[EMAIL_QUEUE] Failed to fetch pending emails: ${fetchError.message}`);
    return { processed: 0, sent: 0, failed: 0 };
  }

  if (!pendingEmails || pendingEmails.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  // Dev: drain pending as failed without hammering Resend.
  if (env.EMAIL_LOG_ONLY === "true") {
    const ids = (pendingEmails as EmailQueueItem[]).map((e) => e.id);
    await supabaseAdmin
      .from("email_queue")
      .update({
        status: "failed",
        attempts: 5,
        last_error: "Skipped: EMAIL_LOG_ONLY=true (Resend not called in local/dev)",
      })
      .in("id", ids);
    console.warn(
      `[EMAIL_QUEUE] EMAIL_LOG_ONLY — marked ${ids.length} pending email(s) as failed (not sent)`
    );
    return { processed: ids.length, sent: 0, failed: ids.length };
  }

  let sent = 0;
  let failed = 0;
  let permanentAuthFailure: string | null = null;

  for (const email of pendingEmails as EmailQueueItem[]) {
    if (permanentAuthFailure) {
      failed++;
      await supabaseAdmin
        .from("email_queue")
        .update({
          status: "failed",
          attempts: email.max_attempts,
          last_error: permanentAuthFailure,
        })
        .eq("id", email.id);
      continue;
    }

    try {
      // Send email with retry
      const result = await retryWithBackoff(
        async () =>
          resend.emails.send({
            from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
            to: email.recipient,
            subject: email.subject,
            html: email.html,
            text: email.text || undefined,
          }),
        { maxRetries: 2, operation: `Queue Email ${email.id}` }
      );

      if (result && !result.error) {
        // Success
        await supabaseAdmin
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        sent++;
      } else {
        throw new Error(result?.error?.message || "Unknown error");
      }
    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Increment attempts and update error
      const newAttempts = (email.attempts || 0) + 1;
      const giveUp =
        newAttempts >= email.max_attempts || isPermanentResendAuthError(errorMsg);

      if (isPermanentResendAuthError(errorMsg)) {
        permanentAuthFailure = errorMsg;
        console.error(
          `[EMAIL_QUEUE] Permanent Resend auth error — failing remaining pending jobs: ${errorMsg}`
        );
      }

      if (giveUp) {
        await supabaseAdmin
          .from("email_queue")
          .update({
            status: "failed",
            attempts: Math.max(newAttempts, email.max_attempts),
            last_error: errorMsg,
          })
          .eq("id", email.id);

        console.error(`[EMAIL_QUEUE] Marked as failed: ${email.id} — ${errorMsg}`);
      } else {
        await supabaseAdmin
          .from("email_queue")
          .update({
            attempts: newAttempts,
            last_error: errorMsg,
          })
          .eq("id", email.id);

        console.warn(
          `[EMAIL_QUEUE] Retrying later: ${email.id} (attempt ${newAttempts}/${email.max_attempts})`
        );
      }
    }
  }

  return { processed: pendingEmails.length, sent, failed };
}

/**
 * Process interview reminder emails (24h before)
 * Finds interviews scheduled for tomorrow and sends reminders to candidates
 */
export async function processInterviewReminders(): Promise<number> {
  const nowIso = new Date().toISOString();
  const maxAttempts = 3;

  const { data: jobs, error } = await supabaseAdmin
    .from("interview_reminder_jobs")
    .select("id, interview_id, send_at, channel, attempts")
    .eq("status", "PENDING")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(25);

  if (error) {
    console.error(`[REMINDERS] Failed to fetch reminder jobs: ${error.message}`);
    return 0;
  }

  if (!jobs || jobs.length === 0) {
    return 0;
  }

  let count = 0;

  for (const job of jobs as Array<{
    id: string;
    interview_id: string;
    send_at: string;
    channel: string;
    attempts: number;
  }>) {
    if (job.channel !== "EMAIL") {
      await supabaseAdmin
        .from("interview_reminder_jobs")
        .update({
          status: "FAILED",
          attempts: Math.max(job.attempts ?? 0, 1),
          last_error: `Unsupported channel: ${job.channel}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    const { data: interview, error: interviewError } = await supabaseAdmin
      .from("interviews")
      .select(
        `
        id,
        name,
        scheduled_at,
        meeting_link,
        meeting_location,
        application_id,
        applications!inner(
          profiles!candidate_id(full_name, email),
          roles!inner(role_dna(full_form_json), institutions(name))
        )
      `
      )
      .eq("id", job.interview_id)
      .single();

    if (interviewError || !interview) {
      await supabaseAdmin
        .from("interview_reminder_jobs")
        .update({
          status: "FAILED",
          attempts: Math.max(job.attempts ?? 0, 1),
          last_error: "Interview not found",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    const applicationId = (interview as any).application_id;
    const { data: existingLog, error: logError } = await supabaseAdmin
      .from("communication_logs")
      .select("id")
      .eq("application_id", applicationId)
      .eq("status", "SENT")
      .contains("metadata_json", { interviewId: interview.id, type: "REMINDER_24H" })
      .maybeSingle();

    if (logError) {
      console.error(`[REMINDERS] Error checking logs for interview ${interview.id}:`, logError);
    }

    if (existingLog) {
      await supabaseAdmin
        .from("interview_reminder_jobs")
        .update({ status: "SENT", updated_at: new Date().toISOString() })
        .eq("id", job.id);
      continue;
    }

    const app = interview.applications as any;
    const profile = Array.isArray(app?.profiles) ? app.profiles[0] : app?.profiles;
    const role = Array.isArray(app?.roles) ? app.roles[0] : app?.roles;
    const institution = Array.isArray(role?.institutions)
      ? role.institutions[0]
      : role?.institutions;
    const roleDna = Array.isArray(role?.role_dna) ? role.role_dna[0] : role?.role_dna;
    const roleForm = roleDna?.full_form_json || {};

    if (!profile?.email) {
      await supabaseAdmin
        .from("interview_reminder_jobs")
        .update({
          status: "FAILED",
          attempts: Math.max(job.attempts ?? 0, 1),
          last_error: "Candidate email missing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    const candidateName = profile.full_name || "Candidate";
    const roleTitle = roleForm?.title || interview.name || "Position";
    const institutionName = institution?.name || "Aptely";
    const dateTimeStr = new Date(interview.scheduled_at!).toLocaleString();
    const location =
      interview.meeting_location || interview.meeting_link || "Online (check link in calendar)";

    const subject = `Reminder: Interview for ${roleTitle} at ${institutionName} tomorrow`;
    const html = emailWrapper(`
        <h2 style="color:#2563EB;margin-top:0;">Interview Reminder</h2>
        <p>Hello ${esc(candidateName)},</p>
        <p>This is a friendly reminder for your upcoming interview for the <strong>${esc(roleTitle)}</strong> position at <strong>${esc(institutionName)}</strong>.</p>
        <div style="background-color:#F3F4F6;padding:16px;border-radius:8px;margin:20px 0;">
          <p style="margin:5px 0;"><strong>Date &amp; Time:</strong> ${esc(dateTimeStr)}</p>
          <p style="margin:5px 0;"><strong>Location/Link:</strong> ${esc(location)}</p>
        </div>
        <p>We look forward to speaking with you!</p>
        <p>Best regards,<br>${esc(institutionName)} Recruiting Team</p>
    `);
    const text = `Hello ${candidateName},\n\nThis is a reminder for your interview for the ${roleTitle} position at ${institutionName} tomorrow.\n\nTime: ${dateTimeStr}\nLocation/Link: ${location}\n\nWe look forward to meeting you!\n\nBest regards,\n${institutionName} Recruiting Team`;

    try {
      const result = await sendEmailWithRetry(profile.email, subject, html, text);

      if (result.success) {
        await supabaseAdmin.from("communication_logs").insert({
          application_id: applicationId,
          channel: "EMAIL",
          recipient: profile.email,
          subject,
          rendered_body: text,
          status: "SENT",
          provider: "resend",
          metadata_json: {
            interviewId: interview.id,
            type: "REMINDER_24H",
            jobId: job.id,
          },
        });

        await supabaseAdmin
          .from("interview_reminder_jobs")
          .update({ status: "SENT", updated_at: new Date().toISOString() })
          .eq("id", job.id);

        const { error: sentEventError } = await supabaseAdmin.from("interview_activity_events").insert({
          interview_id: interview.id,
          event_type: "REMINDER_SENT",
          payload_json: { jobId: job.id, channel: job.channel },
          actor_id: null,
        });
        if (sentEventError) {
          console.warn(`[REMINDERS] Failed to record REMINDER_SENT event for interview ${interview.id}:`, sentEventError.message);
        }

        count += 1;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const attempts = (job.attempts ?? 0) + 1;
      const status = attempts >= maxAttempts ? "FAILED" : "PENDING";

      await supabaseAdmin
        .from("interview_reminder_jobs")
        .update({
          status,
          attempts,
          last_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (status === "FAILED") {
        const { error: failedEventError } = await supabaseAdmin.from("interview_activity_events").insert({
          interview_id: interview.id,
          event_type: "REMINDER_FAILED",
          payload_json: { jobId: job.id, channel: job.channel, error: errorMsg },
          actor_id: null,
        });
        if (failedEventError) {
          console.warn(`[REMINDERS] Failed to record REMINDER_FAILED event for interview ${interview.id}:`, failedEventError.message);
        }
      }
      console.error(`[REMINDERS] Failed to process reminder for interview ${interview.id}:`, err);
    }
  }

  if (count > 0) {
  }

  return count;
}

/**
 * processInterviewAutoReminders — Polls SCHEDULED interviews and queues 48h and 2h reminder emails.
 * Uses reminder_sent_48h / reminder_sent_2h flags to prevent duplicates.
 * Runs every 5 min alongside the email queue processor.
 */
async function processInterviewAutoReminders(): Promise<void> {
  const now = new Date();

  // Windows for 48h and 2h reminders (±15 min tolerance)
  const w48Start = new Date(now.getTime() + (48 * 60 - 15) * 60 * 1000).toISOString();
  const w48End = new Date(now.getTime() + (48 * 60 + 15) * 60 * 1000).toISOString();
  const w2Start = new Date(now.getTime() + (2 * 60 - 15) * 60 * 1000).toISOString();
  const w2End = new Date(now.getTime() + (2 * 60 + 15) * 60 * 1000).toISOString();

  const [{ data: remind48 }, { data: remind2 }] = await Promise.all([
    supabaseAdmin
      .from("interviews")
      .select("id, name, scheduled_at, meeting_link, application_id")
      .eq("status", "SCHEDULED")
      .eq("reminder_sent_48h", false)
      .gte("scheduled_at", w48Start)
      .lte("scheduled_at", w48End),
    supabaseAdmin
      .from("interviews")
      .select("id, name, scheduled_at, meeting_link, application_id")
      .eq("status", "SCHEDULED")
      .eq("reminder_sent_2h", false)
      .gte("scheduled_at", w2Start)
      .lte("scheduled_at", w2End),
  ]);

  async function queueReminderEmail(
    interview: {
      id: string;
      name: string;
      scheduled_at: string;
      meeting_link: string | null;
      application_id: string;
    },
    type: "48h" | "2h"
  ) {
    const { data: app } = await supabaseAdmin
      .from("applications")
      .select(
        "profiles:candidate_id(full_name, email), roles!inner(role_dna(full_form_json), institutions!inner(name))"
      )
      .eq("id", interview.application_id)
      .single();

    if (!app) return;

    const candidate = (app as any).profiles as { full_name: string | null; email: string } | null;
    const role = (app as any).roles as { role_dna?: any; institutions: { name: string } } | null;
    if (!candidate?.email || !role) return;
    const roleDna = Array.isArray(role.role_dna) ? role.role_dna[0] : role.role_dna;
    const roleTitle = (roleDna?.full_form_json?.title as string) ?? "le poste";

    const candidateName = candidate.full_name ?? candidate.email;
    const scheduledDate = new Date(interview.scheduled_at).toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const subject =
      type === "48h"
        ? `Rappel : votre entretien est dans 2 jours — ${roleTitle} chez ${role.institutions.name}`
        : `Votre entretien commence bientôt — ${roleTitle}`;

    const html =
      type === "48h"
        ? `<p>Bonjour ${candidateName},</p>
         <p>Rappel : votre entretien <strong>${interview.name}</strong> pour le poste <strong>${roleTitle}</strong> chez <strong>${role.institutions.name}</strong> est prévu le <strong>${scheduledDate}</strong>.</p>
         ${interview.meeting_link ? `<p><a href="${interview.meeting_link}">Rejoindre la réunion</a></p>` : ""}
         <p>À très bientôt,<br/>L'équipe ${role.institutions.name}</p>`
        : `<p>Bonjour ${candidateName},</p>
         <p>Votre entretien <strong>${interview.name}</strong> commence dans environ 2 heures (<strong>${scheduledDate}</strong>).</p>
         ${interview.meeting_link ? `<p><a href="${interview.meeting_link}">Rejoindre maintenant</a></p>` : ""}
         <p>Bonne chance !<br/>L'équipe ${role.institutions.name}</p>`;

    await supabaseAdmin.from("email_queue").insert({
      recipient: candidate.email,
      subject,
      html,
      text: subject,
      status: "pending",
      attempts: 0,
      max_attempts: 3,
    });

    const flagColumn = type === "48h" ? "reminder_sent_48h" : "reminder_sent_2h";
    await supabaseAdmin
      .from("interviews")
      .update({ [flagColumn]: true })
      .eq("id", interview.id);
  }

  const tasks: Promise<void>[] = [];
  for (const iv of remind48 ?? []) tasks.push(queueReminderEmail(iv as any, "48h"));
  for (const iv of remind2 ?? []) tasks.push(queueReminderEmail(iv as any, "2h"));
  await Promise.allSettled(tasks);
}

export async function sendEmailDirect(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendEmailWithRetry(to, subject, html, text, attachments);
}

// ─── Wave invite email ────────────────────────────────────────────────────────

export interface WaveInviteContext {
  candidateEmail: string;
  candidateName: string;
  waveName: string;
  roleTitle: string;
  institutionName: string;
  bookingUrl: string;
  bookingCloseAt?: string | null;
}

export async function sendWaveInviteEmail(ctx: WaveInviteContext): Promise<void> {
  const {
    candidateEmail,
    candidateName,
    waveName,
    roleTitle,
    institutionName,
    bookingUrl,
    bookingCloseAt,
  } = ctx;

  const deadlineText = bookingCloseAt
    ? `<p>La réservation est ouverte jusqu&apos;au <strong>${new Date(bookingCloseAt).toLocaleDateString("fr-FR")}</strong>.</p>`
    : "";

  const html = emailWrapper(`
    <p>Bonjour ${candidateName},</p>
    <p>Vous êtes invité(e) à participer à la prochaine étape du processus de recrutement pour le poste de <strong>${roleTitle}</strong> chez <strong>${institutionName}</strong>.</p>
    <p>Cette étape s&apos;inscrit dans la vague <strong>${waveName}</strong>. Veuillez choisir un créneau d&apos;entretien en cliquant sur le lien ci-dessous :</p>
    ${deadlineText}
    <p style="text-align:center;margin:24px 0;">
      <a href="${bookingUrl}" style="display:inline-block;background-color:#FF6B35;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Réserver mon créneau</a>
    </p>
    <p>Si le lien ne fonctionne pas, copiez-collez cette URL dans votre navigateur :<br><small>${bookingUrl}</small></p>
    <p>Bonne chance !<br>${institutionName}</p>
  `);

  const text = `Bonjour ${candidateName},\n\nVous êtes invité(e) à participer à la prochaine étape du recrutement pour ${roleTitle} chez ${institutionName} (vague : ${waveName}).\n\nRéservez votre créneau ici : ${bookingUrl}${bookingCloseAt ? `\n\nRéservation ouverte jusqu'au ${new Date(bookingCloseAt).toLocaleDateString("fr-FR")}.` : ""}\n\nBonne chance !`;

  await sendEmailWithRetry(
    candidateEmail,
    `Invitation — ${roleTitle} chez ${institutionName}`,
    html,
    text
  );
}

/**
 * Start background email queue processor
 * Runs every 5 minutes by default
 */
export function startEmailQueueProcessor(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  process.stderr.write(`[EMAIL_QUEUE] Starting background processor (every ${intervalMs}ms)\n`);

  // Process queue immediately on startup
  processEmailQueue().catch((err) => {
    console.error("[EMAIL_QUEUE] Startup processing failed:", err);
  });

  // Process reminders immediately on startup
  processInterviewReminders().catch((err) => {
    console.error("[REMINDERS] Startup processing failed:", err);
  });

  processInterviewAutoReminders().catch((err) => {
    console.error("[AUTO_REMINDERS] Startup processing failed:", err);
  });

  // Then every interval
  return setInterval(() => {
    // Process queue
    processEmailQueue().catch((err) => {
      console.error("[EMAIL_QUEUE] Processing failed:", err);
    });

    // Process reminders (job-based 24h)
    processInterviewReminders().catch((err) => {
      console.error("[REMINDERS] Processing failed:", err);
    });

    // Process auto-reminders (48h + 2h via flags)
    processInterviewAutoReminders().catch((err) => {
      console.error("[AUTO_REMINDERS] Processing failed:", err);
    });
  }, intervalMs);
}
