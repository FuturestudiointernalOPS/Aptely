import { Response } from "express";
import { createAuthenticatedClient, supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import type {
  DispatchDecisionInput,
  GetTemplatesQuery,
  CommunicationWebhookInput,
} from "./communications.schema";

type DB = ReturnType<typeof createAuthenticatedClient>;

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, "gi"), value || "");
  }
  return out;
}

function mapDecisionToType(action: "ACCEPT" | "REJECT" | "HOLD") {
  if (action === "ACCEPT") return "DECISION_ACCEPT";
  if (action === "REJECT") return "DECISION_REJECT";
  return "DECISION_HOLD";
}

async function assertApplicationInstitution(applicationId: string, institutionId: string, supabaseAdmin: DB) {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select(
      `id, profiles!candidate_id(full_name, email), roles!inner(institution_id, role_dna(full_form_json), institutions(name))`
    )
    .eq("id", applicationId)
    .single();

  if (error || !data) throw new AppError(404, "Application not found");

  const roleData = data.roles as unknown;
  const role = Array.isArray(roleData) ? roleData[0] : (roleData as Record<string, unknown>);
  if (!role || role["institution_id"] !== institutionId) {
    throw new AppError(404, "Application not found");
  }

  return data;
}

export const getCommunicationTemplates = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const query = (res.locals["query"] ?? req.query) as GetTemplatesQuery;

    let dbQuery = supabaseAdmin
      .from("communication_templates")
      .select("id, institution_id, type, title, subject_template, body_template, channel, is_active, created_at")
      .eq("is_active", true)
      .or(`institution_id.eq.${user.institutionId},institution_id.is.null`)
      .order("created_at", { ascending: false });

    if (query.type) {
      dbQuery = dbQuery.eq("type", query.type);
    }

    const { data, error } = await dbQuery;
    if (error) throw new AppError(500, "Failed to fetch communication templates");

    res.status(200).json({ data: data ?? [] });
  }
);

export const dispatchDecisionCommunication = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const { applicationId, decisionAction, templateId, subject, message, sendEmail } =
      req.body as DispatchDecisionInput;

    const app = await assertApplicationInstitution(applicationId, user.institutionId, supabaseAdmin);

    const profile = app.profiles as { full_name?: string | null; email?: string | null } | null;
    const roleData = app.roles as unknown;
    const role = Array.isArray(roleData) ? roleData[0] : (roleData as any);
    const roleDna = Array.isArray(role?.role_dna) ? role.role_dna[0] : role?.role_dna;
    const fullForm = roleDna?.full_form_json || {};
    const institutions = Array.isArray(role?.institutions) ? role.institutions[0] : role?.institutions;

    const candidateName = profile?.full_name || "Candidate";
    const candidateEmail = profile?.email || "";
    const roleTitle = fullForm.title || fullForm.name_role || "Role to complete";
    const institutionName = institutions?.name || "Aptely";

    const type = mapDecisionToType(decisionAction);

    let selectedTemplate: any = null;
    if (templateId) {
      const { data } = await supabaseAdmin
        .from("communication_templates")
        .select("id, type, subject_template, body_template")
        .eq("id", templateId)
        .maybeSingle();
      selectedTemplate = data;
    }

    if (!selectedTemplate) {
      const { data } = await supabaseAdmin
        .from("communication_templates")
        .select("id, type, subject_template, body_template")
        .eq("type", type)
        .or(`institution_id.eq.${user.institutionId},institution_id.is.null`)
        .order("institution_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      selectedTemplate = data;
    }

    const vars = {
      candidateName,
      roleTitle,
      institutionName,
      action: decisionAction,
    };

    const renderedSubject = subject || renderTemplate(selectedTemplate?.subject_template || "Application update", vars);
    const renderedBody = message || renderTemplate(selectedTemplate?.body_template || "Hello {{candidateName}}", vars);

    if (sendEmail && !candidateEmail) {
      throw new AppError(422, "Candidate email is missing");
    }

    let emailQueueId: string | null = null;
    if (sendEmail) {
      const { data: queued, error: queueError } = await supabaseAdmin
        .from("email_queue")
        .insert({
          recipient: candidateEmail,
          subject: renderedSubject,
          html: renderedBody.replace(/\n/g, "<br>"),
          text: renderedBody,
          status: "pending",
          attempts: 0,
          max_attempts: 5,
        })
        .select("id")
        .single();

      if (queueError || !queued) {
        throw new AppError(500, "Failed to queue communication email");
      }
      emailQueueId = queued.id;
    }

    const { data: log, error: logError } = await supabaseAdmin
      .from("communication_logs")
      .insert({
        application_id: applicationId,
        template_id: selectedTemplate?.id || null,
        channel: "EMAIL",
        recipient: candidateEmail || null,
        subject: renderedSubject,
        rendered_body: renderedBody,
        status: sendEmail ? "QUEUED" : "SKIPPED",
        provider: "resend",
        metadata_json: {
          decisionAction,
          emailQueueId,
          actorId: user.id,
        },
      })
      .select("id, status, created_at")
      .single();

    if (logError || !log) throw new AppError(500, "Failed to create communication log");

    res.status(201).json({
      message: sendEmail ? "Decision communication queued" : "Decision communication preview generated",
      data: {
        log,
        preview: {
          recipient: candidateEmail || null,
          subject: renderedSubject,
          body: renderedBody,
        },
      },
    });
  }
);

export const handleCommunicationWebhook = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const payload = req.body as CommunicationWebhookInput;

// Webhook from external provider — no user context, use service role
    const { data, error } = await supabaseAdmin
      .from("communication_logs")
      .update({
        status: payload.event,
        error: payload.error || null,
        metadata_json: payload.metadata || {},
        sent_at: ["SENT", "DELIVERED", "OPENED", "CLICKED"].includes(payload.event)
          ? new Date().toISOString()
          : null,
      })
      .eq("provider_message_id", payload.providerMessageId)
      .select("id");

    if (error) throw new AppError(500, "Failed to process communication webhook");

    // Idempotency: if no row matched (e.g. log row not created yet), still return 200.
    res.status(200).json({ message: "Webhook processed", data: data ?? [] });
  }
);

// ─── POST /communications/templates ──────────────────────────────────────────

export const createCommunicationTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Not linked to any institution");
    const { type, title, subject_template, body_template, channel = "EMAIL" } =
      req.body as { type: string; title: string; subject_template: string; body_template: string; channel?: string };
    if (!type || !title || !subject_template || !body_template) throw new AppError(400, "Missing required fields");
    const { data, error } = await supabaseAdmin
      .from("communication_templates")
      .insert({ institution_id: user.institutionId, type, title, subject_template, body_template, channel, is_active: true })
      .select("id, institution_id, type, title, subject_template, body_template, channel, is_active, created_at")
      .single();
    if (error || !data) throw new AppError(500, "Failed to create template");
    res.status(201).json({ data });
  }
);
