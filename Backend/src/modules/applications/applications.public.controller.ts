// applications.public.controller — handles public application flow
import { Request, Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import { uploadFile, STORAGE_BUCKETS, buildStoragePath } from "@/services/storage.service";
import { createNotification, NOTIF_LINKS, NOTIF_TITLES } from "@/modules/notifications/notifications.service";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { deriveRoleFieldsFromFullForm } from "@/modules/roles/role-form.mapper";

/**
 * Get public role details by share link slug.
 * No authentication required - used for public apply form.
 * 
 * Slug format: "role-xK8a2Lp"
 */
export const getPublicRoleBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  if (!slug) {
    throw new AppError(400, "Share link slug is required");
  }

  // Find role by share_link (reconstructed from slug)
  // The share_link in DB includes full URL or path, but we search by slug pattern
  const { data: role, error: roleError } = await supabaseAdmin
    .from("roles")
    .select(`
      id,
      title,
      description,
      location,
      status,
      application_form,
      role_dna(full_form_json),
      created_at
    `)
    .ilike("share_link", `%${slug}`)
    .single();

  if (roleError || !role) {
    throw new AppError(404, "Role not found");
  }

  if (role.status !== "ACTIVE") {
    throw new AppError(422, "This role is not open for applications");
  }

  const roleDna = Array.isArray((role as any).role_dna) ? (role as any).role_dna[0] : (role as any).role_dna;
  const fullForm = roleDna?.full_form_json || {};
  const customQuestionsRaw = typeof fullForm.customFormQuestions === "string"
    ? fullForm.customFormQuestions
    : "";
  const derivedQuestions = customQuestionsRaw
    .split("\n")
    .map((line: string) => line.trim())
    .filter(Boolean)
    .map((label: string, index: number) => ({
      id: `custom_idx_${index}`,
      type: "textarea",
      label,
      required: true,
    }));

  const data = {
    ...role,
    title: fullForm.title || role.title,
    description: fullForm.mission90Day || role.description,
    location: role.location || `${fullForm.country || ""}${fullForm.city ? ` - ${fullForm.city}` : ""}`,
    application_form: derivedQuestions.length ? derivedQuestions : role.application_form,
    role_dna: undefined,
    full_form_json: fullForm,
  };

  res.status(200).json({ data });
});

export const applyPublic = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { shareLink } = req.params;
  const { fullName: submittedFullName, formDna, answers } = req.body;

  if (!req.user?.id || !req.user?.email) {
    throw new AppError(401, "Unauthorized");
  }

  const candidateId = req.user.id;
  const email = req.user.email;

  // Contact details typed in the form. The e-mail defaults to the account's; it may differ
  // (e.g. a personal address) but must be valid. LinkedIn is optional.
  const submittedEmail = typeof req.body.email === "string" ? req.body.email.trim() : "";
  if (submittedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) {
    throw new AppError(400, "Invalid email address");
  }
  const contactEmail = submittedEmail || email;
  const submittedLinkedin = typeof req.body.linkedin === "string" ? req.body.linkedin.trim() : "";
  if (submittedLinkedin && !/^https?:\/\//i.test(submittedLinkedin)) {
    throw new AppError(400, "Invalid LinkedIn URL");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", candidateId)
    .single();

  const fullName =
    (typeof submittedFullName === "string" && submittedFullName.trim().length > 0
      ? submittedFullName.trim()
      : null) ||
    profile?.full_name ||
    email;

  if (!fullName) throw new AppError(400, "Full name is required");

  // Update profile full_name if not set yet
  if (!profile?.full_name && fullName !== email) {
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", candidateId);
  }

  // 1. Find the role — multiple match strategies
  const shareLinkStr = Array.isArray(shareLink) ? shareLink[0] : shareLink;
  const shareLinkDecoded = decodeURIComponent(shareLinkStr);
  console.log("[applyPublic] shareLink:", shareLink, "decoded:", shareLinkDecoded);
  
  // Try exact match first
  let { data: role, error: roleError } = await supabaseAdmin
    .from("roles")
    .select("id, status, institution_id, share_link")
    .eq("share_link", shareLinkDecoded)
    .maybeSingle();

  // If not found, try ilike
  if (!role) {
    console.log("[applyPublic] exact match failed for:", shareLinkDecoded);
    const ilikeRes = await supabaseAdmin
      .from("roles")
      .select("id, status, institution_id, share_link")
      .ilike("share_link", `%${shareLinkDecoded}%`)
      .maybeSingle();
    role = ilikeRes.data;
    roleError = ilikeRes.error;
  }

  // If STILL not found, list all roles to debug
  if (!role) {
    console.log("[applyPublic] CRITICAL: role not found for shareLink:", shareLinkDecoded);
    const allRoles = await supabaseAdmin.from("roles").select("id, share_link, status").limit(5);
    console.log("[applyPublic] sample roles in DB:", JSON.stringify(allRoles.data));
  }

  console.log("[applyPublic] found role:", { id: role?.id, share_link: (role as any)?.share_link, status: role?.status });

  if (roleError || !role) {
    throw new AppError(404, "No active role found for this link");
  }

  if (role.status !== "ACTIVE") {
    throw new AppError(422, "This role is not open for applications");
  }

  // 2. Prevent duplicate application for same candidate + role
  const { data: existingApp } = await supabaseAdmin
    .from("applications")
    .select("id")
    .eq("role_id", role.id)
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (existingApp) {
    throw new AppError(409, "You have already applied to this role");
  }

  // 4. Upload Documents if provided
  let cvUrl = null;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  
  const uploadDoc = async (file: Express.Multer.File, prefix: string) => {
    const pathId = candidateId;
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, "_");
    const path = buildStoragePath(pathId, `${prefix}-${Date.now()}-${cleanName}`);
    const uploadResult = await uploadFile(STORAGE_BUCKETS.DOCUMENTS, path, file.buffer, file.mimetype);
    return { url: uploadResult.url, path, name: file.originalname };
  };

  // NB: application_documents column is `file_type` (enum CV|MOTIVATION_LETTER|OTHER),
  // not `type`. Using the wrong key throws "Could not find the 'type' column" → 500.
  const uploadedDocs: { file_type: string, file_name: string, storage_path: string }[] = [];

  // Handle CV
  if (files && files.cv && files.cv.length > 0) {
    const res = await uploadDoc(files.cv[0], 'cv');
    cvUrl = res.url;
    uploadedDocs.push({ file_type: "CV", file_name: res.name, storage_path: res.path });
  } else if (req.file) { // Fallback for old single-file uploads
    const res = await uploadDoc(req.file, 'cv');
    cvUrl = res.url;
    uploadedDocs.push({ file_type: "CV", file_name: res.name, storage_path: res.path });
  }

  // Handle Extra Documents
  if (files && files.documents && files.documents.length > 0) {
    for (const doc of files.documents) {
      const res = await uploadDoc(doc, 'doc');
      uploadedDocs.push({ file_type: "OTHER", file_name: res.name, storage_path: res.path });
    }
  }

  // 5. Build form DNA
  let parsedDna: any = {};
  if (formDna) {
    try {
      parsedDna = typeof formDna === "string" ? JSON.parse(formDna) : formDna;
    } catch (e) {
      console.warn("Invalid formDna JSON", e);
    }
  }

  let finalDnaSnapshot: any = parsedDna;

  const { data: currentDna } = await supabaseAdmin
    .from("talent_dna")
    .select("*")
    .eq("candidate_id", candidateId)
    .single();

  const currentIdentity = (currentDna?.talent_identity as any) || {};
  const newIdentity = {
    ...currentIdentity,
    name: fullName,
    email: contactEmail,
    links: {
      ...(currentIdentity.links || {}),
      cv: cvUrl || currentIdentity?.links?.cv,
      ...(submittedLinkedin ? { linkedin: submittedLinkedin } : {}),
    },
  };

  const updatePayload = {
    candidate_id: candidateId,
    ...(currentDna || {}),
    ...parsedDna,
    talent_identity: newIdentity
  };

  const { error: dnaUpsertError } = await supabaseAdmin
    .from("talent_dna")
    .upsert(updatePayload, { onConflict: "candidate_id" });

  if (dnaUpsertError) {
    console.warn(`[apply] talent_dna upsert failed for ${candidateId}: ${dnaUpsertError.message}`);
  }

  const { data: updatedDna } = await supabaseAdmin
    .from("talent_dna")
    .select("*")
    .eq("candidate_id", candidateId)
    .single();

  finalDnaSnapshot = updatedDna || updatePayload;

  // 6. Create Application record
  const insertPayload: any = {
    role_id: role.id,
    status: "PENDING",
    dna_snapshot: finalDnaSnapshot,
  };
  
  if (answers) {
    let parsedAnswers: any = {};
    try {
      parsedAnswers = typeof answers === "string" ? JSON.parse(answers) : answers;
    } catch (e) {
      console.warn("Invalid answers JSON", e);
    }
    insertPayload.answers = parsedAnswers;
  }

  insertPayload.candidate_id = candidateId;

  const { data: appData, error: appError } = await supabaseAdmin
    .from("applications")
    .insert(insertPayload)
    .select("id")
    .single();

  if (appError || !appData) {
    console.error("Failed to insert app:", appError);
    throw new AppError(500, "Failed to create application");
  }

  // 6.5 Insert documents
  if (uploadedDocs.length > 0) {
    const docsPayload = uploadedDocs.map((d) => ({
      application_id: appData.id,
      ...d
    }));
    const docsResult = await supabaseAdmin.from("application_documents").insert(docsPayload);
    if (docsResult.error) {
      console.error("Failed to attach documents to application:", docsResult.error);
    }
  }

  // 6.6 Notify institution HR members about new application
  if (role.institution_id) {
    // roles has no title column: the title lives in role_dna.full_form_json.
    const { data: roleDnaRow } = await supabaseAdmin
      .from("role_dna")
      .select("full_form_json")
      .eq("role_id", role.id)
      .maybeSingle();
    const roleTitle = deriveRoleFieldsFromFullForm(
      (roleDnaRow?.full_form_json ?? {}) as Record<string, unknown>
    ).title;
    // Notify every active member of the enterprise, admins included.
    const { data: members } = await supabaseAdmin
      .from("institution_members")
      .select("user_id")
      .eq("institution_id", role.institution_id)
      .in("status", ["OWNER", "ADMIN", "ACTIVE"]);

    if (members && members.length > 0) {
      for (const member of members) {
        void createNotification({
          userId: member.user_id as string,
          institutionId: role.institution_id,
          type: "APPLICATION_RECEIVED",
          title: NOTIF_TITLES.APPLICATION_RECEIVED,
          body: `${fullName} applied for ${roleTitle}`,
          link: `${NOTIF_LINKS.companyApplications}/${appData.id}`,
        }).catch((err: any) => console.warn("[apply] notification failed:", err?.message));
      }
    }
  }

  res.status(202).json({
    message: "Application accepted and pending HR review or AI evaluation",
    applicationId: appData.id,
    status: "PENDING",
    poll: {
      endpoint: `/applications/public/status/${appData.id}`,
      intervalMs: 5000,
    },
  });

  // Auto-launch AI matching in background (fire-and-forget)
  const { runMatching } = await import("@/modules/matching/matching.service");
  const matchLocale = (req.headers["x-locale"] === "en" ? "en" : "fr") as "fr" | "en";
  runMatching(role.id, 10, matchLocale).catch((err: any) =>
    console.warn(`[auto-match] bg match failed for role ${role.id}:`, err?.message)
  );
});

export const getPublicApplicationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { applicationId } = req.params;

  if (!req.user?.id) {
    throw new AppError(401, "Unauthorized");
  }

  if (!applicationId) {
    throw new AppError(400, "Application ID is required");
  }

  const { data: application, error } = await supabaseAdmin
    .from("applications")
    .select("id, status, candidate_id, match_score, dna_snapshot")
    .eq("id", applicationId)
    .single();

  if (error || !application) {
    throw new AppError(404, "Application not found");
  }

  if (application.candidate_id !== req.user.id) {
    throw new AppError(403, "Unauthorized access to this application status");
  }

  res.status(200).json({
    data: {
      applicationId: application.id,
      status: application.status,
      matchScore: application.match_score,
      isProcessing: application.status === "ANALYSING",
      isCompleted: application.status === "FINISHED" || application.status === "VALIDATED",
    },
  });
});
