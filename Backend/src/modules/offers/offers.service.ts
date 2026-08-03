import { supabaseAdmin, createAuthenticatedClient } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { writeAuditLog } from "@/middleware/audit.middleware";
import { dispatchWebhook } from "@/modules/webhooks/webhooks.service";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import type { Response } from "express";
import PDFDocument from "pdfkit";

export type DB = ReturnType<typeof createAuthenticatedClient>;

// ─── Offer State Machine ──────────────────────────────────────────────────────

export const OFFER_VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:    ["SENT"],
  SENT:     ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED:  [],
};

export function resolveOfferActorType(
  input: string | { institutionId?: string | null }
): "HR" | "CANDIDATE" {
  if (typeof input === "string") {
    if (input === "HR" || input === "CANDIDATE") return input;
    return "CANDIDATE";
  }
  return input?.institutionId ? "HR" : "CANDIDATE";
}

// ─── DB Assertions ───────────────────────────────────────────────────────────

export async function assertApplicationInstitution(applicationId: string, institutionId: string, supabaseAdmin: DB) {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("id, roles!inner(institution_id)")
    .eq("id", applicationId)
    .single();

  if (error || !data) throw new AppError(404, "Application not found");

  const roleData = data.roles as unknown;
  const role = Array.isArray(roleData) ? roleData[0] : (roleData as { institution_id: string });

  if (!role || role.institution_id !== institutionId) {
    throw new AppError(404, "Application not found");
  }

  return data;
}

export async function assertOfferInstitution(offerId: string, institutionId: string, supabaseAdmin: DB) {
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select("id, application_id, status, current_version, applications!inner(roles!inner(institution_id))")
    .eq("id", offerId)
    .single();

  if (error || !data) throw new AppError(404, "Offer not found");

  const appData = data.applications as unknown;
  const app = Array.isArray(appData) ? appData[0] : (appData as { roles: any });
  const roleData = app?.roles;
  const role = Array.isArray(roleData) ? roleData[0] : (roleData as { institution_id: string });

  if (!role || role.institution_id !== institutionId) {
    throw new AppError(404, "Offer not found");
  }

  return data;
}

export async function assertOfferAccessByUser(offerId: string, user: AuthenticatedRequest["user"]) {
  if (!user) throw new AppError(401, "Unauthorized");

  const { data, error } = await supabaseAdmin
    .from("offers")
    .select(
      `id, application_id, status, current_version, counter_terms, counter_round,
      applications!inner(id, candidate_id, roles!inner(institution_id))`
    )
    .eq("id", offerId)
    .single();

  if (error || !data) throw new AppError(404, "Offer not found");

  const appData = data.applications as unknown;
  const app = Array.isArray(appData) ? appData[0] : appData;
  if (!app || typeof app !== "object") throw new AppError(404, "Offer application not found");
  const roleData = (app as Record<string, unknown>).roles;
  const role = Array.isArray(roleData) ? roleData[0] : roleData;
  if (!role || typeof role !== "object") throw new AppError(404, "Offer role not found");

  const isHrAllowed = !!user.institutionId && (role as Record<string, unknown>).institution_id === user.institutionId;
  const isCandidateAllowed = (app as Record<string, unknown>)?.candidate_id === user.id;

  if (!isHrAllowed && !isCandidateAllowed) throw new AppError(403, "Access denied");

  return { offer: data, application: app as Record<string, unknown>, role };
}

// ─── Utility Helpers ─────────────────────────────────────────────────────────

export function getOfferCounterData(offer: Record<string, unknown>) {
  return {
    counterTerms: (offer.counter_terms ?? {}) as Record<string, unknown>,
    counterRound: Number(offer.counter_round ?? 0),
  };
}

export function extractRoleDna(roleData: unknown): Record<string, unknown> {
  const dna = Array.isArray(roleData) ? roleData[0] : roleData;
  return (dna as Record<string, unknown>)?.full_form_json as Record<string, unknown> ?? {};
}

export function renderPdfField(doc: InstanceType<typeof PDFDocument>, label: string, value: unknown, styled = false) {
  if (styled) {
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a2e").text(`${label} :`, { continued: true });
    doc.font("Helvetica").fillColor("#333333").text(`  ${String(value || "—")}`);
  } else {
    doc.fontSize(11).font("Helvetica-Bold").text(`${label}:`, { continued: true });
    doc.font("Helvetica").text(`  ${String(value || "—")}`);
  }
  doc.moveDown(0.35);
}

// ─── Business Logic ──────────────────────────────────────────────────────────

export async function writeOfferAudit(offerId: string, eventType: string, actorId: string, payload: Record<string, unknown>, supabaseAdmin: DB) {
  const { error } = await supabaseAdmin.from("offer_audit_logs").insert({
    offer_id: offerId,
    event_type: eventType,
    payload_json: payload,
    actor_id: actorId,
  });
  if (error) {
    console.warn(`[writeOfferAudit] failed for offer=${offerId} event=${eventType}: ${error.message}`);
  }
}

export async function autoInstantiateOnboardingChecklist(
  applicationId: string,
  institutionId: string,
  actorId: string
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("onboarding_checklists")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();

  if (existing) return;

  const { data: template } = await supabaseAdmin
    .from("onboarding_templates")
    .select("id, name, tasks_json")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!template) return;

  const { data: checklist, error: checklistError } = await supabaseAdmin
    .from("onboarding_checklists")
    .insert({
      application_id: applicationId,
      template_id: template.id,
      status: "NOT_STARTED",
    })
    .select("id")
    .single();

  if (checklistError || !checklist) return;

  const rawTasks = Array.isArray(template.tasks_json) ? template.tasks_json : [];
  const tasks = rawTasks
    .filter((t): t is Record<string, unknown> => t != null && typeof t === "object")
    .map((task, index) => ({
      checklist_id: checklist.id,
      title: String(task["title"] || `Task ${index + 1}`),
      description: typeof task["description"] === "string" ? task["description"] : null,
      assignee_type: task["assigneeType"] === "HR" ? "HR" : "CANDIDATE",
      position: typeof task["position"] === "number" ? task["position"] : index,
      status: "PENDING",
    }));

  if (tasks.length > 0) {
    const { error: tasksErr } = await supabaseAdmin.from("onboarding_tasks").insert(tasks);
    if (tasksErr) throw new AppError(500, `Failed to create onboarding tasks: ${tasksErr.message}`);
  }

  await writeAuditLog(applicationId, "ONBOARDING_CHECKLIST_CREATED", actorId, {
    checklistId: checklist.id,
    templateId: template.id,
    source: "offer_accept",
  });
}

// ─── Public Token Resolution ─────────────────────────────────────────────────

export async function resolveOfferByPublicToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("offer_documents")
    .select("offer_id, token_expires_at, offers!inner(id, status, application_id, created_by, applications!inner(role_id, roles!inner(institution_id, role_dna(full_form_json))))")
    .eq("public_token", token)
    .single();

  if (error || !data) throw new AppError(404, "Offer portal link not found");
  if (new Date(data.token_expires_at).getTime() < Date.now()) {
    throw new AppError(410, "Offer portal link has expired");
  }

  const offerData = data.offers as unknown;
  const offer = Array.isArray(offerData) ? offerData[0] : offerData;
  if (!offer || typeof offer !== "object") throw new AppError(404, "Offer not found");
  const appData = (offer as Record<string, unknown>).applications;
  const app = Array.isArray(appData) ? appData[0] : appData;
  if (!app || typeof app !== "object") throw new AppError(404, "Offer application not found");
  const roleData = (app as Record<string, unknown>).roles;
  const role = Array.isArray(roleData) ? roleData[0] : roleData;
  const fullForm = extractRoleDna((role as Record<string, unknown> | undefined)?.role_dna);

  return {
    offerId: data.offer_id as string,
    offer,
    applicationId: (offer as Record<string, unknown>).application_id as string,
    institutionId: (role as Record<string, unknown> | undefined)?.institution_id as string | undefined,
    createdBy: (offer as Record<string, unknown>).created_by as string | undefined,
    roleTitle: fullForm?.title as string | undefined,
  };
}

// ─── Shared Terminal Action ──────────────────────────────────────────────────

export async function resolveOfferTerminalAction(
  req: AuthenticatedRequest,
  res: Response,
  terminalStatus: "ACCEPTED" | "REJECTED"
) {
  const user = req.user!;
  const offerId = req.params["id"] as string;
  const access = await assertOfferAccessByUser(offerId, user);

  if (access.offer.status !== "SENT") {
    throw new AppError(422, `Cannot set ${terminalStatus} when offer status is ${access.offer.status}`);
  }

  const { error } = await supabaseAdmin
    .from("offers")
    .update({ status: terminalStatus })
    .eq("id", offerId);

  if (error) throw new AppError(500, `Failed to set offer status to ${terminalStatus}`);

  const actorType = resolveOfferActorType(user);

  const { data: maxRound } = await supabaseAdmin
    .from("offer_counter_history")
    .select("round")
    .eq("offer_id", offerId)
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextRound = (maxRound?.round ?? 0) + 1;

  await supabaseAdmin.from("offer_counter_history").insert({
    offer_id: offerId,
    round: nextRound,
    proposed_by: actorType,
    counter_terms: {},
    reason: null,
    status: terminalStatus,
  });

  await writeOfferAudit(offerId, `OFFER_${terminalStatus}`, user.id, { actorType }, supabaseAdmin);

  await writeAuditLog(access.application.id as string, "OFFER_STATUS_CHANGED", user.id, {
    offerId,
    newStatus: terminalStatus,
    actorType,
  });

  if (terminalStatus === "ACCEPTED" && access.role?.institution_id) {
    await autoInstantiateOnboardingChecklist(
      access.application.id as string,
      access.role.institution_id as string,
      user.id
    );
  }

  if (access.role?.institution_id) {
    void dispatchWebhook(
      access.role.institution_id as string,
      terminalStatus === "ACCEPTED" ? "OFFER_ACCEPTED" : "OFFER_REJECTED",
      { offer_id: offerId, application_id: access.application.id, status: terminalStatus }
    );
  }

  res.status(200).json({ data: { offerId, status: terminalStatus } });
}
