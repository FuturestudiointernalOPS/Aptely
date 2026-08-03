import { Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/helpers";
import { AppError } from "@/middleware/error.middleware";
import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";
import type { SubmitReflectionInput } from "./prep.schema";

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

function extractRoleTitleFromDna(roleDna: Record<string, unknown>): string {
  const title = roleDna["title"];
  return (typeof title === "string" && title.length > 0) ? title : "Untitled Role";
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getIndividualProfileId(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("individual_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw new AppError(500, "Failed to access individual profile");
  if (data) return data.id;
  const { data: created, error: createErr } = await supabaseAdmin
    .from("individual_profiles")
    .insert({ profile_id: userId })
    .select("id")
    .single();
  if (createErr || !created) throw new AppError(500, "Failed to initialize individual profile");
  return created.id;
}

// ─── GET /prep/brief/:applicationId ──────────────────────────────────────────

export const getPrepBrief = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { applicationId } = req.params;

    const individualId = await getIndividualProfileId(userId);

    const { data, error } = await supabaseAdmin
      .from("prep_briefs")
      .select("*")
      .eq("individual_profile_id", individualId)
      .eq("application_id", applicationId)
      .maybeSingle();

    if (error) throw new AppError(500, "Failed to fetch prep brief");

    res.status(200).json({ data: data ?? null });
  }
);

// ─── POST /prep/brief/:applicationId ─────────────────────────────────────────

export const generatePrepBrief = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { applicationId } = req.params;

    const individualId = await getIndividualProfileId(userId);

    // ── Load application + role DNA + institution ──────────────────────────
    const { data: app, error: appError } = await supabaseAdmin
      .from("applications")
      .select(`
        id, status,
        roles (
          id,
          role_dna ( full_form_json ),
          institutions ( name )
        )
      `)
      .eq("id", applicationId)
      .eq("candidate_id", userId)
      .maybeSingle();

    if (appError || !app) throw new AppError(404, "Application not found");

    const rolesAssoc = app.roles as unknown as {
      id: string;
      role_dna?: Array<{ full_form_json?: Record<string, unknown> }> | { full_form_json?: Record<string, unknown> };
      institutions?: { name: string };
    } | null;

    const dna = Array.isArray(rolesAssoc?.role_dna) ? rolesAssoc?.role_dna[0] : rolesAssoc?.role_dna;
    const roleDna = dna?.full_form_json ?? {};
    const roleTitle = extractRoleTitleFromDna(roleDna as Record<string, unknown>);
    const institutionName = rolesAssoc?.institutions?.name ?? "Unknown Company";

    // ── Load individual profile + vault data ──────────────────────────────
    const [profileRes, proofsRes, evidenceRes] = await Promise.all([
      supabaseAdmin.from("individual_profiles").select("*").eq("id", individualId).maybeSingle(),
      supabaseAdmin.from("skill_proofs").select("skill_name, proof_type, title, description").eq("individual_profile_id", individualId).limit(20),
      supabaseAdmin.from("work_evidence").select("title, problem, tools, result, impact_score").eq("individual_profile_id", individualId).limit(10),
    ]);

    const profile = profileRes.data ?? {};
    const skillProofs = proofsRes.data ?? [];
    const workEvidence = evidenceRes.data ?? [];

    // ── Build Gemini prompt ────────────────────────────────────────────────
    const prompt = buildPrepPrompt({ roleTitle, institutionName, roleDna, profile, skillProofs, workEvidence });

    // ── Call Gemini ────────────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    let parsed: PrepBriefResult;
    try {
      const result = await model.generateContent(prompt);
      const text = stripGeminiMarkdown(result.response.text());
      parsed = JSON.parse(text) as PrepBriefResult;
    } catch {
      throw new AppError(502, "AI generation failed. Please try again.");
    }

    const { brief, questions } = sanitizePrepBriefResult(parsed);

    // ── Upsert into prep_briefs ────────────────────────────────────────────
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("prep_briefs")
      .upsert(
        { individual_profile_id: individualId, application_id: applicationId, role_title: roleTitle, institution_name: institutionName, brief, questions, generated_at: new Date().toISOString() },
        { onConflict: "individual_profile_id,application_id" }
      )
      .select("*")
      .single();

    if (saveErr || !saved) throw new AppError(500, "Failed to save prep brief");

    res.status(200).json({ data: saved });
  }
);

// ─── POST /prep/reflections/:interviewId ─────────────────────────────────────

export const submitReflection = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { interviewId } = req.params;
    const body = req.body as SubmitReflectionInput;

    const individualId = await getIndividualProfileId(userId);

    // Verify the interview belongs to this individual (via application → candidate_id)
    const { data: interview, error: intErr } = await supabaseAdmin
      .from("interviews")
      .select("id, applications!inner(candidate_id)")
      .eq("id", interviewId)
      .maybeSingle();

    if (intErr || !interview) throw new AppError(404, "Interview not found");

    const appAssoc = interview.applications as unknown as { candidate_id: string } | Array<{ candidate_id: string }>;
    const candidateId = Array.isArray(appAssoc) ? appAssoc[0]?.candidate_id : appAssoc?.candidate_id;
    if (candidateId !== userId) throw new AppError(403, "Access denied");

    const { data, error } = await supabaseAdmin
      .from("interview_reflections")
      .upsert(
        {
          interview_id: interviewId,
          individual_profile_id: individualId,
          overall_rating:      body.overall_rating,
          strengths_displayed: body.strengths_displayed ?? null,
          areas_to_improve:    body.areas_to_improve ?? null,
          key_takeaways:       body.key_takeaways ?? null,
          follow_up_actions:   body.follow_up_actions ?? null,
        },
        { onConflict: "interview_id,individual_profile_id" }
      )
      .select("*")
      .single();

    if (error || !data) throw new AppError(500, "Failed to save reflection");

    res.status(200).json({ data });
  }
);

// ─── GET /prep/reflections/:interviewId ──────────────────────────────────────

export const getReflection = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { interviewId } = req.params;

    const individualId = await getIndividualProfileId(userId);

    const { data, error } = await supabaseAdmin
      .from("interview_reflections")
      .select("*")
      .eq("interview_id", interviewId)
      .eq("individual_profile_id", individualId)
      .maybeSingle();

    if (error) throw new AppError(500, "Failed to fetch reflection");

    res.status(200).json({ data: data ?? null });
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrepBriefResult {
  overview?: unknown;
  strengths?: unknown;
  gaps?: unknown;
  action_items?: unknown;
  questions?: unknown;
}

export interface PrepBriefShape {
  overview: string;
  strengths: unknown[];
  gaps: unknown[];
  action_items: unknown[];
  questions: unknown[];
}

function sanitizePrepBriefResult(raw: PrepBriefResult): { brief: Omit<PrepBriefShape, "questions">; questions: unknown[] } {
  return {
    brief: {
      overview:     typeof raw.overview === "string" ? raw.overview : "",
      strengths:    Array.isArray(raw.strengths) ? raw.strengths.slice(0, 6) : [],
      gaps:         Array.isArray(raw.gaps) ? raw.gaps.slice(0, 5) : [],
      action_items: Array.isArray(raw.action_items) ? raw.action_items.slice(0, 6) : [],
    },
    questions: Array.isArray(raw.questions) ? raw.questions.slice(0, 12) : [],
  };
}

function stripGeminiMarkdown(text: string): string {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildPrepPrompt(ctx: {
  roleTitle: string;
  institutionName: string;
  roleDna: Record<string, unknown>;
  profile: Record<string, unknown>;
  skillProofs: unknown[];
  workEvidence: unknown[];
}): string {
  return `You are an expert career coach helping a candidate prepare for a job interview.

ROLE: ${ctx.roleTitle} at ${ctx.institutionName}

ROLE DNA (what the company is looking for):
${JSON.stringify(ctx.roleDna, null, 2).substring(0, 6000)}

CANDIDATE PROFILE:
${JSON.stringify({ headline: ctx.profile.headline, bio: ctx.profile.bio, skills: ctx.profile.skills, experience: ctx.profile.experience, education: ctx.profile.education, certifications: ctx.profile.certifications, languages: ctx.profile.languages }, null, 2).substring(0, 4000)}

CANDIDATE SKILL PROOFS (verified evidence):
${JSON.stringify(ctx.skillProofs, null, 2).substring(0, 2000)}

CANDIDATE WORK EVIDENCE:
${JSON.stringify(ctx.workEvidence, null, 2).substring(0, 2000)}

Generate a personalized interview preparation guide. Return ONLY valid JSON with this exact schema:
{
  "overview": "2-3 sentence summary of the role and key success factors",
  "strengths": ["3-5 specific strengths the candidate has for THIS role"],
  "gaps": ["2-4 areas the candidate should prepare or study before the interview"],
  "action_items": ["3-5 concrete preparation steps the candidate should take"],
  "questions": [
    {
      "question": "Likely interview question text",
      "category": "technical|behavioral|situational|culture",
      "guidance": "How to approach this question and what to emphasize based on the candidate profile"
    }
  ]
}

Generate 8-10 questions. Focus on the most critical skills and responsibilities from the role DNA. Make guidance specific to this candidate's actual background.`;
}
