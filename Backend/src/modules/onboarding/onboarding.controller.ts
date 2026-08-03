import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { writeAuditLog } from "@/middleware/audit.middleware";
import { asyncHandler, paginate } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { createNotification, NOTIF_LINKS, NOTIF_TITLES } from "@/modules/notifications/notifications.service";
import { STORAGE_BUCKETS, buildStoragePath, ensureBucketExistsOrThrow } from "@/services/storage.service";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  InstantiateChecklistInput,
  UpdateTaskStatusInput,
  ListTemplatesQuery,
  PresignOnboardingUploadInput,
  CompleteOnboardingUploadInput,
  VerifyOnboardingDocumentInput,
  InitSigningChainInput,
  SignDocumentInput,
  RejectSignerStepInput,
} from "./onboarding.schema";

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export const createTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const { name, description, tasks } = req.body as CreateTemplateInput;

    const tasksWithPosition = tasks.map((t, i) => ({
      ...t,
      position: t.position ?? i,
    }));

    const { data, error } = await supabaseAdmin
      .from("onboarding_templates")
      .insert({
        institution_id: user.institutionId,
        name,
        description: description || null,
        tasks_json: tasksWithPosition,
        created_by: user.id,
      })
      .select("id, name, description, tasks_json, created_at")
      .single();

    if (error || !data) throw new AppError(500, "Failed to create template");

    res.status(201).json({
      message: "Template created successfully",
      data,
    });
  }
);

export const updateTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const templateId = req.params["templateId"] as string;
    const { name, description, tasks } = req.body as UpdateTemplateInput;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("onboarding_templates")
      .select("id, institution_id")
      .eq("id", templateId)
      .single();

    if (fetchError || !existing) throw new AppError(404, "Template not found");
    if (existing.institution_id !== user.institutionId) throw new AppError(404, "Template not found");

    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (tasks !== undefined) {
      updatePayload.tasks_json = tasks.map((t, i) => ({
        ...t,
        position: t.position ?? i,
      }));
    }

    const { data, error } = await supabaseAdmin
      .from("onboarding_templates")
      .update(updatePayload)
      .eq("id", templateId)
      .select("id, name, description, tasks_json, updated_at")
      .single();

    if (error || !data) throw new AppError(500, "Failed to update template");

    res.status(200).json({ data });
  }
);

export const listTemplates = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const query = (res.locals["query"] ?? req.query) as ListTemplatesQuery;
    const { page, limit } = query;
    const { offset, limit: take } = paginate(String(page), String(limit), 20);

    const { data, error, count } = await supabaseAdmin
      .from("onboarding_templates")
      .select("id, name, description, tasks_json, created_by, created_at, updated_at", { count: "exact" })
      .eq("institution_id", user.institutionId)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (error) throw new AppError(500, "Failed to fetch templates");

    res.status(200).json({
      data: data ?? [],
      meta: { total: count ?? 0, page, limit: take },
    });
  }
);

export const getTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const templateId = req.params["templateId"] as string;

    const { data, error } = await supabaseAdmin
      .from("onboarding_templates")
      .select("id, name, description, tasks_json, created_by, created_at, updated_at")
      .eq("id", templateId)
      .eq("institution_id", user.institutionId)
      .single();

    if (error || !data) throw new AppError(404, "Template not found");

    res.status(200).json({ data });
  }
);

export const deleteTemplate = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const templateId = req.params["templateId"] as string;

    const { data: existing } = await supabaseAdmin
      .from("onboarding_templates")
      .select("id, institution_id")
      .eq("id", templateId)
      .single();

    if (!existing || existing.institution_id !== user.institutionId) {
      throw new AppError(404, "Template not found");
    }

    const { error } = await supabaseAdmin
      .from("onboarding_templates")
      .delete()
      .eq("id", templateId);

    if (error) throw new AppError(500, "Failed to delete template");

    res.status(200).json({ message: "Template deleted successfully" });
  }
);

// ─── CHECKLISTS ───────────────────────────────────────────────────────────────

export const instantiateChecklist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const { applicationId, templateId } = req.body as InstantiateChecklistInput;

    const { data: app, error: appError } = await supabaseAdmin
      .from("applications")
      .select("id, status, candidate_id, roles!inner(institution_id)")
      .eq("id", applicationId)
      .single();

    if (appError || !app) throw new AppError(404, "Application not found");

    const roleData = app.roles as unknown;
    const role = Array.isArray(roleData) ? roleData[0] : (roleData as { institution_id: string });

    if (!role || role.institution_id !== user.institutionId) {
      throw new AppError(404, "Application not found");
    }

    const { data: template, error: tplError } = await supabaseAdmin
      .from("onboarding_templates")
      .select("id, name, tasks_json, institution_id")
      .eq("id", templateId)
      .single();

    if (tplError || !template) throw new AppError(404, "Template not found");
    if (template.institution_id !== user.institutionId) {
      throw new AppError(404, "Template not found");
    }

    const { data: existing } = await supabaseAdmin
      .from("onboarding_checklists")
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (existing) {
      throw new AppError(409, "A checklist already exists for this application");
    }

    const { data: checklist, error: clError } = await supabaseAdmin
      .from("onboarding_checklists")
      .insert({
        application_id: applicationId,
        template_id: templateId,
        status: "NOT_STARTED",
      })
      .select("id, status, created_at")
      .single();

    if (clError || !checklist) throw new AppError(500, "Failed to create checklist");

    const tasks = (template.tasks_json as Array<{
      title: string;
      description?: string;
      assigneeType?: string;
      position?: number;
    }>).map((task, idx) => ({
      checklist_id: checklist.id,
      title: task.title,
      description: task.description || null,
      assignee_type: task.assigneeType || "CANDIDATE",
      position: task.position ?? idx,
      status: "PENDING",
    }));

    const { data: createdTasks, error: tasksError } = await supabaseAdmin
      .from("onboarding_tasks")
      .insert(tasks)
      .select("id, title, description, assignee_type, position, status");

    if (tasksError) {
      await supabaseAdmin.from("onboarding_checklists").delete().eq("id", checklist.id);
      throw new AppError(500, "Failed to create onboarding tasks");
    }

    await writeAuditLog(applicationId, "ONBOARDING_CHECKLIST_CREATED", user.id, {
      checklistId: checklist.id,
      templateId,
      templateName: template.name,
      tasksCount: tasks.length,
    });

    if ((app as any).candidate_id) {
      void createNotification({
        userId: (app as any).candidate_id as string,
        type: "ONBOARDING_TASK_ASSIGNED",
        title: NOTIF_TITLES.ONBOARDING_TASK_ASSIGNED,
        link: NOTIF_LINKS.candidateOnboarding,
      });
    }

    res.status(201).json({
      message: "Onboarding checklist created successfully",
      data: {
        checklist: {
          id: checklist.id,
          applicationId,
          templateId,
          status: checklist.status,
          createdAt: checklist.created_at,
        },
        tasks: createdTasks ?? [],
      },
    });
  }
);

export const getChecklist = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const applicationId = req.params["applicationId"] as string;

    const { data: app, error: appError } = await supabaseAdmin
      .from("applications")
      .select("id, candidate_id, roles!inner(institution_id)")
      .eq("id", applicationId)
      .single();

    if (appError || !app) throw new AppError(404, "Application not found");

    // Access control: institution member OR candidate owner
    const roleData = app.roles as unknown;
    const roleInst = Array.isArray(roleData) ? roleData[0] : (roleData as { institution_id: string });
    const isInstitutionMember = !!user.institutionId && roleInst?.institution_id === user.institutionId;
    const isCandidate = app.candidate_id === user.id;

    if (!isInstitutionMember && !isCandidate) {
      throw new AppError(403, "Access denied");
    }

    const { data: checklist, error } = await supabaseAdmin
      .from("onboarding_checklists")
      .select("id, application_id, template_id, status, created_at, updated_at")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (error) throw new AppError(500, "Failed to fetch checklist");
    if (!checklist) {
      res.status(200).json({ data: null });
      return;
    }

    const [{ data: tasks }, { data: documents }] = await Promise.all([
      supabaseAdmin
        .from("onboarding_tasks")
        .select("id, title, description, assignee_type, position, status, due_date, completed_at, completed_by, created_at")
        .eq("checklist_id", checklist.id)
        .order("position", { ascending: true }),
      supabaseAdmin
        .from("onboarding_documents")
        .select("id, task_id, file_name, mime_type, status, notes, created_at, updated_at")
        .eq("checklist_id", checklist.id)
        .order("created_at", { ascending: false }),
    ]);

    const allTasks = tasks ?? [];
    const completed = allTasks.filter((t: { status: string }) => t.status === "COMPLETED").length;
    const progress = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;

    res.status(200).json({
      data: {
        ...checklist,
        tasks: allTasks,
        documents: documents ?? [],
        progress: {
          total: allTasks.length,
          completed,
          percentage: progress,
        },
      },
    });
  }
);

// ─── TASKS ────────────────────────────────────────────────────────────────────

export const updateTaskStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const taskId = req.params["taskId"] as string;
    const { status } = req.body as UpdateTaskStatusInput;

    const { data: task, error: taskError } = await supabaseAdmin
      .from("onboarding_tasks")
      .select("id, checklist_id, status, assignee_type, onboarding_checklists!inner(application_id)")
      .eq("id", taskId)
      .single();

    if (taskError || !task) throw new AppError(404, "Task not found");

    const checklistData = task.onboarding_checklists as unknown;
    const checklist = Array.isArray(checklistData) ? checklistData[0] : (checklistData as { application_id: string });

    if (!checklist) throw new AppError(404, "Checklist not found");

    const { data: app, error: appError } = await supabaseAdmin
      .from("applications")
      .select("id, candidate_id, roles!inner(institution_id)")
      .eq("id", checklist.application_id)
      .single();

    if (appError || !app) throw new AppError(404, "Application not found");

    const taskRoleData = app.roles as unknown as { institution_id: string };
    const isInstitutionMember = !!user.institutionId && taskRoleData?.institution_id === user.institutionId;
    const isCandidate = app.candidate_id === user.id;

    if (isCandidate && !isInstitutionMember) {
      // Candidate can only update tasks assigned to them
      if (task.assignee_type !== "CANDIDATE") {
        throw new AppError(403, "This task is not assigned to you");
      }
    } else if (!isInstitutionMember) {
      throw new AppError(403, "Access denied");
    }

    const updatePayload: Record<string, unknown> = { status };
    if (status === "COMPLETED") {
      updatePayload.completed_at = new Date().toISOString();
      updatePayload.completed_by = user.id;
    } else {
      updatePayload.completed_at = null;
      updatePayload.completed_by = null;
    }

    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from("onboarding_tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select("id, title, status, completed_at, completed_by, updated_at")
      .single();

    if (updateError || !updatedTask) throw new AppError(500, "Failed to update task status");

    const { data: allTasks } = await supabaseAdmin
      .from("onboarding_tasks")
      .select("status")
      .eq("checklist_id", task.checklist_id);

    const tasksList = allTasks ?? [];
    const allCompleted = tasksList.every((t) => t.status === "COMPLETED" || t.status === "SKIPPED");
    const anyInProgress = tasksList.some((t) => t.status === "IN_PROGRESS" || t.status === "COMPLETED");
    let checklistStatus = "NOT_STARTED";
    if (allCompleted) checklistStatus = "COMPLETED";
    else if (anyInProgress) checklistStatus = "IN_PROGRESS";

    await supabaseAdmin
      .from("onboarding_checklists")
      .update({ status: checklistStatus })
      .eq("id", task.checklist_id);

    await writeAuditLog(checklist.application_id, "ONBOARDING_TASK_UPDATED", user.id, {
      taskId,
      taskTitle: updatedTask.title,
      previousStatus: task.status,
      newStatus: status,
      checklistStatus,
    });

    res.status(200).json({
      data: updatedTask,
      checklistStatus,
    });
  }
);

export const presignDocumentUpload = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const { checklistId, taskId, fileName, mimeType } = req.body as PresignOnboardingUploadInput;

    const { data: checklist, error: checklistError } = await supabaseAdmin
      .from("onboarding_checklists")
      .select("id, application_id")
      .eq("id", checklistId)
      .single();

    if (checklistError || !checklist) throw new AppError(404, "Checklist not found");

    const { data: app, error: appError } = await supabaseAdmin
      .from("applications")
      .select("id, candidate_id, roles!inner(institution_id)")
      .eq("id", checklist.application_id)
      .single();

    if (appError || !app) throw new AppError(404, "Application not found");

    const presignRoleData = app.roles as unknown;
    const presignRole = Array.isArray(presignRoleData) ? presignRoleData[0] : (presignRoleData as { institution_id: string });
    const isInstitutionMemberPresign = !!user.institutionId && presignRole?.institution_id === user.institutionId;
    const isCandidatePresign = app.candidate_id === user.id;

    if (!isInstitutionMemberPresign && !isCandidatePresign) {
      throw new AppError(403, "Access denied");
    }

    const storagePath = buildStoragePath(
      "onboarding",
      checklistId,
      `${Date.now()}-${fileName.replace(/[^\w.-]/g, "_")}`
    );

    const { data: doc, error: docError } = await supabaseAdmin
      .from("onboarding_documents")
      .insert({
        checklist_id: checklistId,
        task_id: taskId || null,
        candidate_id: app.candidate_id,
        uploaded_by: user.id,
        file_name: fileName,
        mime_type: mimeType,
        storage_path: storagePath,
        status: "PENDING_UPLOAD",
      })
      .select("id, storage_path, status")
      .single();

    if (docError || !doc) throw new AppError(500, "Failed to prepare onboarding document upload");

    await ensureBucketExistsOrThrow(STORAGE_BUCKETS.ONBOARDING_DOCUMENTS);

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.ONBOARDING_DOCUMENTS)
      .createSignedUploadUrl(storagePath);

    if (signedError || !signed) throw new AppError(500, "Failed to generate upload URL");

    res.status(201).json({
      data: {
        documentId: doc.id,
        storagePath,
        signedUrl: signed.signedUrl,
        token: signed.token,
      },
    });
  }
);

export const completeDocumentUpload = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const { documentId, storagePath } = req.body as CompleteOnboardingUploadInput;

    const { data: doc, error: docError } = await supabaseAdmin
      .from("onboarding_documents")
      .select("id, uploaded_by, checklist_id")
      .eq("id", documentId)
      .single();

    if (docError || !doc) throw new AppError(404, "Document not found");
    // Ownership check: the uploader or an institution member can confirm.
    // Candidates uploading their own docs are always the uploaded_by.
    if (doc.uploaded_by !== user.id && !user.institutionId) {
      throw new AppError(403, "Access denied");
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("onboarding_documents")
      .update({
        storage_path: storagePath,
        status: "UPLOADED",
      })
      .eq("id", documentId)
      .select("id, status, storage_path, updated_at")
      .single();

    if (updateError || !updated) throw new AppError(500, "Failed to finalize document upload");

    res.status(200).json({ data: updated });
  }
);

export const verifyOnboardingDocument = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    const { status, notes } = req.body as VerifyOnboardingDocumentInput;

    const { data: doc, error: docError } = await supabaseAdmin
      .from("onboarding_documents")
      .select("id, checklist_id, onboarding_checklists!inner(application_id)")
      .eq("id", id)
      .single();

    if (docError || !doc) throw new AppError(404, "Document not found");

    const checklistData = doc.onboarding_checklists as unknown;
    const checklist = Array.isArray(checklistData)
      ? checklistData[0]
      : (checklistData as { application_id: string });

    const { data: app, error: appError } = await supabaseAdmin
      .from("applications")
      .select("id, roles!inner(institution_id)")
      .eq("id", checklist.application_id)
      .single();

    if (appError || !app) throw new AppError(404, "Application not found");

    const roleData = app.roles as unknown;
    const role = Array.isArray(roleData) ? roleData[0] : (roleData as { institution_id: string });
    if (role.institution_id !== user.institutionId) throw new AppError(403, "Access denied");

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("onboarding_documents")
      .update({
        status,
        notes: notes || null,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, notes, verified_by, verified_at, updated_at")
      .single();

    if (updateError || !updated) throw new AppError(500, "Failed to verify document");

    await writeAuditLog(checklist.application_id, "ONBOARDING_DOCUMENT_VERIFIED", user.id, {
      documentId: id,
      status,
      notes: notes || null,
    });

    res.status(200).json({ data: updated });
  }
);

// ─── Phase F — Signing chain ──────────────────────────────────────────────────

/**
 * POST /onboarding/documents/:id/signing-chain
 * HR initialises the ordered list of signers for an onboarding document.
 * Idempotent: returns existing chain if already created.
 */
export const initSigningChain = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const documentId = req.params["id"] as string;
    const { signers } = req.body as InitSigningChainInput;

    // Verify document belongs to this institution via checklist → application → role.
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("onboarding_documents")
      .select(`
        id,
        onboarding_checklists!inner(
          application_id,
          applications!inner(roles!inner(institution_id))
        )
      `)
      .eq("id", documentId)
      .single();

    if (docErr || !doc) throw new AppError(404, "Document not found");

    const cl = doc.onboarding_checklists as unknown as {
      application_id: string;
      applications: { roles: { institution_id: string } | { institution_id: string }[] };
    };
    const roles = Array.isArray(cl.applications?.roles) ? cl.applications.roles[0] : cl.applications?.roles;
    if (!roles || roles.institution_id !== user.institutionId) {
      throw new AppError(403, "Document does not belong to this workspace");
    }

    // Idempotent: return existing chain.
    const { data: existing } = await supabaseAdmin
      .from("document_signers")
      .select("id, position, signer_role, signer_user_id, status, signed_at")
      .eq("document_id", documentId)
      .order("position", { ascending: true });

    if (existing && existing.length > 0) {
      res.status(200).json({ data: existing });
      return;
    }

    const rows = signers.map((s, i) => ({
      document_id: documentId,
      position: i + 1,
      signer_role: s.signer_role,
      signer_user_id: s.signer_user_id ?? null,
      status: "PENDING" as const,
    }));

    const { data: created, error } = await supabaseAdmin
      .from("document_signers")
      .insert(rows)
      .select("id, position, signer_role, signer_user_id, status, signature_token, signed_at");

    if (error || !created) throw new AppError(500, "Failed to initialise signing chain");

    await writeAuditLog(cl.application_id, "SIGNING_CHAIN_INITIALISED", user.id, {
      documentId,
      steps: signers.length,
    });

    res.status(201).json({ data: created });
  }
);

/**
 * GET /onboarding/documents/:id/signing-chain
 * Read the signing chain status for a document.
 */
export const getSigningChain = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const documentId = req.params["id"] as string;

    const { data, error } = await supabaseAdmin
      .from("document_signers")
      .select(`
        id, position, signer_role, signer_user_id, status, signed_at, signature_meta,
        profiles:signer_user_id ( full_name, email )
      `)
      .eq("document_id", documentId)
      .order("position", { ascending: true });

    if (error) throw new AppError(500, "Failed to load signing chain");

    res.status(200).json({ data: data ?? [] });
  }
);

/**
 * POST /onboarding/documents/:id/signing-chain/:position/sign
 * Authenticated institution member signs their step.
 * Earlier steps must be SIGNED first.
 */
export const signDocument = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const documentId = req.params["id"] as string;
    const position = parseInt(req.params["position"] as string, 10);
    if (!Number.isFinite(position) || position < 1) throw new AppError(400, "Invalid position");

    const { signature_meta } = req.body as SignDocumentInput;

    // Load the step.
    const { data: stepRow, error: stepErr } = await supabaseAdmin
      .from("document_signers")
      .select("id, position, signer_role, signer_user_id, status, document_id")
      .eq("document_id", documentId)
      .eq("position", position)
      .maybeSingle();

    if (stepErr || !stepRow) throw new AppError(404, "Signing step not found");
    if (stepRow.status !== "PENDING") {
      throw new AppError(409, `Step already ${(stepRow.status as string).toLowerCase()}`);
    }

    // All earlier steps must be SIGNED.
    const { data: earlier } = await supabaseAdmin
      .from("document_signers")
      .select("position, status")
      .eq("document_id", documentId)
      .lt("position", position);

    const blocked = (earlier ?? []).find((s) => s.status !== "SIGNED");
    if (blocked) {
      throw new AppError(409, `Step ${blocked.position} must be signed first`);
    }

    // Verify user's role matches (OWNER can sign any step).
    const { data: membership } = await supabaseAdmin
      .from("institution_members")
      .select("role_specialization, role_custom_label")
      .eq("user_id", user.id)
      .eq("institution_id", user.institutionId)
      .maybeSingle();

    const effectiveRole =
      membership?.role_specialization === "CUSTOM" && membership?.role_custom_label
        ? membership.role_custom_label
        : membership?.role_specialization ?? null;

    if (!effectiveRole) throw new AppError(403, "Not a member of this institution");
    if (effectiveRole !== "OWNER" && effectiveRole !== stepRow.signer_role) {
      throw new AppError(403, `This step requires signer role: ${stepRow.signer_role}`);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("document_signers")
      .update({
        status: "SIGNED",
        signer_user_id: user.id,
        signed_at: now,
        signature_meta: signature_meta ?? {},
      })
      .eq("id", stepRow.id)
      .select("id, position, signer_role, status, signed_at")
      .single();

    if (updateErr || !updated) throw new AppError(500, "Failed to record signature");

    res.status(200).json({ data: updated });
  }
);

/**
 * POST /onboarding/documents/:id/signing-chain/:position/reject
 * Institution member rejects their signing step (blocks the chain).
 */
export const rejectSignerStep = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "Workspace context required");

    const documentId = req.params["id"] as string;
    const position = parseInt(req.params["position"] as string, 10);
    if (!Number.isFinite(position) || position < 1) throw new AppError(400, "Invalid position");

    const { reason } = req.body as RejectSignerStepInput;

    const { data: stepRow, error: stepErr } = await supabaseAdmin
      .from("document_signers")
      .select("id, signer_role, status")
      .eq("document_id", documentId)
      .eq("position", position)
      .maybeSingle();

    if (stepErr || !stepRow) throw new AppError(404, "Signing step not found");
    if (stepRow.status !== "PENDING") {
      throw new AppError(409, `Step already ${(stepRow.status as string).toLowerCase()}`);
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("document_signers")
      .update({
        status: "REJECTED",
        signer_user_id: user.id,
        signed_at: new Date().toISOString(),
        signature_meta: { reason: reason ?? null },
      })
      .eq("id", stepRow.id)
      .select("id, position, signer_role, status, signed_at")
      .single();

    if (updateErr || !updated) throw new AppError(500, "Failed to record rejection");

    res.status(200).json({ data: updated });
  }
);

/**
 * POST /onboarding/documents/sign/:token
 * Public route — candidate signs their step via the unique signature_token UUID.
 * No auth required; token is the secret.
 */
export const candidateSignByToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;
    const { signature_meta } = req.body as SignDocumentInput;

    const { data: stepRow, error: stepErr } = await supabaseAdmin
      .from("document_signers")
      .select("id, position, signer_role, status, document_id")
      .eq("signature_token", token)
      .maybeSingle();

    if (stepErr || !stepRow) throw new AppError(404, "Signing link not found or invalid");
    if (stepRow.signer_role !== "CANDIDATE") {
      throw new AppError(403, "This signing link is not intended for candidates");
    }
    if (stepRow.status !== "PENDING") {
      throw new AppError(409, `Document already ${(stepRow.status as string).toLowerCase()}`);
    }

    // All earlier steps must be SIGNED.
    const { data: earlier } = await supabaseAdmin
      .from("document_signers")
      .select("position, status")
      .eq("document_id", stepRow.document_id)
      .lt("position", stepRow.position);

    const blocked = (earlier ?? []).find((s) => s.status !== "SIGNED");
    if (blocked) {
      throw new AppError(409, `Waiting for earlier signers to complete (step ${blocked.position})`);
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("document_signers")
      .update({
        status: "SIGNED",
        signed_at: new Date().toISOString(),
        signature_meta: signature_meta ?? {},
        // Invalidate the token so it cannot be reused.
        signature_token: null,
      })
      .eq("id", stepRow.id)
      .select("id, position, signer_role, status, signed_at")
      .single();

    if (updateErr || !updated) throw new AppError(500, "Failed to record candidate signature");

    res.status(200).json({
      message: "Document signed successfully",
      data: updated,
    });
  }
);
