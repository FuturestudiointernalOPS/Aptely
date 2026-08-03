import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/helpers";
import { AppError } from "@/middleware/error.middleware";
import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";
import { uploadFile, STORAGE_BUCKETS, buildStoragePath } from "@/services/storage.service";
import { UpsertIndividualProfileInput } from "./individuals.schema";

// profile_export_tokens.expires_at is NOT NULL — use a far-future date to mean "never expires"
const NO_EXPIRY_DATE = new Date("2099-12-31T00:00:00.000Z").toISOString();

async function getIndividualProfileId(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("individual_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw new AppError(500, "Failed to access individual profile");
  if (data) return data.id;
  // Auto-create on first access
  const { data: created, error: createErr } = await supabaseAdmin
    .from("individual_profiles")
    .insert({ profile_id: userId })
    .select("id")
    .single();
  if (createErr || !created) throw new AppError(500, "Failed to initialize individual profile");
  return created.id;
}

// ─── GET /individuals/me ──────────────────────────────────────────────────────

export const getMyIndividualProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const profileId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from("individual_profiles")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) throw new AppError(500, "Failed to fetch individual profile");

    // Surface the CV the candidate already uploaded via a public application
    // (stored in talent_dna identity links) so forms can prefill instead of
    // asking for the same file again.
    const { data: dna } = await supabaseAdmin
      .from("talent_dna")
      .select("talent_identity")
      .eq("candidate_id", profileId)
      .maybeSingle();
    const identity = (dna?.talent_identity ?? {}) as { links?: { cv?: string; cv_path?: string } };
    // Generate a fresh signed URL from stored path (stored URL expires after 1h)
    let cvUrl: string | null = null;
    if (identity.links?.cv_path) {
      try {
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(STORAGE_BUCKETS.DOCUMENTS)
          .createSignedUrl(identity.links.cv_path, 7 * 24 * 60 * 60); // 7 days
        if (signErr) {
          console.warn("[getMyProfile] sign error:", signErr.message);
        }
        cvUrl = signed?.signedUrl || identity.links.cv || null;
      } catch (err: any) {
        console.warn("[getMyProfile] sign exception:", err?.message);
        cvUrl = identity.links?.cv ?? null;
      }
    } else {
      cvUrl = identity.links?.cv ?? null;
    }

    res.status(200).json({ data: data ? { ...data, cv_url: cvUrl } : (cvUrl ? { cv_url: cvUrl } : null) });
  }
);

// ─── PUT /individuals/me — Upsert ─────────────────────────────────────────────

// ─── POST /individuals/me/upload-cv ───────────────────────────────────────────

export const uploadCv = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const candidateId = req.user!.id;
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new AppError(400, "No file provided");

    const allowedMimes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new AppError(415, "Only PDF and Word documents are allowed");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new AppError(413, "File exceeds 10 MB limit");
    }

    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, "_");
    const path = buildStoragePath(candidateId, `cv-${Date.now()}-${cleanName}`);
    const uploadResult = await uploadFile(STORAGE_BUCKETS.DOCUMENTS, path, file.buffer, file.mimetype);

    // Store CV path in talent_dna (we'll generate fresh signed URLs on read)
    console.log("[uploadCv] candidateId:", candidateId, "path:", uploadResult.path);
    const { data: existing } = await supabaseAdmin
      .from("talent_dna")
      .select("talent_identity")
      .eq("candidate_id", candidateId)
      .maybeSingle();

    const currentIdentity = (existing?.talent_identity ?? {}) as { links?: { cv?: string; cv_path?: string } };
    const updatedIdentity = {
      ...currentIdentity,
      links: { ...(currentIdentity.links || {}), cv: uploadResult.url, cv_path: uploadResult.path },
    };

    await supabaseAdmin
      .from("talent_dna")
      .upsert({ candidate_id: candidateId, talent_identity: updatedIdentity }, { onConflict: "candidate_id" });

    res.status(200).json({ data: { cv_url: uploadResult.url } });
  }
);

// ─── DELETE /individuals/me/cv ───────────────────────────────────────────────

export const deleteCv = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const candidateId = req.user!.id;

    const { data: existing } = await supabaseAdmin
      .from("talent_dna")
      .select("talent_identity")
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (existing) {
      const currentIdentity = (existing.talent_identity ?? {}) as { links?: { cv?: string; cv_path?: string } };
      const updatedIdentity = {
        ...currentIdentity,
        links: { ...(currentIdentity.links || {}), cv: null, cv_path: null },
      };
      await supabaseAdmin
        .from("talent_dna")
        .upsert({ candidate_id: candidateId, talent_identity: updatedIdentity }, { onConflict: "candidate_id" });
    }

    res.status(200).json({ data: { ok: true } });
  }
);

export const upsertMyIndividualProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const profileId = req.user!.id;
    const body = req.body as UpsertIndividualProfileInput;

    const payload: Record<string, unknown> = { profile_id: profileId };
    if (body.headline !== undefined) payload["headline"] = body.headline;
    if (body.bio !== undefined) payload["bio"] = body.bio;
    if (body.location !== undefined) payload["location"] = body.location;
    if (body.website_url !== undefined) payload["website_url"] = body.website_url || null;
    if (body.linkedin_url !== undefined) payload["linkedin_url"] = body.linkedin_url || null;
    if (body.github_url !== undefined) payload["github_url"] = body.github_url || null;
    if (body.availability !== undefined) payload["availability"] = body.availability;
    if (body.skills !== undefined) payload["skills"] = body.skills;
    if (body.experience !== undefined) payload["experience"] = body.experience;
    if (body.education !== undefined) payload["education"] = body.education;
    if (body.certifications !== undefined) payload["certifications"] = body.certifications;
    if (body.languages !== undefined) payload["languages"] = body.languages;

    const { data, error } = await supabaseAdmin
      .from("individual_profiles")
      .upsert(payload, { onConflict: "profile_id" })
      .select("*")
      .single();

    if (error || !data) throw new AppError(500, "Failed to save individual profile");

    res.status(200).json({ data });
  }
);

// ─── GET /individuals/me/applications ─────────────────────────────────────────

export const getMyApplications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const profileId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from("applications")
      .select(`
        id,
        status,
        created_at,
        updated_at,
        match_score,
        rejection_feedback_json,
        roles (
          id,
          role_dna (full_form_json),
          institutions (name, logo_url)
        ),
        interviews ( id, status, scheduled_at )
      `)
      .eq("candidate_id", profileId)
      .order("updated_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch applications");

    const applications = (data ?? []).map((app) => {
      const rolesAssoc = app.roles as unknown as {
        id: string;
        role_dna?: Array<{ full_form_json?: Record<string, unknown> }> | { full_form_json?: Record<string, unknown> };
        institutions?: { name: string; logo_url?: string };
      } | null;
      const dna = Array.isArray(rolesAssoc?.role_dna) ? rolesAssoc?.role_dna[0] : rolesAssoc?.role_dna;
      const roleTitle = (dna?.full_form_json?.["title"] as string | undefined) ?? "Untitled Role";

      const interviewAssoc = app.interviews as unknown as Array<{ id: string; status: string; scheduled_at?: string | null }> | { id: string; status: string; scheduled_at?: string | null } | null;
      const interview = Array.isArray(interviewAssoc) ? interviewAssoc[0] ?? null : interviewAssoc;

      return {
        id: app.id,
        status: app.status,
        created_at: app.created_at,
        updated_at: app.updated_at,
        matching_score: app.match_score,
        rejection_feedback: (app as any).rejection_feedback_json ?? null,
        interview_id: interview?.id ?? null,
        interview_status: interview?.status ?? null,
        interview_scheduled_at: interview?.scheduled_at ?? null,
        role: {
          id: rolesAssoc?.id ?? null,
          title: roleTitle,
          institution_name: rolesAssoc?.institutions?.name ?? null,
          institution_logo: rolesAssoc?.institutions?.logo_url ?? null,
        },
      };
    });

    res.status(200).json({ data: applications });
  }
);

// ─── GET /individuals/me/applications/:appId/interview ───────────────────────

export const getMyApplicationInterview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const profileId = req.user!.id;
    const appId = req.params["appId"] as string;

    // Verify application belongs to this candidate
    const { data: app, error: appErr } = await supabaseAdmin
      .from("applications")
      .select("id")
      .eq("id", appId)
      .eq("candidate_id", profileId)
      .maybeSingle();

    if (appErr || !app) throw new AppError(404, "Application not found");

    const { data, error } = await supabaseAdmin
      .from("interviews")
      .select(`
        id,
        status,
        scheduled_at,
        duration_minutes,
        timezone,
        meeting_provider,
        meeting_link,
        interviewers ( user_id, role, profiles ( full_name ) )
      `)
      .eq("application_id", appId)
      .maybeSingle();

    if (error) throw new AppError(500, "Failed to fetch interview");
    if (!data) { res.status(200).json({ data: null }); return; }

    const ivs = (data.interviewers as unknown as Array<{ user_id: string; role: string; profiles?: { full_name: string } | null }>) ?? [];

    res.status(200).json({
      data: {
        id: data.id,
        status: data.status,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        timezone: data.timezone,
        meeting_provider: data.meeting_provider,
        meeting_link: data.meeting_link,
        interviewers: ivs.map((iv) => ({
          name: iv.profiles?.full_name ?? "Interviewer",
          role: iv.role,
        })),
      },
    });
  }
);

// ─── GET /individuals/me/offers ───────────────────────────────────────────────

export const getMyOffers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const profileId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select(`
        id, status, current_version, created_at, updated_at,
        applications!inner (
          id, candidate_id,
          roles ( role_dna ( full_form_json ), institutions ( name ) )
        ),
        offer_versions ( version_no, payload_json, created_at )
      `)
      .eq("applications.candidate_id", profileId)
      .in("status", ["SENT", "ACCEPTED", "REJECTED"])
      .order("updated_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch offers");

    const offers = (data ?? []).map((o) => {
      const appAssoc = o.applications as unknown as {
        id: string;
        candidate_id: string;
        roles?: { role_dna?: Array<{ full_form_json?: Record<string, unknown> }> | { full_form_json?: Record<string, unknown> }; institutions?: { name: string } } | Array<{ role_dna?: Array<{ full_form_json?: Record<string, unknown> }> | { full_form_json?: Record<string, unknown> }; institutions?: { name: string } }>;
      } | null;
      const rolesAssoc = Array.isArray(appAssoc?.roles) ? appAssoc?.roles[0] : appAssoc?.roles;
      const dna = Array.isArray(rolesAssoc?.role_dna) ? rolesAssoc?.role_dna[0] : rolesAssoc?.role_dna;
      const roleTitle = (dna?.full_form_json?.["title"] as string | undefined) ?? "Untitled Role";
      const versions = (o.offer_versions as unknown as Array<{ version_no: number; payload_json: Record<string, unknown>; created_at: string }>) ?? [];
      const latest = versions.sort((a, b) => b.version_no - a.version_no)[0] ?? null;

      return {
        id: o.id,
        status: o.status,
        application_id: appAssoc?.id ?? null,
        role_title: roleTitle,
        institution_name: rolesAssoc?.institutions?.name ?? null,
        payload: latest?.payload_json ?? {},
        created_at: o.created_at,
        updated_at: o.updated_at,
      };
    });

    res.status(200).json({ data: offers });
  }
);

// ─── GET /individuals/me/offers/:offerId ──────────────────────────────────────

export const getMyOffer = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const profileId = req.user!.id;
    const offerId = req.params["offerId"] as string;

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select(`
        id, status, current_version, created_at, updated_at,
        applications!inner ( id, candidate_id, roles ( role_dna ( full_form_json ), institutions ( name ) ) ),
        offer_versions ( version_no, payload_json, change_reason, created_at ),
        offer_negotiations ( id, actor_type, proposed_payload_json, message, status, created_at )
      `)
      .eq("id", offerId)
      .eq("applications.candidate_id", profileId)
      .maybeSingle();

    if (error || !data) throw new AppError(404, "Offer not found");

    res.status(200).json({ data });
  }
);

// ─── POST /individuals/me/export — create shareable Capability Record token ───

export const createExportToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const individualId = await getIndividualProfileId(userId);

    // Upsert — one active token per individual, non-expiring
    const { data, error } = await supabaseAdmin
      .from("profile_export_tokens")
      .upsert(
        { individual_profile_id: individualId, expires_at: NO_EXPIRY_DATE },
        { onConflict: "individual_profile_id" }
      )
      .select("token, expires_at")
      .single();

    if (error || !data) throw new AppError(500, "Failed to create export token");

    const shareUrl = `${env.FRONTEND_URL}/public/profile/${data.token}`;
    res.status(200).json({ data: { token: data.token, share_url: shareUrl, expires_at: data.expires_at } });
  }
);

// ─── GET /public/profile/:token — public Capability Record ───────────────────

export const getPublicProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = req.params["token"] as string;

    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from("profile_export_tokens")
      .select("individual_profile_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) throw new AppError(404, "Profile link not found");

    const [profileRes, proofsRes, evidenceRes, endorsementsRes, individualRow] = await Promise.all([
      supabaseAdmin.from("individual_profiles").select("headline, bio, location, availability, skills, experience, education, certifications, languages, website_url, linkedin_url, github_url").eq("id", tokenRow.individual_profile_id).maybeSingle(),
      supabaseAdmin.from("skill_proofs").select("skill_name, proof_type, title, description, link_url, file_url, created_at").eq("individual_profile_id", tokenRow.individual_profile_id).order("created_at", { ascending: false }),
      supabaseAdmin.from("work_evidence").select("title, problem, tools, result, impact_score, created_at").eq("individual_profile_id", tokenRow.individual_profile_id).order("created_at", { ascending: false }),
      supabaseAdmin.from("endorsements").select("dimension, rating, comment, submitted_at").eq("individual_profile_id", tokenRow.individual_profile_id).eq("status", "SUBMITTED").order("submitted_at", { ascending: false }),
      // Need profile_id to look up talent_dna
      supabaseAdmin.from("individual_profiles").select("profile_id").eq("id", tokenRow.individual_profile_id).maybeSingle(),
    ]);

    // Fetch CV URL from talent_dna using profile_id (user ID), not individual_profile_id
    const userId = individualRow?.data?.profile_id;
    console.log("[getPublicProfile] individual_profile_id:", tokenRow.individual_profile_id, "profile_id:", userId);
    let cvUrl: string | null = null;
    if (userId) {
      const { data: dna } = await supabaseAdmin
        .from("talent_dna")
        .select("talent_identity")
        .eq("candidate_id", userId)
        .maybeSingle();
      const identity = (dna?.talent_identity ?? {}) as { links?: { cv?: string; cv_path?: string } };
      // Generate a fresh signed URL from stored path (stored URL expires after 1h)
      if (identity.links?.cv_path) {
        try {
          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from(STORAGE_BUCKETS.DOCUMENTS)
            .createSignedUrl(identity.links.cv_path, 7 * 24 * 60 * 60); // 7 days
          if (signErr) {
            console.warn("[getPublicProfile] sign error:", signErr.message);
          }
          cvUrl = signed?.signedUrl || identity.links.cv || null;
        } catch (err: any) {
          console.warn("[getPublicProfile] sign exception:", err?.message);
          cvUrl = identity.links?.cv ?? null;
        }
      } else {
        cvUrl = identity.links?.cv ?? null;
      }
    }

    res.status(200).json({
      data: {
        profile: profileRes.data ?? {},
        skill_proofs: proofsRes.data ?? [],
        work_evidence: evidenceRes.data ?? [],
        endorsements: endorsementsRes.data ?? [],
        cv_url: cvUrl,
      },
    });
  }
);

// ─── GET /individuals/:userId/profile — HR view of candidate profile ──────────

export const getCandidateProfileForHR = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const targetUserId = req.params["userId"] as string;

    // Also fetch base profile for name/email
    const [profileRes, baseRes] = await Promise.all([
      supabaseAdmin
        .from("individual_profiles")
        .select("*")
        .eq("profile_id", targetUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", targetUserId)
        .maybeSingle(),
    ]);

    if (profileRes.error) throw new AppError(500, "Failed to fetch candidate profile");

    res.status(200).json({
      data: {
        ...(profileRes.data ?? {}),
        fullName: baseRes.data?.full_name ?? null,
        email: baseRes.data?.email ?? null,
        avatarUrl: baseRes.data?.avatar_url ?? null,
      }
    });
  }
);
