import { Response } from "express";
import { createAuthenticatedClient, supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler, paginate } from "@/utils/helpers";
import { type AuthenticatedRequest, isPersonalWorkspaceRequest } from "@/middleware/auth.middleware";
import { generateEmailTemplates, sendBulkEmails } from "@/services/email.service";
import { autoCreateEmployeeOnHired } from "@/modules/employees/employees.controller";
import { runMatching } from "@/modules/matching/matching.service";
import { deriveRoleFieldsFromFullForm } from "@/modules/roles/role-form.mapper";
import type {
  UpdateApplicationStatusInput,
  UpdateApplicationNotesInput,
  ListApplicationsQuery,
} from "./applications.schema";

const DOCUMENTS_BUCKET = "application-documents";

type DB = ReturnType<typeof createAuthenticatedClient>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertCandidateOwnership(applicationId: string, candidateId: string, supabaseAdmin: DB) {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("id, candidate_id, role_id, status")
    .eq("id", applicationId)
    .single();

  if (error || !data) throw new AppError(404, "Application not found");
  if (data?.candidate_id !== candidateId) throw new AppError(403, "Access denied");
  return data;
}

async function assertHROwnership(applicationId: string, institutionId: string, supabaseAdmin: DB) {
  const { data, error } = await supabaseAdmin
    .from("applications")
    .select("id, candidate_id, role_id, status, roles!inner(institution_id)")
    .eq("id", applicationId)
    .single();

  if (error || !data) throw new AppError(404, "Application not found");

  const role = data.roles as unknown as { institution_id: string };
  if (role.institution_id !== institutionId) throw new AppError(404, "Application not found");

  return data;
}

// ─── GET /applications/my ─────────────────────────────────────────────────────

export const getMyApplications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const candidateId = req.user!.id;
    const { page, limit, status } = (res.locals["query"] ?? req.query) as ListApplicationsQuery;
    const { offset, limit: take } = paginate(String(page), String(limit), 20);

    let query = supabaseAdmin
      .from("applications")
      .select(
        `
        id, status, match_score, share_link, created_at, updated_at,
        roles(id, status, institution_id, role_dna(full_form_json),
          institutions(name))
        `,
        { count: "exact" }
      )
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;

    if (error) throw new AppError(500, "Failed to fetch applications");

    const normalized = (data ?? []).map((application: Record<string, unknown>) => {
      const role = application.roles as Record<string, unknown> | undefined;
      const roleDna = Array.isArray(role?.role_dna) ? role?.role_dna[0] : role?.role_dna;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;

      return {
        ...application,
        roles: {
          ...role,
          title: fullForm?.title || "Untitled Role",
          location: `${fullForm?.country || ""}${fullForm?.city ? ` - ${fullForm.city}` : ""}`,
          type: fullForm?.type || null,
          role_dna: undefined,
        },
      };
    });

    res.status(200).json({
      data: normalized,
      meta: { total: count ?? 0, page, limit: take },
    });
  }
);

// ─── GET /applications/:id ────────────────────────────────────────────────────

export const getApplicationById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const id = req.params["id"] as string;

    const { data, error } = await supabaseAdmin
      .from("applications")
      .select(
        `id, status, match_score, share_link, notes, created_at, updated_at, role_id, candidate_id, dna_snapshot, answers,
        roles(id, status, institution_id, institutions(name), role_dna(full_form_json)),
        profiles!candidate_id(id, full_name, email, avatar_url)`
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new AppError(404, "Application not found");
    }

    if (isPersonalWorkspaceRequest(req)) {
      // Talent portal: only the candidate who owns the application.
      // Do NOT fall back to institution membership here — that would let MEMBER
      // (no applications.view) read apps by sending X-Workspace-Id: personal.
      if (data?.candidate_id !== user.id) {
        throw new AppError(403, "Access denied");
      }
    } else {
      const role = data.roles as unknown as any;
      if (!role) {
        throw new AppError(403, "Access denied");
      }

      const roleInstitutionId = role.institution_id as string | null | undefined;

      if (!roleInstitutionId) {
        throw new AppError(403, "Access denied");
      }

      // Primary check: req.user.institutionId
      if (user.institutionId && roleInstitutionId === user.institutionId) {
        // ok
      } else {
        // Fallback: verify membership against the role's institution_id
        const { data: membership } = await supabaseAdmin
          .from("institution_members")
          .select("institution_id, status")
          .eq("user_id", user.id)
          .eq("institution_id", roleInstitutionId)
          .in("status", ["OWNER", "ADMIN", "ACTIVE"])
          .maybeSingle();

        if (!membership) {
          throw new AppError(403, "Access denied");
        }
      }
    }

    const { data: mrData, error: mrError } = await supabaseAdmin
      .from("match_results")
      .select("*")
      .eq("application_id", id)
      .maybeSingle();

    const matchResults = (!mrError && mrData) ? mrData : {};

    const roleAssoc = Array.isArray(data.roles) ? data.roles[0] : data.roles;
    const role = roleAssoc as unknown as Record<string, unknown> | undefined;
    const roleDnaDetail = Array.isArray(role?.role_dna) ? role?.role_dna[0] : role?.role_dna;
    const fullFormDetail = (roleDnaDetail as Record<string, unknown> | undefined)?.full_form_json as
      | Record<string, unknown>
      | undefined;
    const derivedRole = deriveRoleFieldsFromFullForm(fullFormDetail);
    const snapshot = data.dna_snapshot as Record<string, unknown> | undefined;
    const identity = (snapshot?.talent_identity as Record<string, unknown> | undefined) ?? {};
    const links = (identity.links as Record<string, unknown> | undefined) ?? {};

    const isOwnApplicationAsTalent =
      isPersonalWorkspaceRequest(req) && data.candidate_id === user.id;

    const responsePayload = {
      data: {
        ...data,
        // Internal HR notes must never leak to the candidate portal.
        notes: isOwnApplicationAsTalent ? undefined : data.notes,
        submittedAt: data.created_at ?? null,
        guest_name: typeof identity.name === "string" ? identity.name : null,
        guest_email: typeof identity.email === "string" ? identity.email : null,
        guest_cv_url: typeof links.cv === "string" ? links.cv : null,
        candidateName: (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles as any)?.full_name
          ?? identity.name
          ?? "Unknown",
        roles: {
          ...role,
          title: derivedRole.title,
          description: derivedRole.description,
          location: derivedRole.location,
          type: derivedRole.type,
          role_dna: {
            full_form_json: fullFormDetail || {},
          },
        },
        match_results: matchResults,
      },
    };

    res.status(200).json(responsePayload);
  }
);

// ─── GET /applications — HR ───────────────────────────────────────────────────

export const listApplications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { page, limit, status } = (res.locals["query"] ?? req.query) as ListApplicationsQuery;
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

    let query = supabaseAdmin
      .from("applications")
      .select(
        `
        id, status, match_score, created_at, updated_at, dna_snapshot,
        roles(id, status, institution_id, role_dna(full_form_json)),
        profiles!candidate_id(id, full_name, email, avatar_url),
        match_results(final_score)
        `,
        { count: "exact" }
      )
      .in("role_id", roleIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;

    if (error) {
      console.error("[listApplications]", error.message, error.details, error.hint);
      throw new AppError(500, `Failed to fetch applications: ${error.message}`);
    }

    const normalizedApplications = (data ?? []).map((application: Record<string, unknown>) => {
      const role = application.roles as Record<string, unknown> | undefined;
      const roleDna = Array.isArray(role?.role_dna) ? role?.role_dna[0] : role?.role_dna;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;
      const snapshot = application.dna_snapshot as Record<string, unknown> | undefined;
      const identity = (snapshot?.talent_identity as Record<string, unknown> | undefined) ?? {};

      return {
        ...application,
        guest_name: typeof identity.name === "string" ? identity.name : null,
        roles: {
          ...role,
          title: fullForm?.title || "Untitled Role",
          type: fullForm?.type || null,
          location: `${fullForm?.country || ""}${fullForm?.city ? ` - ${fullForm.city}` : ""}`,
          role_dna: undefined,
        },
      };
    });

    res.status(200).json({
      data: normalizedApplications,
      meta: { total: count ?? 0, page, limit: take },
    });
  }
);

// ─── PATCH /applications/:id/status — HR ──────────────────────────────────────

export const updateApplicationStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await assertHROwnership(id, institutionId, supabaseAdmin);

    const { status } = req.body as UpdateApplicationStatusInput;
    const { rejectionReason } = req.body as { rejectionReason?: string };

    const updatePayload: Record<string, unknown> = { status };
    if (status === "REJECTED" && rejectionReason?.trim()) {
      updatePayload.rejection_feedback_json = { message: rejectionReason.trim() };
    }

    const { data, error } = await supabaseAdmin
      .from("applications")
      .update(updatePayload)
      .eq("id", id)
      .select(`
        id,
        status,
        updated_at,
        candidate_id,
        role_id,
        roles(institutions(name), role_dna(full_form_json)),
        profiles(full_name, email)
      `)
      .single();

    if (error || !data) throw new AppError(500, "Failed to update status");

    // Status change is silent — no automatic emails.
    // Emails are sent explicitly via the finalizeSelection → sendEmails flow.

    if (status === "HIRED") {
      try {
        const roleAssoc = data.roles as unknown as {
          department_id?: string | null;
          job_position_id?: string | null;
        };
        await autoCreateEmployeeOnHired(
          institutionId,
          data.candidate_id as string,
          id,
          roleAssoc?.job_position_id ?? null,
          roleAssoc?.department_id ?? null
        );
      } catch (employeeErr) {
        console.error("[Employees] Failed to auto-create employee record:", employeeErr);
      }
    }

    res.status(200).json({ data });
  }
);

// ─── PATCH /applications/:id/notes — HR ───────────────────────────────────────

export const updateApplicationNotes = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await assertHROwnership(id, institutionId, supabaseAdmin);

    const { notes } = req.body as UpdateApplicationNotesInput;

    const { data, error } = await supabaseAdmin
      .from("applications")
      .update({ notes })
      .eq("id", id)
      .select("id, notes, updated_at")
      .single();

    if (error || !data) throw new AppError(500, "Failed to update notes");

    res.status(200).json({ data });
  }
);

// ─── GET /applications/:id/documents ─────────────────────────────────────────

export const getDocuments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const id = req.params["id"] as string;

    if (isPersonalWorkspaceRequest(req)) {
      await assertCandidateOwnership(id, user.id, supabaseAdmin);
    } else {
      if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");
      await assertHROwnership(id, user.institutionId, supabaseAdmin);
    }

    const { data: docs, error } = await supabaseAdmin
      .from("application_documents")
      .select("id, file_type, file_name, storage_path, uploaded_at")
      .eq("application_id", id)
      .order("uploaded_at", { ascending: true });

    if (error) throw new AppError(500, "Failed to fetch documents");

    const docsWithUrls = await Promise.all(
      (docs ?? []).map(async (doc) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(DOCUMENTS_BUCKET)
          .createSignedUrl(doc.storage_path, 3600);

        return {
          id: doc.id,
          file_type: doc.file_type,
          fileName: doc.file_name,
          storagePath: doc.storage_path,
          signedUrl: signed?.signedUrl ?? null,
          createdAt: doc.uploaded_at,
        };
      })
    );

    res.status(200).json({ data: docsWithUrls });
  }
);

// ─── DELETE /applications/:id ─────────────────────────────────────────────────

export const deleteApplication = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const id = req.params["id"] as string;

    if (isPersonalWorkspaceRequest(req)) {
      await assertCandidateOwnership(id, user.id, supabaseAdmin);
    } else {
      if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");
      await assertHROwnership(id, user.institutionId, supabaseAdmin);
    }

    const { data: docs } = await supabaseAdmin
      .from("application_documents")
      .select("storage_path")
      .eq("application_id", id);

    if (docs && docs.length > 0) {
      const paths = docs.map((d) => d.storage_path);
      const { error: storageError } = await supabaseAdmin.storage
        .from(DOCUMENTS_BUCKET)
        .remove(paths);
      if (storageError) {
        console.warn(`[deleteApplication] Storage cleanup partial failure: ${storageError.message}`);
      }
    }

    const { error } = await supabaseAdmin.from("applications").delete().eq("id", id);

    if (error) throw new AppError(500, "Failed to delete application");

    res.status(200).json({ message: "Application deleted successfully" });
  }
);

// ─── GET /applications/:id/share-link ─────────────────────────────────────────

export const getShareLink = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("applications")
      .select("share_link")
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new AppError(404, "Application not found");
    }

    res.status(200).json({ shareUrl: data.share_link });
  }
);

// ─── GET /applications/:id/sorted-talents ─────────────────────────────────────

export const getSortedTalents = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await assertHROwnership(id, institutionId, supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("sorted_talents")
      .select(
        `
        application_id, candidate_id, rank, score, approved,
        profiles!candidate_id (id, full_name, email, avatar_url)
      `
      )
      .eq("application_id", id)
      .order("rank", { ascending: true });

    if (error) throw new AppError(500, "Failed to fetch sorted talents");

    const candidateIds = (data ?? []).map((t) => t.candidate_id).filter(Boolean);
    let matchResultsMap: Record<string, Record<string, unknown>> = {};

    if (candidateIds.length > 0) {
      const { data: matchData } = await supabaseAdmin
        .from("match_results")
        .select(
          "candidate_id, final_score, role_fit, skill_validity, capability_strength, environment_fit, motivation_fit, constraint_fit, reliability_index, ai_explanation, ai_confidence"
        )
        .eq("application_id", id)
        .in("candidate_id", candidateIds);

      if (matchData) {
        matchResultsMap = Object.fromEntries(
          matchData.map((m) => [m.candidate_id, m as Record<string, unknown>])
        );
      }
    }

    const enriched = (data ?? []).map((t) => ({
      ...t,
      match_result: matchResultsMap[t.candidate_id] ?? null,
    }));

    res.status(200).json({ data: enriched });
  }
);

// ─── PATCH /applications/:id/sorted-talents/:talentId ─────────────────────────

export const reviewSortedTalent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    const talentId = req.params["talentId"] as string;
    const { approved } = req.body as { approved: boolean };

    if (typeof approved !== "boolean") {
      throw new AppError(422, "approved must be a boolean");
    }

    await assertHROwnership(id, institutionId, supabaseAdmin);

    const { error } = await supabaseAdmin
      .from("sorted_talents")
      .update({ approved })
      .eq("application_id", id)
      .eq("candidate_id", talentId);

    if (error) throw new AppError(500, "Failed to update talent review");

    if (!approved) {
      const { data: remaining, error: fetchError } = await supabaseAdmin
        .from("sorted_talents")
        .select("application_id, candidate_id, rank, approved")
        .eq("application_id", id)
        .neq("approved", false)
        .order("rank", { ascending: true });

      if (!fetchError && remaining && remaining.length > 0) {
        const updates = remaining.map((row, idx) => ({
          application_id: row.application_id,
          candidate_id: row.candidate_id,
          rank: idx + 1,
          approved: row.approved ?? null,
        }));

        const { error: rerankError } = await supabaseAdmin
          .from("sorted_talents")
          .upsert(updates, { onConflict: "application_id,candidate_id" });

        if (rerankError) throw new AppError(500, "Failed to update talent review");
      }
    }

    res.status(200).json({ message: "Talent review updated successfully" });
  }
);

// ─── POST /applications/:id/finalize-selection ────────────────────────────────

export const finalizeSelection = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    const { approvalMessage, rejectionMessage } = req.body as {
      approvalMessage?: string;
      rejectionMessage?: string;
    };

    const app = await assertHROwnership(id, institutionId, supabaseAdmin);

    const { data: role, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("institution_id, institutions!inner(name), role_dna(full_form_json)")
      .eq("id", (app as typeof app & { role_id: string }).role_id)
      .single();

    if (roleError || !role) throw new AppError(404, "Role not found");

    const institution = role.institutions as unknown as { name: string } | null;
    const institutionName = institution?.name ?? "The institution";

    const roleDna = Array.isArray((role as any).role_dna) ? (role as any).role_dna[0] : (role as any).role_dna;
    const roleTitle = roleDna?.full_form_json?.title || "Untitled Role";

    const templates = await generateEmailTemplates(
      roleTitle,
      institutionName,
      approvalMessage,
      rejectionMessage
    );

    const { error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ email_templates_json: templates })
      .eq("id", id);

    if (updateError) throw new AppError(500, "Failed to finalize selection");

    res.status(200).json({
      message: "Selection finalized successfully",
      templates,
    });
  }
);

// ─── GET /applications/:id/email-preview ─────────────────────────────────────

export const getEmailPreview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await assertHROwnership(id, institutionId, supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("applications")
      .select("email_templates_json")
      .eq("id", id)
      .single();

    if (error || !data) throw new AppError(404, "Application not found");

    // No templates yet (finalize-selection not run) → empty 200, not 404 (avoids Next.js overlay noise).
    const templates = data.email_templates_json ?? null;
    res.status(200).json({
      templates,
      ready: templates != null,
      message: templates
        ? undefined
        : "No email templates yet. Run finalize-selection first.",
    });
  }
);

// ─── POST /applications/:id/send-emails ──────────────────────────────────────

export const sendEmails = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    const app = await assertHROwnership(id, institutionId, supabaseAdmin);

    const { data: role, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("institutions!inner(name), role_dna(full_form_json)")
      .eq("id", (app as typeof app & { role_id: string }).role_id)
      .single();

    if (roleError || !role) throw new AppError(404, "Role not found");

    const institution = role.institutions as unknown as { name: string } | null;
    const institutionName = institution?.name ?? "The institution";

    const roleDnaEmail = Array.isArray((role as any).role_dna) ? (role as any).role_dna[0] : (role as any).role_dna;
    const roleTitleEmail = roleDnaEmail?.full_form_json?.title || "Untitled Role";

    const { data: appData } = await supabaseAdmin
      .from("applications")
      .select("email_templates_json, status, candidate_id, dna_snapshot, profiles!candidate_id(full_name, email)")
      .eq("id", id)
      .single();

    if (!appData) throw new AppError(404, "Application not found");
    if (appData.status !== "VALIDATED" && appData.status !== "REJECTED" && appData.status !== "FINISHED") {
      throw new AppError(422, "Application must be VALIDATED or REJECTED to send selection email.");
    }

    const templates: { approval?: { html: string }; rejection?: { html: string } } =
      (appData.email_templates_json as typeof templates | null) ?? {};

    const isApproved = appData.status === "VALIDATED";
    const profile = appData.profiles as unknown as { full_name: string; email: string } | null;
    const customHtml = isApproved ? templates.approval?.html : templates.rejection?.html;
    const snapshot = appData.dna_snapshot as Record<string, unknown> | undefined;
    const identity = (snapshot?.talent_identity as Record<string, unknown> | undefined) ?? {};

    const candidateEmail = (typeof identity.email === "string" ? identity.email : null) || profile?.email;
    const candidateName = (typeof identity.name === "string" ? identity.name : null) || profile?.full_name || "Candidate";

    if (!candidateEmail) {
      throw new AppError(422, "No email address found for this candidate.");
    }

    const emailContexts = [{
      candidateEmail,
      candidateName,
      roleName: roleTitleEmail,
      institutionName,
      approved: isApproved,
      customMessage: customHtml,
    }];

    const result = await sendBulkEmails(emailContexts);

    res.status(200).json({
      message: "Emails sent",
      sent: result.sent,
      failed: result.failed,
      errors: result.errors,
    });
  }
);

// ─── PATCH /applications/:id/close ───────────────────────────────────────────

export const closeApplication = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await assertHROwnership(id, institutionId, supabaseAdmin);

    const { error } = await supabaseAdmin
      .from("applications")
      .update({ status: "FINISHED" })
      .eq("id", id);

    if (error) throw new AppError(500, "Failed to close application");

    res.status(200).json({ message: "Application closed successfully" });
  }
);

// ─── POST /applications/:id/relaunch-matching ───────────────────────────────

export const relaunchApplicationMatching = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    const app = await assertHROwnership(id, institutionId, supabaseAdmin);
    const roleId = (app as { role_id: string }).role_id;

    const { error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ status: "ANALYSING" })
      .eq("id", id);

    if (updateError) throw new AppError(500, "Failed to relaunch AI matching");

    runMatching(roleId, 50)
      .catch((error: unknown) => {
        console.error(`[matching] Relaunch failed for role ${roleId}:`, error);
      });

    res.status(202).json({
      status: "RELAUNCH_STARTED",
      message: "AI matching relaunched for this candidate.",
      applicationId: id,
      roleId,
    });
  }
);
