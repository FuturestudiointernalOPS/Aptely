import { Response } from "express";
import { randomUUID } from "crypto";
import path from "path";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/helpers";
import { AppError } from "@/middleware/error.middleware";
import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";
import { Resend } from "resend";
import type {
  AddSkillProofInput,
  AddWorkEvidenceInput,
  RequestEndorsementInput,
  SubmitEndorsementInput,
} from "./vault.schema";

const resend = new Resend(env.RESEND_API_KEY);

// ─── Helper: resolve individual_profile.id from auth user ────────────────────

async function getIndividualProfileId(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("individual_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw new AppError(500, "Failed to access individual profile");
  if (data) return data.id;
  // Auto-create on first vault access
  const { data: created, error: createErr } = await supabaseAdmin
    .from("individual_profiles")
    .insert({ profile_id: userId })
    .select("id")
    .single();
  if (createErr || !created) throw new AppError(500, "Failed to initialize individual profile");
  return created.id;
}

// ─── POST /vault/me/proofs/upload ────────────────────────────────────────────

const VAULT_BUCKET = "vault-proofs";
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export const uploadVaultFile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new AppError(400, "No file provided");
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new AppError(415, "Only PDF and images (JPEG, PNG, GIF, WebP) are allowed");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new AppError(413, "File exceeds 10 MB limit");
    }

    const ext = path.extname(file.originalname).toLowerCase() || "";
    const storagePath = `${individualId}/${randomUUID()}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(VAULT_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) throw new AppError(500, `Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabaseAdmin.storage.from(VAULT_BUCKET).getPublicUrl(storagePath);

    res.status(201).json({ data: { url: urlData.publicUrl } });
  }
);

// ─── GET /vault/me/proofs ─────────────────────────────────────────────────────

export const listSkillProofs = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);

    const { data, error } = await supabaseAdmin
      .from("skill_proofs")
      .select("*")
      .eq("individual_profile_id", individualId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch skill proofs");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── POST /vault/me/proofs ────────────────────────────────────────────────────

export const addSkillProof = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const body = req.body as AddSkillProofInput;

    const payload: Record<string, unknown> = {
      individual_profile_id: individualId,
      skill_name: body.skill_name,
      proof_type: body.proof_type,
      title: body.title,
      description: body.description ?? null,
    };

    if (body.proof_type === "FILE") payload["file_url"] = body.file_url;
    else payload["link_url"] = body.link_url;

    const { data, error } = await supabaseAdmin
      .from("skill_proofs")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) throw new AppError(500, "Failed to add skill proof");
    res.status(201).json({ data });
  }
);

// ─── DELETE /vault/me/proofs/:id ──────────────────────────────────────────────

export const deleteSkillProof = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const proofId = req.params["id"] as string;

    const { error } = await supabaseAdmin
      .from("skill_proofs")
      .delete()
      .eq("id", proofId)
      .eq("individual_profile_id", individualId);

    if (error) throw new AppError(500, "Failed to delete skill proof");
    res.status(200).json({ message: "Proof deleted" });
  }
);

// ─── GET /vault/me/evidence ───────────────────────────────────────────────────

export const listWorkEvidence = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);

    const { data, error } = await supabaseAdmin
      .from("work_evidence")
      .select("*")
      .eq("individual_profile_id", individualId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch work evidence");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── POST /vault/me/evidence ──────────────────────────────────────────────────

export const addWorkEvidence = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const body = req.body as AddWorkEvidenceInput;

    const { data, error } = await supabaseAdmin
      .from("work_evidence")
      .insert({
        individual_profile_id: individualId,
        skill_proof_id: body.skill_proof_id ?? null,
        title: body.title,
        problem: body.problem,
        tools: body.tools,
        result: body.result,
        impact_score: body.impact_score ?? null,
      })
      .select("*")
      .single();

    if (error || !data) throw new AppError(500, "Failed to add work evidence");
    res.status(201).json({ data });
  }
);

// ─── DELETE /vault/me/evidence/:id ───────────────────────────────────────────

export const deleteWorkEvidence = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const evidenceId = req.params["id"] as string;

    const { error } = await supabaseAdmin
      .from("work_evidence")
      .delete()
      .eq("id", evidenceId)
      .eq("individual_profile_id", individualId);

    if (error) throw new AppError(500, "Failed to delete work evidence");
    res.status(200).json({ message: "Evidence deleted" });
  }
);

// ─── GET /vault/me/score ─────────────────────────────────────────────────────

export const getCompletionScore = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const individualId = await getIndividualProfileId(userId);

    const [profileRes, proofsRes, evidenceRes, endorsementsRes] = await Promise.all([
      supabaseAdmin.from("individual_profiles").select("*").eq("profile_id", userId).maybeSingle(),
      supabaseAdmin
        .from("skill_proofs")
        .select("id", { count: "exact", head: true })
        .eq("individual_profile_id", individualId),
      supabaseAdmin
        .from("work_evidence")
        .select("id", { count: "exact", head: true })
        .eq("individual_profile_id", individualId),
      supabaseAdmin
        .from("endorsements")
        .select("id", { count: "exact", head: true })
        .eq("status", "SUBMITTED")
        .eq("individual_profile_id", individualId),
    ]);

    const profile = profileRes.data;
    const breakdown: Record<string, { earned: number; max: number; done: boolean }> = {
      headline: { earned: profile?.headline ? 5 : 0, max: 5, done: Boolean(profile?.headline) },
      bio: { earned: profile?.bio ? 10 : 0, max: 10, done: Boolean(profile?.bio) },
      location: { earned: profile?.location ? 5 : 0, max: 5, done: Boolean(profile?.location) },
      availability: {
        earned: profile?.availability ? 5 : 0,
        max: 5,
        done: Boolean(profile?.availability),
      },
      skills: {
        earned: (profile?.skills?.length ?? 0) >= 3 ? 15 : 0,
        max: 15,
        done: (profile?.skills?.length ?? 0) >= 3,
      },
      experience: {
        earned: (profile?.experience?.length ?? 0) >= 1 ? 15 : 0,
        max: 15,
        done: (profile?.experience?.length ?? 0) >= 1,
      },
      education: {
        earned: (profile?.education?.length ?? 0) >= 1 ? 10 : 0,
        max: 10,
        done: (profile?.education?.length ?? 0) >= 1,
      },
      languages: {
        earned: (profile?.languages?.length ?? 0) >= 1 ? 5 : 0,
        max: 5,
        done: (profile?.languages?.length ?? 0) >= 1,
      },
      social_links: {
        earned: profile?.linkedin_url || profile?.github_url ? 5 : 0,
        max: 5,
        done: Boolean(profile?.linkedin_url || profile?.github_url),
      },
      skill_proofs: {
        earned: (proofsRes.count ?? 0) >= 1 ? 15 : 0,
        max: 15,
        done: (proofsRes.count ?? 0) >= 1,
      },
      work_evidence: {
        earned: (evidenceRes.count ?? 0) >= 1 ? 5 : 0,
        max: 5,
        done: (evidenceRes.count ?? 0) >= 1,
      },
      endorsements: {
        earned: (endorsementsRes.count ?? 0) >= 1 ? 5 : 0,
        max: 5,
        done: (endorsementsRes.count ?? 0) >= 1,
      },
    };

    const total = Object.values(breakdown).reduce((s, b) => s + b.earned, 0);
    const maxTotal = Object.values(breakdown).reduce((s, b) => s + b.max, 0);
    const score = Math.round((total / maxTotal) * 100);

    const nudges: string[] = [];
    if (!breakdown.headline.done) nudges.push("individual.profile.nudge.headline");
    if (!breakdown.bio.done) nudges.push("individual.profile.nudge.bio");
    if (!breakdown.skills.done) nudges.push("individual.profile.nudge.skills");
    if (!breakdown.experience.done) nudges.push("individual.profile.nudge.experience");
    if (!breakdown.skill_proofs.done) nudges.push("individual.profile.nudge.skill_proofs");
    if (!breakdown.endorsements.done) nudges.push("individual.profile.nudge.endorsements");

    res.status(200).json({ data: { score, breakdown, nudges } });
  }
);

// ─── POST /vault/me/endorsements/request ─────────────────────────────────────

export const requestEndorsement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const body = req.body as RequestEndorsementInput;

    const { data, error } = await supabaseAdmin
      .from("endorsements")
      .insert({
        individual_profile_id: individualId,
        endorser_email: body.endorser_email,
        endorser_name: body.endorser_name ?? null,
        dimension: body.dimension,
      })
      .select("id, token, dimension, endorser_email")
      .single();

    if (error || !data) throw new AppError(500, "Failed to create endorsement request");

    const endorseUrl = `${env.FRONTEND_URL}/candidate/endorse/${data.token}`;

    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", req.user!.id)
      .maybeSingle();

    const requesterName = requesterProfile?.full_name ?? "Someone";

    let emailSent = false;
    try {
      const { error: sendError } = await resend.emails.send({
        from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
        to: body.endorser_email,
        subject: `${requesterName} is asking for your endorsement on Aptely`,
        html: `<div style="background:#0f1117;padding:32px 0;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#1a1d2e;border-radius:12px;padding:40px;color:#f0f0f0;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#FF6B00;">Aptely</span>
    </div>
    <h2 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#ffffff;">Endorsement Request</h2>
    <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Hi${body.endorser_name ? ` ${body.endorser_name}` : ""},<br/><br/>
      <strong style="color:#ffffff;">${requesterName}</strong> is asking you to endorse them on: <strong style="color:#ffffff;">${body.dimension}</strong>.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${endorseUrl}" style="display:inline-block;background:#FF6B00;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
        Leave an Endorsement
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px;margin:24px 0 0;">This link expires in 7 days.</p>
    <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">If you didn't expect this request, ignore this email.</p>
  </div>
</div>`,
        text: `${requesterName} is asking you to endorse them on: ${body.dimension}.\n\nClick here: ${endorseUrl}\n\nThis link expires in 7 days.`,
      });
      if (sendError) {
        console.error("[Endorsement] Resend error:", sendError.message);
      } else {
        emailSent = true;
      }
    } catch (emailErr) {
      console.error("[Endorsement] Email send failed:", emailErr);
    }

    res.status(201).json({
      data: {
        id: data.id,
        dimension: data.dimension,
        endorser_email: data.endorser_email,
        token: data.token,
        emailSent,
      },
    });
  }
);

// ─── GET /vault/me/endorsements ───────────────────────────────────────────────

export const listEndorsements = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);

    const { data, error } = await supabaseAdmin
      .from("endorsements")
      .select(
        "id, endorser_email, endorser_name, dimension, rating, comment, status, token, expires_at, requested_at, submitted_at"
      )
      .eq("individual_profile_id", individualId)
      .order("requested_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch endorsements");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── DELETE /vault/me/endorsements/:id ────────────────────────────────────────

export const deleteEndorsement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const endorsementId = req.params["id"] as string;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("endorsements")
      .select("id, status")
      .eq("id", endorsementId)
      .eq("individual_profile_id", individualId)
      .maybeSingle();

    if (fetchErr || !existing) throw new AppError(404, "Endorsement not found");

    const { error } = await supabaseAdmin
      .from("endorsements")
      .delete()
      .eq("id", endorsementId)
      .eq("individual_profile_id", individualId);

    if (error) throw new AppError(500, "Failed to delete endorsement");
    res.status(200).json({ message: "Endorsement deleted successfully" });
  }
);

// ─── GET /vault/endorse/:token — public ──────────────────────────────────────

export const getEndorsementByToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;

    const { data, error } = await supabaseAdmin
      .from("endorsements")
      .select("id, dimension, endorser_name, status, expires_at, individual_profile_id")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) throw new AppError(404, "Endorsement not found");
    if (data.status === "EXPIRED" || new Date(data.expires_at) < new Date()) {
      throw new AppError(410, "This endorsement link has expired");
    }
    if (data.status === "SUBMITTED") {
      throw new AppError(409, "This endorsement has already been submitted");
    }

    // Fetch requester name
    const { data: ipRow } = await supabaseAdmin
      .from("individual_profiles")
      .select("profile_id")
      .eq("id", data.individual_profile_id)
      .maybeSingle();

    const { data: profileRow } = ipRow
      ? await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", ipRow.profile_id)
          .maybeSingle()
      : { data: null };

    res.status(200).json({
      data: {
        id: data.id,
        dimension: data.dimension,
        endorser_name: data.endorser_name,
        requester_name: profileRow?.full_name ?? "An Aptely user",
        expires_at: data.expires_at,
      },
    });
  }
);

// ─── POST /vault/endorse/:token — public ─────────────────────────────────────

export const submitEndorsement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;
    const body = req.body as SubmitEndorsementInput;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("endorsements")
      .select("id, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr || !existing) throw new AppError(404, "Endorsement not found");
    if (existing.status === "SUBMITTED") throw new AppError(409, "Already submitted");
    if (new Date(existing.expires_at) < new Date()) throw new AppError(410, "Link expired");

    const { data, error } = await supabaseAdmin
      .from("endorsements")
      .update({
        endorser_name: body.endorser_name ?? null,
        rating: body.rating,
        comment: body.comment ?? null,
        status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, dimension, rating, comment")
      .single();

    if (error || !data) throw new AppError(500, "Failed to submit endorsement");
    res.status(200).json({ data });
  }
);

// ─── GET /vault/me/references ─────────────────────────────────────────────────

export const listReferences = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const { data, error } = await supabaseAdmin
      .from("vault_references")
      .select("id, name, email, company, relationship, notes, created_at")
      .eq("individual_profile_id", individualId)
      .order("created_at", { ascending: false });
    if (error) throw new AppError(500, "Failed to fetch references");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── POST /vault/me/references ────────────────────────────────────────────────

export const addReference = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const body = req.body as {
      name: string;
      email?: string;
      company?: string;
      relationship?: string;
      notes?: string;
    };
    if (!body.name?.trim()) throw new AppError(400, "Name is required");
    const { data, error } = await supabaseAdmin
      .from("vault_references")
      .insert({
        individual_profile_id: individualId,
        name: body.name,
        email: body.email ?? null,
        company: body.company ?? null,
        relationship: body.relationship ?? null,
        notes: body.notes ?? null,
      })
      .select("id, name, email, company, relationship, notes, created_at")
      .single();
    if (error || !data) throw new AppError(500, "Failed to add reference");
    res.status(201).json({ data });
  }
);

// ─── DELETE /vault/me/references/:id ─────────────────────────────────────────

export const deleteReference = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const individualId = await getIndividualProfileId(req.user!.id);
    const { error } = await supabaseAdmin
      .from("vault_references")
      .delete()
      .eq("id", req.params["id"] as string)
      .eq("individual_profile_id", individualId);
    if (error) throw new AppError(500, "Failed to delete reference");
    res.status(204).send();
  }
);
