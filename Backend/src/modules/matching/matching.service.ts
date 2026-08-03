import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";
import mammoth from "mammoth";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchAndParseDocument(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return "";

    // Strip query params for extension check (handles Supabase signed URLs)
    const urlPath = url.split("?")[0].toLowerCase();
    const contentType = res.headers.get("content-type") ?? "";

    // If it's a PDF
    if (urlPath.endsWith(".pdf") || contentType.includes("pdf")) {
      try {
        // pdf-parse@2.x exports a PDFParse class (not a bare function)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PDFParse } = require("pdf-parse") as {
          PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
        };
        const buffer = await res.arrayBuffer();
        const parser = new PDFParse({ data: Buffer.from(buffer) });
        const result = await parser.getText();
        return result.text || "";
      } catch (pdfErr) {
        console.error("[MATCHING] Failed to parse PDF:", pdfErr);
        return "";
      }
    }
    // If it's a Word document
    if (urlPath.endsWith(".docx") || contentType.includes("officedocument.wordprocessingml.document")) {
      const buffer = await res.arrayBuffer();
      const data = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      return data.value || "";
    }

    return await res.text();
  } catch (err) {
    console.error("[MATCHING] Failed to parse document from URL:", url, err);
    return "";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TalentSkillEntry {
  skill?: string;
  level?: number; // 1-5
  proofLink?: string;
}

interface TalentExperienceEntry {
  title?: string;
  company?: string;
  duration?: number; // months
  description?: string;
}

interface TalentEvidenceEntry {
  type?: string;
  description?: string;
  proofLink?: string;
}

interface TalentDNA {
  talent_identity?: Record<string, unknown>;
  talent_snapshot?: Record<string, unknown>;
  talent_experience?: TalentExperienceEntry[];
  talent_skills?: TalentSkillEntry[];
  talent_evidence?: TalentEvidenceEntry[];
  talent_scenario?: Record<string, unknown>;
  talent_style?: Record<string, unknown>;
  talent_motivation?: Record<string, unknown>;
}

interface RoleDNA {
  mission_90_days?: string;
  success_6_months?: string;
  key_problems?: unknown[];
  constraints?: Record<string, unknown>;
  team_context?: Record<string, unknown>;
  candidate_profile?: {
    mustHave?: string[];
    niceToHave?: string[];
    languages?: string[];
    seniority?: string;
    salary_range?: { min?: number; max?: number };
    location_preference?: string;
    contract_types?: string[];
  };
  dealbreakers?: string[];
  evaluation_context?: string;
}

function mapFullFormToRoleDna(fullForm?: Record<string, unknown>): RoleDNA {
  if (!fullForm) return {};

  // Find skills (from skills array or constraints.techStack or generic arrays)
  let mustHave: string[] = [];
  let niceToHave: string[] = [];

  if (Array.isArray(fullForm.skills)) {
    mustHave = fullForm.skills
      .filter((skill: any) => skill?.importance === "Core" || skill?.importance === "Important")
      .map((skill: any) => skill?.name)
      .filter(Boolean) as string[];
    niceToHave = fullForm.skills
      .filter((skill: any) => skill?.importance === "Nice")
      .map((skill: any) => skill?.name)
      .filter(Boolean) as string[];
  } else if (fullForm.constraints && typeof fullForm.constraints === 'object') {
     const c = fullForm.constraints as Record<string, unknown>;
     if (Array.isArray(c.techStack)) mustHave = c.techStack as string[];
     if (Array.isArray(c.niceToHave)) niceToHave = c.niceToHave as string[];
  }

  // Find Salary
  const salaryMin = Number(fullForm.salaryMin || (fullForm.constraints as any)?.salaryMin?.replace(/[^0-9]/g, '')) || undefined;
  const salaryMax = Number(fullForm.salaryMax || (fullForm.constraints as any)?.salaryMax?.replace(/[^0-9]/g, '')) || undefined;

  // Find Mission
  const missionStr = (fullForm.mission90Day || fullForm.mission || fullForm.description) as string | undefined;

  // Contracts
  let contracts: string[] = [];
  if (Array.isArray(fullForm.contracts)) contracts = fullForm.contracts as string[];
  else if (fullForm.type) contracts = [String(fullForm.type)];

  return {
    mission_90_days: typeof missionStr === "string" ? missionStr : undefined,
    success_6_months: typeof fullForm.success6Month === "string" ? fullForm.success6Month : undefined,
    key_problems: Array.isArray(fullForm.problems) ? (fullForm.problems as unknown[]) : undefined,
    constraints: {
      location: `${typeof fullForm.country === "string" ? fullForm.country : (fullForm.location || "")}${(typeof fullForm.city === "string" && fullForm.city) ? ` - ${fullForm.city}` : ""}`,
      teamSize: typeof fullForm.teamSize === "string" ? Number(fullForm.teamSize) : fullForm.teamSize,
      reportingTo: fullForm.reportingTo,
      contractTypes: contracts,
    },
    team_context: {
      dynamics: fullForm.dynamics,
      challenges: typeof fullForm.challenges === "string" && fullForm.challenges
        ? [fullForm.challenges]
        : [],
    },
    candidate_profile: {
      mustHave,
      niceToHave,
      salary_range: {
        min: salaryMin,
        max: salaryMax,
      },
      location_preference: typeof fullForm.country === "string" ? fullForm.country : (typeof fullForm.location === "string" ? fullForm.location : undefined),
      contract_types: contracts,
    },
    dealbreakers: Array.isArray(fullForm.dealbreakers) ? fullForm.dealbreakers : (typeof fullForm.dealbreakers === "string" && fullForm.dealbreakers ? [fullForm.dealbreakers] : []),
    evaluation_context:
      typeof fullForm.evaluationContext === "string" ? fullForm.evaluationContext : undefined,
  };
}

interface GeminiMatchResult {
  roleFit: number;
  skillValidity: number;
  capabilityStrength: number;
  environmentFit: number;
  motivationFit: number;
  constraintFit: number;
  reliabilityIndex: number;
  finalScore: number;
  keySelectionFactors: string[];
  aiExplanation: {
    strengths: string[];
    gaps: string[];
    recommendation: string;
  };
  aiConfidence: number;
}

export interface MatchResult {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  scores: {
    roleFit: number;
    skillValidity: number;
    capabilityStrength: number;
    environmentFit: number;
    motivationFit: number;
    constraintFit: number;
    reliabilityIndex: number;
    finalScore: number; // 0-100
  };
  aiExplanation: GeminiMatchResult["aiExplanation"];
  aiConfidence: number;
  rank: number;
}

// ─── Algorithmic scoring helpers ──────────────────────────────────────────────

// Algorithmic helpers removed, purely AI matching now.

// ─── AI scoring ───────────────────────────────────────────────────────────────

function buildScoringPrompt(
  talentDNA: TalentDNA,
  roleDNA: RoleDNA,
  roleTitle: string,
  documentsText: string,
  answers: any,
  evaluationContext: string,
  rawFullForm: Record<string, unknown> | undefined,
  locale: "fr" | "en" = "fr"
): string {
  return `You are an expert, highly critical AI Head of Talent Acquisition. Your task is to ruthlessly and precisely evaluate how well a candidate matches a job role based firstly on his cv/resume, then on the provided data.
DO NOT hallucinate. DO NOT give the candidate the benefit of the doubt if evidence is missing.
Be extremely serious and analytical. We are looking for top-tier matches. If something is already known in the resume, rely on it rather than the provided data if the information is not given by the candidate.

${evaluationContext ? `HR CUSTOM EVALUATION CONTEXT & INSTRUCTIONS:\n${evaluationContext}\n\n` : ""}ROLE: "${roleTitle}"
ROLE DNA (Algorithmic Mapping):
${JSON.stringify(roleDNA, null, 2)}

ROLE FULL SCHEMA (Raw JSON Definition from HR):
${JSON.stringify(rawFullForm || {}, null, 2)}

TALENT DNA (Structured info):
${JSON.stringify(talentDNA, null, 2)}
${answers ? `\nCANDIDATE CUSTOM FORM ANSWERS:\n${JSON.stringify(answers, null, 2)}` : ""}

${documentsText ? `CANDIDATE DOCUMENTS (Unstructured text from CV, cover letter, certificates, and all uploaded proofs):\n${documentsText.substring(0, 18000)}` : ""}

Return a JSON object with EXACTLY this structure (all scores between 0.000 and 1.000):
{
  "roleFit": 0.85,
  "skillValidity": 0.90,
  "capabilityStrength": 0.80,
  "environmentFit": 0.75,
  "motivationFit": 0.80,
  "constraintFit": 0.90,
  "reliabilityIndex": 0.70,
  "finalScore": 0.82,
  "keySelectionFactors": ["factor1", "factor2", "factor3"],
  "aiExplanation": {
    "strengths": ["strength1", "strength2", "strength3"],
    "gaps": ["gap1", "gap2", "gap3"],
    "recommendation": "A highly critical, one-sentence definitive recommendation."
  },
  "aiConfidence": 0.90
}

${locale === "en" ? 'OUTPUT LANGUAGE: write "keySelectionFactors" and every "aiExplanation" field (strengths, gaps, recommendation) in ENGLISH.' : 'LANGUE DE SORTIE : rédige "keySelectionFactors" et chaque champ de "aiExplanation" (strengths, gaps, recommendation) en FRANÇAIS.'}

Scoring rules (Strictly adhere to these):
- roleFit: Evaluate explicit years of experience, proven past achievements matching the 90-day/6-month goals, and hard skill overlaps. Penalize heavily if key_problems have not been solved by this candidate in the past.
- skillValidity: Do the candidate's core skills directly align with the role's required skill mapping?
- capabilityStrength: Does the level/depth of the candidate's skills meet expectations?
- environmentFit: Compare candidate's work_style (Chaos vs Structure, Speed vs Quality, etc.) against the role's team_context and constraints. A mismatch in work pace or autonomy vs guidance should aggressively lower this score.
- motivationFit: Compare candidate's excitement triggers and growth goals strictly to the reality of the role. If the role does not offer what the candidate wants, score low.
- constraintFit: Does their salary expectation, contract type, and location realistically fit the constraints?
- reliabilityIndex: How verified are their claims? (e.g., links to github, verified certificates, uploaded documents).
- finalScore: Calculate a holistic 0.0 to 1.0 final score heavily weighting roleFit and skillValidity.
- aiConfidence: Reflects the completeness and quality of the provided data. If "CANDIDATE DOCUMENTS" is empty or "TALENT DNA" is sparse, lower this score to reflect uncertainty.`;
}

function clampMatchResult(parsed: any): GeminiMatchResult {
  return {
    roleFit: Math.max(0, Math.min(1, parsed.roleFit ?? 0.5)),
    skillValidity: Math.max(0, Math.min(1, parsed.skillValidity ?? 0.5)),
    capabilityStrength: Math.max(0, Math.min(1, parsed.capabilityStrength ?? 0.5)),
    environmentFit: Math.max(0, Math.min(1, parsed.environmentFit ?? 0.5)),
    motivationFit: Math.max(0, Math.min(1, parsed.motivationFit ?? 0.5)),
    constraintFit: Math.max(0, Math.min(1, parsed.constraintFit ?? 0.5)),
    reliabilityIndex: Math.max(0, Math.min(1, parsed.reliabilityIndex ?? 0.5)),
    finalScore: Math.max(0, Math.min(1, parsed.finalScore ?? 0.5)),
    keySelectionFactors: parsed.keySelectionFactors ?? [],
    aiExplanation: parsed.aiExplanation ?? {
      strengths: [],
      gaps: [],
      recommendation: "Unable to generate detailed explanation.",
    },
    aiConfidence: Math.max(0, Math.min(1, parsed.aiConfidence ?? 0.5)),
  };
}

async function callGeminiScoring(prompt: string): Promise<GeminiMatchResult> {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });

  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanText);
      return clampMatchResult(parsed);
    } catch (err) {
      retries++;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
      if (retries >= maxRetries) {
        throw new Error(`Gemini API failed after ${maxRetries} retries: ${errorMsg.substring(0, 150)}`);
      }
      // Rate limits need longer backoff; general errors use shorter exponential backoff
      const baseDelay = isRateLimit ? 3000 : 500;
      const waitTime = Math.pow(2, retries) * baseDelay;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Gemini scoring failed");
}

async function callAIScoring(
  talentDNA: TalentDNA,
  roleDNA: RoleDNA,
  roleTitle: string,
  documentsText: string = "",
  answers: any = null,
  evaluationContext: string = "",
  rawFullForm: Record<string, unknown> | undefined = undefined,
  locale: "fr" | "en" = "fr"
): Promise<GeminiMatchResult> {
  const prompt = buildScoringPrompt(
    talentDNA, roleDNA, roleTitle, documentsText, answers, evaluationContext, rawFullForm, locale
  );

  return await callGeminiScoring(prompt);
}

// ─── Main matching engine ────────────────────────────────────────────────────

// In-process lock: prevents concurrent runs for the same role causing DB constraint violations
const activeMatchingJobs = new Set<string>();

export async function runMatching(roleId: string, maxResults = 10, locale: "fr" | "en" = "fr"): Promise<MatchResult[]> {
  if (activeMatchingJobs.has(roleId)) {
    console.warn(`[MATCHING] Run already in progress for role ${roleId}, skipping duplicate`);
    return [];
  }
  activeMatchingJobs.add(roleId);
  try {
    return await _runMatching(roleId, maxResults, locale);
  } finally {
    activeMatchingJobs.delete(roleId);
  }
}

async function _runMatching(roleId: string, maxResults = 10, locale: "fr" | "en" = "fr"): Promise<MatchResult[]> {
  // ── Step 1: Load role + role_dna ──────────────────────────────────────────
  const { data: role, error: roleError } = await supabaseAdmin
    .from("roles")
    .select(
      `
      id, institution_id,
      role_dna (
        full_form_json
      )
    `
    )
    .eq("id", roleId)
    .single();

  if (roleError || !role) {
    throw new Error(`Role not found: ${roleId}`);
  }

  const roleDnaRow = (Array.isArray(role.role_dna) ? role.role_dna[0] : role.role_dna) as
    | { full_form_json?: Record<string, unknown> }
    | null;
  const fullForm = roleDnaRow?.full_form_json;
  const roleTitle = (fullForm?.name_role as string | undefined) ?? (fullForm?.title as string | undefined) ?? "Untitled Role";
  const roleDNA = mapFullFormToRoleDna(fullForm);

  // ── Step 2: Get ANALYSING applications ─────────────────────────────────
  const { data: applications, error: appError } = await supabaseAdmin
    .from("applications")
    .select("id, candidate_id, dna_snapshot, answers")
    .eq("role_id", roleId)
    .eq("status", "ANALYSING");

  if (appError) throw new Error("Failed to fetch applications: " + JSON.stringify(appError));
  if (!applications || applications.length === 0) return [];

  // ── Step 3: Load profiles + talent_dna for each candidate ──────────────
  const candidateIds = applications.map((a) => a.candidate_id).filter(Boolean);

  let profileMap = new Map();
  if (candidateIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", candidateIds);
    if (!profilesError && profiles) {
      profileMap = new Map(profiles.map((p) => [p.id, p]));
    }
  }

  const talentDnaMap = new Map(
    applications.map((a) => [a.id, (a.dna_snapshot || {}) as unknown as TalentDNA])
  );

  // ── Steps 4-6: Score each candidate ───────────────────────────────────────

  // ── Steps 4-6: Score each candidate (PARALLEL — no N+1) ───────────────────

  const scoringPromises = applications.map(async (app) => {
    try {
      const profile = app.candidate_id ? profileMap.get(app.candidate_id) : null;
      const talentDNA = talentDnaMap.get(app.id) ?? ({} as TalentDNA);
      const identity = (talentDNA.talent_identity as Record<string, unknown> | undefined) ?? {};

      const candidateName =
        profile?.full_name ||
        (typeof identity.name === "string" ? identity.name : null) ||
        "Unknown Candidate";
      const candidateEmail =
        profile?.email ||
        (typeof identity.email === "string" ? identity.email : null) ||
        "Unknown Email";

      // Extract CV if available
      const links = (identity.links as Record<string, unknown> | undefined) ?? {};
      const cvUrl = typeof links.cv === "string" ? links.cv : "";
      const otherDocs = Array.isArray(links.other_documents) ? links.other_documents : [];
      let documentsText = "";

      if (cvUrl) {
         const text = await fetchAndParseDocument(cvUrl);
         if (text) documentsText += `[Document 1: CV from profile]\n${text}\n\n`;
      }
      if (Array.isArray(otherDocs)) {
         const docResults = await Promise.all(
           otherDocs.map((url: string) => fetchAndParseDocument(url))
         );
         docResults.forEach((text, i) => {
           if (text) documentsText += `[Document ${i + 2}: Profile Proof]\n${text}\n\n`;
         });
      }

      // Fetch documents uploaded at application time (CV, cover letter, certificates, etc.)
      const { data: appDocs } = await supabaseAdmin
        .from("application_documents")
        .select("storage_path, file_type, file_name")
        .eq("application_id", app.id);

      if (appDocs && appDocs.length > 0) {
        const appDocResults = await Promise.all(
          appDocs.map(async (doc) => {
            const { data: signed } = await supabaseAdmin.storage
              .from("application-documents")
              .createSignedUrl(doc.storage_path, 3600);
            if (!signed?.signedUrl) return { text: "", label: doc.file_type || "Document" };
            const text = await fetchAndParseDocument(signed.signedUrl);
            return { text, label: doc.file_type || doc.file_name || "Document" };
          })
        );
        appDocResults.forEach(({ text, label }) => {
          if (text) documentsText += `[Application Upload: ${label}]\n${text}\n\n`;
        });
      }

      // AI scores (Gemini primary, Mistral fallback)
      const gemini = await callAIScoring(
        talentDNA, roleDNA, roleTitle, documentsText,
        app.answers, roleDNA.evaluation_context as string,
        fullForm as Record<string, unknown> | undefined,
        locale
      );

      const allScores = {
        roleFit: gemini.roleFit,
        skillValidity: gemini.skillValidity,
        capabilityStrength: gemini.capabilityStrength,
        environmentFit: gemini.environmentFit,
        motivationFit: gemini.motivationFit,
        constraintFit: gemini.constraintFit,
        reliabilityIndex: gemini.reliabilityIndex,
      };

      // Update application status and match_score
      const { error: statusUpdateError } = await supabaseAdmin
        .from("applications")
        .update({ status: "FINISHED", match_score: gemini.finalScore })
        .eq("id", app.id);

      if (statusUpdateError) {
        console.error(`[matching] Failed to update status for ${app.id}:`, statusUpdateError.message);
      }

      return {
        applicationId: app.id,
        candidateId: app.candidate_id,
        candidateName,
        candidateEmail,
        scores: {
          ...allScores,
          finalScore: Math.round(gemini.finalScore * 100 * 100) / 100,
        },
        aiExplanation: gemini.aiExplanation,
        aiConfidence: gemini.aiConfidence,
        talentDnaSnapshot: talentDNA,
        keySelectionFactors: gemini.keySelectionFactors,
        rank: 0,
      };
    } catch (err) {
      console.error(`[matching] Failed to score application ${app.id}:`, err);

      const identity = ((app.dna_snapshot || {}) as any)?.talent_identity || {};
      const candidateName = profileMap.get(app.candidate_id)?.full_name || identity.name || "Unknown Candidate";
      const candidateEmail = profileMap.get(app.candidate_id)?.email || identity.email || "Unknown Email";

      const { error: fallbackUpdateError } = await supabaseAdmin
        .from("applications")
        .update({ status: "FINISHED", match_score: 0 })
        .eq("id", app.id);

      if (fallbackUpdateError) {
        console.error(`[matching] Failed to update status for ${app.id}:`, fallbackUpdateError.message);
      }

      return {
        applicationId: app.id,
        candidateId: app.candidate_id,
        candidateName,
        candidateEmail,
        scores: {
          roleFit: 0, skillValidity: 0, capabilityStrength: 0,
          environmentFit: 0, motivationFit: 0, constraintFit: 0,
          reliabilityIndex: 0, finalScore: 0,
        },
        aiExplanation: {
          strengths: [],
          gaps: ["Evaluation failed due to malformed data or timeout."],
          recommendation: "AI Matching failed. Please review the application manually.",
        },
        aiConfidence: 0,
        talentDnaSnapshot: app.dna_snapshot || {},
        keySelectionFactors: [],
        rank: 0,
      };
    }
  });

  // Batch concurrency: process BATCH_SIZE candidates in parallel.
  // Paid tier (10$ credits) → 1500 RPM → BATCH_SIZE=10, no delay needed.
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 500;
  const scoredCandidates: any[] = [];
  for (let i = 0; i < scoringPromises.length; i += BATCH_SIZE) {
    const batch = scoringPromises.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch);
    scoredCandidates.push(...results);
    if (i + BATCH_SIZE < scoringPromises.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }


  // ── Step 7: Sort by finalScore DESC, assign ranks ─────────────────────────
  scoredCandidates.sort((a, b) => b.scores.finalScore - a.scores.finalScore);

  const topCandidates = scoredCandidates;
  topCandidates.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  // ── Step 8: Upsert match_results + sorted_talents ────────────────────────
  // match_results: scores stored as NUMERIC(4,3) — values 0.000–1.000
  const matchResultsRows = topCandidates.map((c) => ({
    application_id: c.applicationId,
    candidate_id: c.candidateId,
    role_fit: c.scores.roleFit,
    skill_validity: c.scores.skillValidity,
    capability_strength: c.scores.capabilityStrength,
    environment_fit: c.scores.environmentFit,
    motivation_fit: c.scores.motivationFit,
    constraint_fit: c.scores.constraintFit,
    reliability_index: c.scores.reliabilityIndex,
    final_score: c.scores.finalScore / 100, // stored as 0-1
    ai_explanation: c.aiExplanation,
    ai_confidence: c.aiConfidence,
    talent_dna_snapshot: c.talentDnaSnapshot,
  }));

  // sorted_talents: score stored as NUMERIC(5,2) CHECK 0-100
  const sortedTalentsRows = topCandidates.map((c) => ({
    application_id: c.applicationId,
    candidate_id: c.candidateId,
    role_id: roleId, // ← required NOT NULL column
    rank: c.rank,
    score: c.scores.finalScore, // stored as 0-100
    approved: null,
  }));

  // Delete existing sorted_talents for this role before re-inserting to avoid
  // (role_id, rank) unique constraint violations on re-runs.
  const { error: deleteError } = await supabaseAdmin
    .from("sorted_talents")
    .delete()
    .eq("role_id", roleId);
  if (deleteError) {
    console.error("Failed to clear old sorted_talents:", deleteError);
  }

  const [matchInsert, sortedInsert] = await Promise.all([
    supabaseAdmin.from("match_results").upsert(matchResultsRows, {
      onConflict: "application_id",
      ignoreDuplicates: false,
    }),
    supabaseAdmin.from("sorted_talents").insert(sortedTalentsRows),
  ]);

  if (matchInsert.error) {
    console.error("Failed to upsert match_results:", matchInsert.error);
  }
  if (sortedInsert.error) {
    console.error("Failed to insert sorted_talents:", sortedInsert.error);
  }

  // ── W5: Auto-placement — invite eligible candidates to active waves ────────
  void autoPlaceCandidatesInWaves(roleId, topCandidates).catch((err) => {
    console.error("[WAVES] Auto-placement error:", err);
  });

  // Return results without internal fields
  return topCandidates.slice(0, maxResults).map((c) => ({
    applicationId: c.applicationId,
    candidateId: c.candidateId,
    candidateName: c.candidateName,
    candidateEmail: c.candidateEmail,
    scores: c.scores,
    aiExplanation: c.aiExplanation,
    aiConfidence: c.aiConfidence,
    rank: c.rank,
  }));
}

// ─── W5: Auto-placement ───────────────────────────────────────────────────────

async function autoPlaceCandidatesInWaves(
  roleId: string,
  candidates: Array<{ applicationId: string; scores: { finalScore: number } }>
): Promise<void> {
  const { data: waves } = await supabaseAdmin
    .from("recruitment_waves")
    .select("id, auto_place_threshold")
    .eq("role_id", roleId)
    .eq("auto_place_on_match", true)
    .eq("status", "ACTIVE");

  if (!waves || waves.length === 0) return;

  for (const wave of waves as Array<{ id: string; auto_place_threshold: number | null }>) {
    const threshold = wave.auto_place_threshold ?? 0;
    const eligible = candidates
      .filter((c) => c.scores.finalScore >= threshold)
      .map((c) => c.applicationId);

    if (eligible.length === 0) continue;

    // Skip already invited
    const { data: existing } = await supabaseAdmin
      .from("wave_candidates")
      .select("application_id")
      .eq("wave_id", wave.id)
      .in("application_id", eligible);

    const alreadyIn = new Set((existing ?? []).map((r: any) => r.application_id as string));
    const toInvite = eligible.filter((id) => !alreadyIn.has(id));

    if (toInvite.length === 0) continue;

    const rows = toInvite.map((applicationId) => ({
      wave_id: wave.id,
      application_id: applicationId,
      status: "INVITED",
      force_added: false,
      invite_token: `wv_${require("crypto").randomBytes(24).toString("hex")}`,
      invited_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin.from("wave_candidates").insert(rows);
    if (error) {
      console.error(`[WAVES] Auto-placement insert error for wave ${wave.id}:`, error);
    }
  }
}
