import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { writeAuditLog, getAuditLogs } from "@/middleware/audit.middleware";
import { asyncHandler, paginate } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { dispatchWebhook } from "@/modules/webhooks/webhooks.service";
import type {
  CreateDecisionInput,
  RecommendDecisionInput,
  RatifyDecisionInput,
  DecisionQueueQuery,
} from "./decisions.schema";

// ─── State Machine ────────────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPT", "REJECT", "HOLD"],
  ANALYSING: ["ACCEPT", "REJECT", "HOLD"],
  FINISHED: ["ACCEPT", "REJECT", "HOLD"],
  VALIDATED: ["ACCEPT", "REJECT", "HOLD"],
  STOPPED: ["ACCEPT", "REJECT", "HOLD"],
  REJECTED: ["ACCEPT", "HOLD", "REJECT"],
};

const ACTION_TO_STATUS: Record<string, string> = {
  ACCEPT: "VALIDATED",
  REJECT: "REJECTED",
  HOLD: "STOPPED",
};

function isTransitionAllowed(currentStatus: string, action: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(action);
}

// ─── Helper: resolve workspace institution ────────────────────────────────────
function resolveInstitutionId(req: AuthenticatedRequest): string {
  const id = req.workspace?.institutionId ?? req.user?.activeInstitutionId ?? req.user?.institutionId;
  if (!id) throw new AppError(403, "Workspace context required");
  return id;
}

// ─── Helper: assert application belongs to institution ────────────────────────
async function assertAppInInstitution(
  applicationId: string,
  institutionId: string,
  _req: AuthenticatedRequest
) {
  const { data: app, error } = await supabaseAdmin
    .from("applications")
    .select("id, status, role_id, roles!inner(institution_id)")
    .eq("id", applicationId)
    .single();

  if (error || !app) throw new AppError(404, "Application not found");
  const roleData = app.roles as unknown;
  const role = Array.isArray(roleData) ? roleData[0] : (roleData as { institution_id: string });
  if (role.institution_id !== institutionId) throw new AppError(404, "Application not found");

  return app;
}

// ─── POST /applications/:id/decision ──────────────────────────────────────────

export const createDecision = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const institutionId = resolveInstitutionId(req);

    const applicationId = req.params["id"] as string;
    const { action, reason } = req.body as CreateDecisionInput;

    const app = await assertAppInInstitution(applicationId, institutionId, req);

    if (!isTransitionAllowed(app.status, action)) {
      throw new AppError(
        422,
        `Cannot perform '${action}' on application with status '${app.status}'. ` +
          `Allowed actions: ${(ALLOWED_TRANSITIONS[app.status] || []).join(", ") || "none"}`
      );
    }

    const newStatus = ACTION_TO_STATUS[action];

    const { data: decision, error: decisionError } = await supabaseAdmin
      .from("application_decisions")
      .insert({
        application_id: applicationId,
        action,
        reason: reason || null,
        actor_id: user.id,
        decided_by_role: req.workspace?.roleSpecialization ?? null,
      })
      .select("id, action, reason, created_at")
      .single();

    if (decisionError || !decision) {
      throw new AppError(500, "Failed to record decision");
    }

    const { error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId);

    if (updateError) {
      throw new AppError(500, "Failed to update application status");
    }

    await writeAuditLog(applicationId, "DECISION_MADE", user.id, {
      decisionId: decision.id,
      action,
      reason: reason || null,
      previousStatus: app.status,
      newStatus,
    });

    res.status(201).json({
      message: `Application ${action.toLowerCase()}ed successfully`,
      data: {
        decision: {
          id: decision.id,
          action: decision.action,
          reason: decision.reason,
          createdAt: decision.created_at,
        },
        applicationStatus: newStatus,
      },
    });
  }
);

// ─── Phase F: POST /decisions/applications/:id/recommend ─────────────────────
// Recruiter / Standard HR records their recommendation (does not change app status).

export const recommendDecision = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const institutionId = resolveInstitutionId(req);

    const applicationId = req.params["id"] as string;
    const { action, reason } = req.body as RecommendDecisionInput;

    await assertAppInInstitution(applicationId, institutionId, req);

    // Check no recommendation exists yet for this application.
    const { data: existing } = await supabaseAdmin
      .from("decision_recommendations")
      .select("id")
      .eq("application_id", applicationId)
      .eq("recommended_by", user.id)
      .maybeSingle();

    if (existing) {
      throw new AppError(409, "You have already recommended this application");
    }

    const { data: recommendation, error } = await supabaseAdmin
      .from("decision_recommendations")
      .insert({
        application_id: applicationId,
        recommended_by: user.id,
        recommendation: action,
        observations: reason || null,
      })
      .select("id, recommendation, observations, created_at")
      .single();

    if (error || !recommendation) throw new AppError(500, "Failed to record recommendation");

    await writeAuditLog(applicationId, "DECISION_RECOMMENDED", user.id, {
      recommendationId: recommendation.id,
      recommendation: action,
      observations: reason || null,
    });

    res.status(201).json({
      message: "Recommendation recorded",
      data: recommendation,
    });
  }
);

// ─── Phase F: POST /decisions/applications/:id/decide ────────────────────────
// Hiring Manager makes the binding decision (requires prior recommendation).
// Changes application status.

export const decide = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const institutionId = resolveInstitutionId(req);

    const applicationId = req.params["id"] as string;
    const { action, reason, rejection_feedback } = req.body as CreateDecisionInput;

    const app = await assertAppInInstitution(applicationId, institutionId, req);

    if (!isTransitionAllowed(app.status, action)) {
      throw new AppError(
        422,
        `Cannot perform '${action}' on application with status '${app.status}'.`
      );
    }

    const newStatus = ACTION_TO_STATUS[action];

    // If institution uses recommend-decide flow, a recommendation should exist.
    // We soft-warn only (don't block) to support institutions without recommenders.
    const { data: recommendation } = await supabaseAdmin
      .from("decision_recommendations")
      .select("id, recommended_by")
      .eq("application_id", applicationId)
      .maybeSingle();

    const { data: decision, error } = await supabaseAdmin
      .from("application_decisions")
      .insert({
        application_id: applicationId,
        action,
        reason: reason || null,
        actor_id: user.id,
      })
      .select("id, action, reason, created_at")
      .single();

    if (error || !decision) throw new AppError(500, "Failed to record decision");

    const appUpdate: Record<string, unknown> = { status: newStatus };
    if (action === "REJECT" && rejection_feedback && rejection_feedback.length > 0) {
      appUpdate.rejection_feedback_json = rejection_feedback;
    }
    const { error: appUpdateError } = await supabaseAdmin
      .from("applications")
      .update(appUpdate)
      .eq("id", applicationId);

    if (appUpdateError) {
      throw new AppError(500, "Failed to update application status");
    }

    await writeAuditLog(applicationId, "DECISION_DECIDED", user.id, {
      decisionId: decision.id,
      action,
      reason: reason || null,
      previousStatus: app.status,
      newStatus,
      hadRecommendation: !!recommendation,
    });

    if (institutionId && (action === "ACCEPT" || action === "REJECT")) {
      void dispatchWebhook(
        institutionId,
        action === "ACCEPT" ? "DECISION_ACCEPTED" : "DECISION_REJECTED",
        { application_id: applicationId, decision_id: decision.id, action, new_status: newStatus }
      );
    }

    res.status(201).json({
      message: `Decision recorded — application moved to ${newStatus}`,
      data: { ...decision, applicationStatus: newStatus },
    });
  }
);

// ─── Phase F: POST /decisions/applications/:id/ratify ────────────────────────
// HR Head ratifies an existing decision (adds ratification metadata, no status change).

export const ratifyDecision = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const institutionId = resolveInstitutionId(req);

    const applicationId = req.params["id"] as string;
    const { decisionId, status: ratificationStatus, reason } = req.body as RatifyDecisionInput;

    await assertAppInInstitution(applicationId, institutionId, req);

    // Load the target decision.
    const { data: decision, error: fetchErr } = await supabaseAdmin
      .from("application_decisions")
      .select("id, application_id, action")
      .eq("id", decisionId)
      .eq("application_id", applicationId)
      .single();

    if (fetchErr || !decision) throw new AppError(404, "Decision not found");

    // Check no ratification exists yet for this decision.
    const { data: existing } = await supabaseAdmin
      .from("decision_ratifications")
      .select("id")
      .eq("decision_id", decisionId)
      .maybeSingle();

    if (existing) throw new AppError(409, "Decision already ratified");

    const { data: ratification, error: insertErr } = await supabaseAdmin
      .from("decision_ratifications")
      .insert({
        application_id: applicationId,
        decision_id: decisionId,
        ratified_by: user.id,
        ratified_by_role: req.workspace?.roleSpecialization ?? null,
        status: ratificationStatus,
        reason: reason || null,
      })
      .select("id, ratified_by_role, status, created_at")
      .single();

    if (insertErr || !ratification) throw new AppError(500, "Failed to ratify decision");

    await writeAuditLog(applicationId, "DECISION_RATIFIED", user.id, {
      ratificationId: ratification.id,
      decisionId,
      action: decision.action,
      reason: reason || null,
    });

    res.status(201).json({
      message: "Decision ratified",
      data: ratification,
    });
  }
);

// ─── GET /applications/decision-queue ─────────────────────────────────────────

export const getDecisionQueue = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);

    const query = (res.locals["query"] ?? req.query) as DecisionQueueQuery;
    const { page, limit, status, action, from, to } = query;
    const { offset, limit: take } = paginate(String(page), String(limit), 20);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("institution_id", institutionId);

    if (rolesError) throw new AppError(500, "Failed to fetch roles");

    const roleIds = (roles ?? []).map((r) => r.id);
    if (roleIds.length === 0) {
      res.status(200).json({ data: [], meta: { total: 0, page, limit: take } });
      return;
    }

    let appQuery = supabaseAdmin
      .from("applications")
      .select(
        `
        id, status, match_score, created_at, updated_at, dna_snapshot,
        roles(id, status, role_dna(full_form_json)),
        profiles!candidate_id(id, full_name, email, avatar_url),
        application_decisions(id, action, reason, actor_id, created_at, decided_by_role, ratified_at, recommendation_at)
        `,
        { count: "exact" }
      )
      .in("role_id", roleIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (status) appQuery = appQuery.eq("status", status);
    else appQuery = appQuery.in("status", ["FINISHED", "VALIDATED", "STOPPED", "REJECTED"]);
    if (from) appQuery = appQuery.gte("created_at", new Date(from as string).toISOString());
    if (to) appQuery = appQuery.lte("created_at", new Date(to as string).toISOString());

    const { data, error, count } = await appQuery;

    if (error) throw new AppError(500, "Failed to fetch decision queue");

    let normalized = (data ?? []).map((application: Record<string, unknown>) => {
      const roleArr = application.roles as unknown;
      const roleData = Array.isArray(roleArr) ? roleArr[0] : (roleArr as Record<string, unknown> | undefined);

      const roleDna = Array.isArray(roleData?.role_dna)
        ? roleData?.role_dna[0]
        : roleData?.role_dna;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;
      const snapshot = application.dna_snapshot as Record<string, unknown> | undefined;
      const identity = (snapshot?.talent_identity as Record<string, unknown> | undefined) ?? {};
      const decisions = (application.application_decisions as Array<Record<string, unknown>>) ?? [];
      const latestDecision = decisions.length > 0 ? decisions[0] : null;
      const profile = Array.isArray(application.profiles) ? application.profiles[0] : application.profiles as Record<string, unknown> | undefined;

      return {
        id: application.id,
        status: application.status,
        matchScore: application.match_score,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
        candidateName: (profile?.full_name as string | undefined) ?? (typeof identity.name === "string" ? identity.name : null),
        profile: profile ?? null,
        role: {
          ...(roleData || {}),
          title: fullForm?.title || "Untitled Role",
          type: fullForm?.type || null,
          location: `${fullForm?.country || ""}${fullForm?.city ? ` - ${fullForm.city}` : ""}`,
          role_dna: undefined,
        },
        latestDecision,
        decisionsCount: decisions.length,
      };
    });

    if (action) {
      normalized = normalized.filter((app) => {
        const dec = app.latestDecision as Record<string, unknown> | null;
        return dec?.action === action;
      });
    }

    res.status(200).json({
      data: normalized,
      meta: { total: count ?? 0, page, limit: take },
    });
  }
);

// ─── GET /applications/:id/decisions ──────────────────────────────────────────

export const getDecisionHistory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    const applicationId = req.params["id"] as string;

    await assertAppInInstitution(applicationId, institutionId, req);

    const { data: decisions, error: decisionsError } = await supabaseAdmin
      .from("application_decisions")
      .select(
        "id, action, reason, actor_id, created_at, decided_by_role, recommendation_at, recommendation_role, ratified_at, ratified_by_role"
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });

    if (decisionsError) throw new AppError(500, "Failed to fetch decisions");

    res.status(200).json({ data: decisions ?? [] });
  }
);

// ─── GET /applications/:id/audit-logs ─────────────────────────────────────────

export const getApplicationAuditLogs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    const applicationId = req.params["id"] as string;

    await assertAppInInstitution(applicationId, institutionId, req);

    const logs = await getAuditLogs(applicationId);

    res.status(200).json({ data: logs });
  }
);

// ─── GET /decisions/applications/:id/state ───────────────────────────────────
// Returns current recommendation, decision, and ratification for an application.

export const getDecisionState = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    const applicationId = req.params["id"] as string;

    await assertAppInInstitution(applicationId, institutionId, req);

    const [recResult, decResult] = await Promise.all([
      supabaseAdmin
        .from("decision_recommendations")
        .select("id, recommendation, observations, recommended_by, created_at")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("application_decisions")
        .select("id, action, reason, actor_id, decided_by_role, created_at")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let ratification = null;
    if (decResult.data) {
      const { data: rat } = await supabaseAdmin
        .from("decision_ratifications")
        .select("id, status, reason, ratified_by, ratified_by_role, created_at")
        .eq("decision_id", decResult.data.id)
        .maybeSingle();
      ratification = rat;
    }

    res.status(200).json({
      data: {
        recommendations: recResult.data ?? [],
        decision: decResult.data ?? null,
        ratification,
      },
    });
  }
);

// ─── GET /decisions/action-queue ─────────────────────────────────────────────
// Returns 3 lists: pendingRecommendation, pendingDecision, pendingRatification.
// Used by HiringQueue component on the dashboard.

export const getActionQueue = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);

    // Get all role IDs for this institution
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("institution_id", institutionId);

    if (rolesErr) throw new AppError(500, "Failed to fetch roles");
    const roleIds = (roles ?? []).map((r) => r.id as string);
    if (roleIds.length === 0) {
      res.status(200).json({ data: { pendingRecommendation: [], pendingDecision: [], pendingRatification: [] } });
      return;
    }

    // Applications in decision-relevant statuses
    // supabaseAdmin: RLS on `profiles` blocks the embedded join for HR's req.supabaseAdmin client,
    // returning profile: null. roleIds is already institution-scoped above, so the
    // .in("role_id", roleIds) filter preserves tenant isolation.
    const { data: apps, error: appsErr } = await supabaseAdmin
      .from("applications")
      .select("id, status, match_score, created_at, dna_snapshot, profiles:candidate_id(id, full_name, email), roles!inner(id, role_dna(full_form_json))")
      .in("role_id", roleIds)
      .in("status", ["FINISHED", "VALIDATED", "STOPPED", "REJECTED"]);

    if (appsErr) throw new AppError(500, "Failed to fetch applications");

    const allApps = apps ?? [];
    const appIds = allApps.map((a) => a.id as string);
    if (appIds.length === 0) {
      res.status(200).json({ data: { pendingRecommendation: [], pendingDecision: [], pendingRatification: [] } });
      return;
    }

    // Fetch recommendations, decisions, ratifications in parallel
    const [recResult, decResult] = await Promise.all([
      supabaseAdmin.from("decision_recommendations").select("application_id").in("application_id", appIds),
      supabaseAdmin.from("application_decisions")
        .select("id, application_id, action, created_at")
        .in("application_id", appIds)
        .order("created_at", { ascending: false }),
    ]);

    const recommendedAppIds = new Set((recResult.data ?? []).map((r) => r.application_id as string));

    // Latest decision per application
    const latestDecisionByApp = new Map<string, { id: string; action: string; created_at: string }>();
    for (const d of decResult.data ?? []) {
      if (!latestDecisionByApp.has(d.application_id as string)) {
        latestDecisionByApp.set(d.application_id as string, {
          id: d.id as string,
          action: d.action as string,
          created_at: d.created_at as string,
        });
      }
    }

    const decisionIds = [...latestDecisionByApp.values()].map((d) => d.id);
    let ratifiedDecisionIds = new Set<string>();
    if (decisionIds.length > 0) {
      const { data: ratData } = await supabaseAdmin
        .from("decision_ratifications")
        .select("decision_id")
        .in("decision_id", decisionIds);
      ratifiedDecisionIds = new Set((ratData ?? []).map((r) => r.decision_id as string));
    }

    function toCard(a: Record<string, unknown>) {
      const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      const role = Array.isArray(a.roles) ? a.roles[0] : a.roles;
      const roleDna = role
        ? (Array.isArray((role as any).role_dna) ? (role as any).role_dna[0] : (role as any).role_dna)
        : null;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;
      const snapshot = a.dna_snapshot as Record<string, unknown> | undefined;
      const identity = (snapshot?.talent_identity as Record<string, unknown> | undefined) ?? {};
      return {
        id: a.id,
        status: a.status,
        matchScore: a.match_score,
        createdAt: a.created_at,
        candidateName: (profile as Record<string, unknown> | undefined)?.full_name as string | undefined
          ?? (typeof identity.name === "string" ? identity.name : null),
        profile: profile ?? null,
        role: role ? { id: (role as any).id, title: (fullForm?.title as string) || "Untitled Role" } : null,
      };
    }

    const pendingRecommendation: unknown[] = [];
    const pendingDecision: unknown[] = [];
    const pendingRatification: unknown[] = [];

    for (const app of allApps) {
      const appId = app.id as string;
      const hasRec = recommendedAppIds.has(appId);
      const latestDec = latestDecisionByApp.get(appId);

      if (!hasRec && !latestDec) {
        pendingRecommendation.push(toCard(app as Record<string, unknown>));
      } else if (hasRec && !latestDec) {
        pendingDecision.push(toCard(app as Record<string, unknown>));
      } else if (latestDec && !ratifiedDecisionIds.has(latestDec.id)) {
        pendingRatification.push(toCard(app as Record<string, unknown>));
      }
    }

    res.status(200).json({ data: { pendingRecommendation, pendingDecision, pendingRatification } });
  }
);
