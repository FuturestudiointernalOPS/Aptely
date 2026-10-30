import { supabaseAdmin } from "@/config/supabase";
import { callGemini, callGeminiVision } from "@/services/gemini.service";
import pino from "pino";

const log = pino({ name: "cv-studio" });
import { STORAGE_BUCKETS } from "@/services/storage.service";
import {
  MODULE_KEYS,
  SCORED_MODULE_KEYS,
  MODULE_WEIGHTS,
  COUNTRY_CV_RULES,
  type ModuleKey,
} from "./cv-studio.rules";
import { AppError } from "@/middleware/error.middleware";
import {
  buildCvValidationPrompt,
  buildVisualPrompt,
  buildVisualTextFallbackPrompt,
  buildCoherencePrompt,
  buildLinguisticPrompt,
  buildImpactPrompt,
  buildCompletenessPrompt,
  buildJobFitPrompt,
  buildCountryPrompt,
  buildAtsPrompt,
  buildAtsVisionPrompt,
  buildCredibilityPrompt,
  buildCompetitivePrompt,
  buildAutoCorrectionPrompt,
} from "./cv-studio.prompts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnalysisOptions {
  locale: "fr" | "en";
  targetCountry?: string;
  targetJobTitle?: string;
  roleId?: string;
}

interface ModuleResult {
  score: number | null;
  data: Record<string, unknown>;
}

function safeScore(val: unknown, fallback = 50): number {
  return typeof val === "number" && !isNaN(val) ? val : fallback;
}



// ─── PDF Text Extraction ────────────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse") as {
      PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
    };
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || "";
  } catch (err) {
    log.error({ err }, "PDF parse error");
    return "";
  }
}

// ─── Document validation ────────────────────────────────────────────────────

/**
 * Returns false only when Gemini is confident the document is NOT a CV.
 * Fails open (returns true) on any classifier/network error so a transient
 * Gemini failure never blocks a legitimate CV upload.
 */
async function isLikelyCv(cvText: string, locale: string): Promise<boolean> {
  try {
    const data = await callGemini<{ is_cv?: boolean; confidence?: number }>(
      buildCvValidationPrompt(cvText, locale)
    );
    if (data.is_cv === false && (data.confidence ?? 100) >= 60) {
      return false;
    }
    return true;
  } catch (err) {
    log.warn({ err }, "CV validation classifier failed — allowing upload");
    return true;
  }
}

// ─── PDF to Image ───────────────────────────────────────────────────────────

async function renderPdfPage1(buffer: Buffer): Promise<Buffer | null> {
  let document: Awaited<ReturnType<(typeof import("pdf-to-img"))["pdf"]>> | null = null;
  try {
    const { pdf } = await import("pdf-to-img");
    // scale 1 keeps the preview readable without a multi-megapixel canvas.
    document = await pdf(buffer, { scale: 1 });
    for await (const image of document) {
      return Buffer.from(image);
    }
    log.warn("PDF has no renderable pages, falling back to text analysis");
    return null;
  } catch (err) {
    log.error({ err }, "PDF to image error");
    return null;
  } finally {
    await document?.destroy().catch(() => undefined);
  }
}

// ─── LanguageTool (free API) ────────────────────────────────────────────────

interface LTMatch {
  message: string;
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  rule: { id: string; category: { id: string; name: string } };
  context: { text: string; offset: number; length: number };
}

async function checkLanguageTool(
  text: string,
  language: string
): Promise<LTMatch[]> {
  try {
    const ltLang = language === "fr" ? "fr" : "en-US";
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text: text.substring(0, 10000),
        language: ltLang,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      log.error({ status: res.status }, "LanguageTool API non-200");
      return [];
    }
    const data = (await res.json()) as { matches?: LTMatch[] };
    return data.matches ?? [];
  } catch (err) {
    log.error({ err }, "LanguageTool API failed");
    return [];
  }
}

// ─── Module Update Helpers ──────────────────────────────────────────────────

async function updateModuleStatus(
  analysisId: string,
  moduleKey: string,
  status: string,
  score?: number,
  resultJson?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status };
  if (status === "processing") update.started_at = now;
  if (status === "completed" || status === "failed") update.completed_at = now;
  if (score !== undefined) update.score = Math.max(0, Math.min(100, Math.round(score)));
  if (resultJson) update.result_json = resultJson;
  if (errorMessage) update.error_message = errorMessage;

  const { error } = await supabaseAdmin
    .from("cv_analysis_modules")
    .update(update)
    .eq("analysis_id", analysisId)
    .eq("module_key", moduleKey);
  if (error) log.error({ moduleKey, err: error.message }, "updateModuleStatus failed");
}

// ─── Individual Module Runners ──────────────────────────────────────────────

async function runModule(
  analysisId: string,
  moduleKey: ModuleKey,
  fn: () => Promise<ModuleResult>
): Promise<ModuleResult | null> {
  await updateModuleStatus(analysisId, moduleKey, "processing");
  try {
    const result = await fn();
    await updateModuleStatus(analysisId, moduleKey, "completed", result.score ?? undefined, result.data);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ moduleKey, err }, "Module failed");
    await updateModuleStatus(analysisId, moduleKey, "failed", undefined, undefined, msg.substring(0, 500));
    return null;
  }
}

// M1: Visual
async function analyzeVisual(
  analysisId: string,
  imageBuffer: Buffer | null,
  cvText: string,
  locale: string
): Promise<ModuleResult | null> {
  return runModule(analysisId, "visual", async () => {
    let data: Record<string, unknown>;
    if (imageBuffer) {
      data = await callGeminiVision(buildVisualPrompt(locale), imageBuffer) as Record<string, unknown>;
    } else {
      data = await callGemini(buildVisualTextFallbackPrompt(cvText, locale)) as Record<string, unknown>;
    }
    return { score: safeScore(data.visual_score), data };
  });
}

// M2: Coherence
async function analyzeCoherence(
  analysisId: string,
  cvText: string,
  locale: string
): Promise<ModuleResult | null> {
  return runModule(analysisId, "coherence", async () => {
    const data = await callGemini(buildCoherencePrompt(cvText, locale));
    return { score: safeScore((data as Record<string, unknown>).coherence_score), data };
  });
}

// M3: Linguistic
async function analyzeLinguistic(
  analysisId: string,
  cvText: string,
  locale: string
): Promise<ModuleResult | null> {
  return runModule(analysisId, "linguistic", async () => {
    const [ltMatches, geminiResult] = await Promise.all([
      checkLanguageTool(cvText, locale),
      callGemini(buildLinguisticPrompt(cvText, locale)),
    ]);

    const spellingErrors = ltMatches
      .filter((m) => m.rule.category.id === "TYPOS" || m.rule.category.id === "TYPOGRAPHY")
      .map((m) => ({
        message: m.message,
        context: m.context.text.substring(
          Math.max(0, m.context.offset - 10),
          m.context.offset + m.context.length + 10
        ),
        suggestions: m.replacements.slice(0, 3).map((r) => r.value),
      }));

    const grammarErrors = ltMatches
      .filter((m) => m.rule.category.id !== "TYPOS" && m.rule.category.id !== "TYPOGRAPHY")
      .map((m) => ({
        message: m.message,
        context: m.context.text.substring(
          Math.max(0, m.context.offset - 10),
          m.context.offset + m.context.length + 10
        ),
        suggestions: m.replacements.slice(0, 3).map((r) => r.value),
      }));

    const geminiData = geminiResult as Record<string, unknown>;
    const formulationScore = safeScore(geminiData.formulation_score, 70);
    const errorPenalty = Math.min(30, (spellingErrors.length + grammarErrors.length) * 3);
    const score = Math.max(0, Math.round((formulationScore * 0.6 + (100 - errorPenalty) * 0.4)));

    return {
      score,
      data: {
        ...geminiData,
        linguistic_score: score,
        spelling_errors: spellingErrors,
        grammar_errors: grammarErrors,
        spelling_count: spellingErrors.length,
        grammar_count: grammarErrors.length,
      },
    };
  });
}

// M4: Impact
async function analyzeImpact(
  analysisId: string,
  cvText: string,
  locale: string
): Promise<ModuleResult | null> {
  return runModule(analysisId, "impact", async () => {
    const data = await callGemini(buildImpactPrompt(cvText, locale));
    return { score: safeScore((data as Record<string, unknown>).impact_score), data };
  });
}

// M5: Completeness
async function analyzeCompleteness(
  analysisId: string,
  cvText: string,
  locale: string
): Promise<ModuleResult | null> {
  return runModule(analysisId, "completeness", async () => {
    const data = await callGemini(buildCompletenessPrompt(cvText, locale));
    return { score: safeScore((data as Record<string, unknown>).completeness_score), data };
  });
}

// M6: Job Fit
async function analyzeJobFit(
  analysisId: string,
  cvText: string,
  opts: AnalysisOptions
): Promise<ModuleResult | null> {
  const jobTitle = opts.targetJobTitle;
  if (!jobTitle && !opts.roleId) {
    await updateModuleStatus(analysisId, "job_fit", "skipped", undefined, undefined, "No job title or role provided");
    return null;
  }

  return runModule(analysisId, "job_fit", async () => {
    let roleRequirements: string | null = null;
    let title = jobTitle || "Unknown";

    if (opts.roleId) {
      // Role details live in role_dna.full_form_json (the `roles` table has no
      // title/full_form columns), so read from there.
      const { data: roleDna } = await supabaseAdmin
        .from("role_dna")
        .select("full_form_json")
        .eq("role_id", opts.roleId)
        .single();
      const ff = (roleDna?.full_form_json ?? null) as Record<string, unknown> | null;
      if (ff) {
        if (typeof ff.title === "string" && ff.title) title = ff.title;
        const parts: string[] = [];
        if (Array.isArray(ff.skills)) {
          parts.push("Required skills: " + (ff.skills as Array<{ name?: string }>).filter((s) => s && typeof s === "object").map((s) => s.name).filter(Boolean).join(", "));
        }
        if (ff.description) parts.push("Description: " + String(ff.description));
        roleRequirements = parts.join("\n");
      }
    }

    const data = await callGemini(buildJobFitPrompt(cvText, title, roleRequirements, opts.locale));
    return { score: safeScore((data as Record<string, unknown>).job_fit_score), data };
  });
}

// M7: Country
async function analyzeCountry(
  analysisId: string,
  cvText: string,
  opts: AnalysisOptions
): Promise<ModuleResult | null> {
  if (!opts.targetCountry) {
    await updateModuleStatus(analysisId, "country", "skipped", undefined, undefined, "No target country specified");
    return null;
  }

  const rules = COUNTRY_CV_RULES[opts.targetCountry];
  if (!rules) {
    await updateModuleStatus(analysisId, "country", "skipped", undefined, undefined, `Unknown country: ${opts.targetCountry}`);
    return null;
  }

  return runModule(analysisId, "country", async () => {
    const data = await callGemini(buildCountryPrompt(cvText, opts.targetCountry!, rules, opts.locale));
    return { score: safeScore((data as Record<string, unknown>).country_score), data };
  });
}

// M8: ATS
async function analyzeAts(
  analysisId: string,
  cvText: string,
  imageBuffer: Buffer | null,
  locale: string
): Promise<ModuleResult | null> {
  return runModule(analysisId, "ats", async () => {
    const textParseRate = cvText.length > 100 ? 100 : Math.round((cvText.length / 100) * 100);

    const promises: Promise<Record<string, unknown>>[] = [
      callGemini(buildAtsPrompt(cvText, locale)),
    ];
    if (imageBuffer) {
      promises.push(callGeminiVision(buildAtsVisionPrompt(locale), imageBuffer));
    }

    const results = await Promise.allSettled(promises);
    const textResult = results[0].status === "fulfilled" ? results[0].value : {};
    const visionResult = results.length > 1 && results[1].status === "fulfilled" ? results[1].value : {};

    const atsScore = safeScore(textResult.ats_score);
    const visualRisks = (visionResult.visual_ats_risks as unknown[]) ?? [];
    const visionPenalty = Math.min(20, visualRisks.length * 5);
    const finalScore = Math.max(0, Math.round(atsScore - visionPenalty));

    return {
      score: finalScore,
      data: {
        ...textResult,
        ats_score: finalScore,
        text_parse_rate: textParseRate,
        visual_analysis: visionResult,
      },
    };
  });
}

// M9: Credibility
async function analyzeCredibility(
  analysisId: string,
  cvText: string,
  locale: string
): Promise<ModuleResult | null> {
  return runModule(analysisId, "credibility", async () => {
    const data = await callGemini(buildCredibilityPrompt(cvText, locale));
    return { score: safeScore((data as Record<string, unknown>).credibility_score), data };
  });
}

// M10: Competitive / Skills Gap
async function analyzeCompetitive(
  analysisId: string,
  cvText: string,
  opts: AnalysisOptions
): Promise<ModuleResult | null> {
  const jobTitle = opts.targetJobTitle;
  if (!jobTitle && !opts.roleId) {
    await updateModuleStatus(analysisId, "competitive", "skipped", undefined, undefined, "No job title or role provided");
    return null;
  }

  return runModule(analysisId, "competitive", async () => {
    let roleSkills: string | null = null;
    let title = jobTitle || "Unknown";

    if (opts.roleId) {
      const { data: roleDna } = await supabaseAdmin
        .from("role_dna")
        .select("full_form_json")
        .eq("role_id", opts.roleId)
        .single();
      const ff = (roleDna?.full_form_json ?? null) as Record<string, unknown> | null;
      if (ff) {
        if (typeof ff.title === "string" && ff.title) title = ff.title;
        if (Array.isArray(ff.skills)) {
          roleSkills = (ff.skills as Array<{ name?: string; importance?: string }>).filter((s) => s && typeof s === "object")
            .map((s) => `${s.name} (${s.importance ?? "required"})`)
            .filter(Boolean)
            .join(", ");
        }
      }
    }

    const data = await callGemini(buildCompetitivePrompt(cvText, title, roleSkills, opts.locale));
    return { score: safeScore((data as Record<string, unknown>).competitive_score), data };
  });
}

// M11: Auto-correction (runs after all scored modules)
async function analyzeAutoCorrection(
  analysisId: string,
  cvText: string,
  locale: string
): Promise<ModuleResult | null> {
  const { data: modules } = await supabaseAdmin
    .from("cv_analysis_modules")
    .select("module_key, status, result_json")
    .eq("analysis_id", analysisId)
    .neq("module_key", "auto_correction");

  const moduleResults: Record<string, unknown> = {};
  for (const m of modules ?? []) {
    if (m.status === "completed" && m.result_json) {
      moduleResults[m.module_key] = m.result_json;
    }
  }

  return runModule(analysisId, "auto_correction", async () => {
    const data = await callGemini(buildAutoCorrectionPrompt(cvText, moduleResults, locale));
    return { score: null, data };
  });
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

async function runAllModules(
  analysisId: string,
  cvText: string,
  imageBuffer: Buffer | null,
  opts: AnalysisOptions
): Promise<void> {
  const results = await Promise.allSettled([
    analyzeVisual(analysisId, imageBuffer, cvText, opts.locale),
    analyzeCoherence(analysisId, cvText, opts.locale),
    analyzeLinguistic(analysisId, cvText, opts.locale),
    analyzeImpact(analysisId, cvText, opts.locale),
    analyzeCompleteness(analysisId, cvText, opts.locale),
    analyzeJobFit(analysisId, cvText, opts),
    analyzeCountry(analysisId, cvText, opts),
    analyzeAts(analysisId, cvText, imageBuffer, opts.locale),
    analyzeCredibility(analysisId, cvText, opts.locale),
    analyzeCompetitive(analysisId, cvText, opts),
  ]);

  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const key = SCORED_MODULE_KEYS[i];
    if (r.status === "fulfilled" && r.value && r.value.score != null) {
      const w = MODULE_WEIGHTS[key];
      totalWeight += w;
      weightedSum += r.value.score * w;
    }
  }

  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;

  await supabaseAdmin
    .from("cv_analyses")
    .update({
      overall_score: overallScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  // Run auto-correction after all scored modules complete
  await analyzeAutoCorrection(analysisId, cvText, opts.locale);

  await supabaseAdmin
    .from("cv_analyses")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
}

// ─── Upload + Create Analysis ───────────────────────────────────────────────

export async function createAnalysis(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  opts: AnalysisOptions & { initiatedBy: "candidate" | "hr"; initiatedByUser?: string }
): Promise<string> {
  const storagePath = `cv-studio/${userId}/${Date.now()}-${fileName.replace(/[^\w.-]/g, "_")}`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.CV_STUDIO_FILES)
    .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  const cvText = await extractTextFromPdf(fileBuffer);
  if (!cvText || cvText.trim().length < 20) {
    // 422 so the middleware forwards this message verbatim to the user instead
    // of masking it as a generic 500 ("connection error").
    throw new AppError(
      422,
      opts.locale === "fr"
        ? "Impossible de lire ce PDF : il est peut-être corrompu, protégé par mot de passe, ou composé uniquement d'images (scan). Essayez un autre fichier ou un PDF texte."
        : "Could not read this PDF: it may be corrupted, password-protected, or image-only (a scan). Try another file or a text-based PDF."
    );
  }

  // Reject documents that are clearly not CVs so they don't get a misleading
  // score (e.g. a contract scoring 63). Fail-open on classifier errors.
  const cvCheck = await isLikelyCv(cvText, opts.locale);
  if (cvCheck === false) {
    throw new AppError(
      422,
      opts.locale === "fr"
        ? "Ce document ne ressemble pas à un CV. Merci d'importer un CV / résumé (expérience, formation, compétences)."
        : "This document does not look like a CV. Please upload a CV / resume (experience, education, skills)."
    );
  }

  const { data: analysis, error: insertErr } = await supabaseAdmin
    .from("cv_analyses")
    .insert({
      user_id: userId,
      file_name: fileName,
      file_storage_path: storagePath,
      extracted_text: cvText,
      target_country: opts.targetCountry || null,
      target_job_title: opts.targetJobTitle || null,
      role_id: opts.roleId || null,
      status: "processing",
      initiated_by: opts.initiatedBy,
      initiated_by_user: opts.initiatedByUser || null,
    })
    .select("id")
    .single();

  if (insertErr || !analysis) throw new Error(`DB insert failed: ${insertErr?.message}`);

  const moduleRows = MODULE_KEYS.map((key) => ({
    analysis_id: analysis.id,
    module_key: key,
    status: "pending",
  }));

  const { error: modulesErr } = await supabaseAdmin.from("cv_analysis_modules").insert(moduleRows);

  if (modulesErr) throw new Error(`DB insert failed: ${modulesErr.message}`);

  const imageBuffer = await renderPdfPage1(fileBuffer);

  void runAllModules(analysis.id, cvText, imageBuffer, opts).catch((err) => {
    log.error({ analysisId: analysis.id, err }, "Fatal analysis error");
    supabaseAdmin
      .from("cv_analyses")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", analysis.id)
      .then(({ error: dbErr }) => { if (dbErr) log.error({ analysisId: analysis.id, err: dbErr.message }, "Failed to mark analysis as failed"); });
  });

  return analysis.id;
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

export async function getAnalysis(analysisId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("cv_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const { data: modules } = await supabaseAdmin
    .from("cv_analysis_modules")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: true });

  return { ...data, modules: modules ?? [] };
}

export async function getAnalysisStatus(analysisId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("cv_analyses")
    .select("id, status, overall_score")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const { data: modules } = await supabaseAdmin
    .from("cv_analysis_modules")
    .select("module_key, status, score")
    .eq("analysis_id", analysisId);

  const moduleStatus: Record<string, string> = {};
  (modules ?? []).forEach((m: { module_key: string; status: string }) => {
    moduleStatus[m.module_key] = m.status;
  });

  const completed = (modules ?? []).filter((m: { status: string }) =>
    m.status === "completed" || m.status === "failed" || m.status === "skipped"
  ).length;

  return {
    ...data,
    modules: moduleStatus,
    completed_count: completed,
    total_count: MODULE_KEYS.length,
  };
}

export async function getAnalysisHr(analysisId: string, institutionId: string) {
  const { data } = await supabaseAdmin
    .from("cv_analyses")
    .select("*")
    .eq("id", analysisId)
    .single();

  if (!data) return null;

  const { count } = await supabaseAdmin
    .from("applications")
    .select("id, roles!inner(institution_id)", { count: "exact", head: true })
    .eq("candidate_id", data.user_id)
    .eq("roles.institution_id", institutionId);
  if (!count || count === 0) return null;

  const { data: modules } = await supabaseAdmin
    .from("cv_analysis_modules")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("created_at", { ascending: true });

  return { ...data, modules: modules ?? [] };
}

export async function getAnalysisStatusHr(analysisId: string, institutionId: string) {
  const { data } = await supabaseAdmin
    .from("cv_analyses")
    .select("id, status, overall_score, user_id")
    .eq("id", analysisId)
    .single();

  if (!data) return null;

  const { count } = await supabaseAdmin
    .from("applications")
    .select("id, roles!inner(institution_id)", { count: "exact", head: true })
    .eq("candidate_id", data.user_id)
    .eq("roles.institution_id", institutionId);
  if (!count || count === 0) return null;

  const { data: modules } = await supabaseAdmin
    .from("cv_analysis_modules")
    .select("module_key, status, score")
    .eq("analysis_id", analysisId);

  const moduleStatus: Record<string, string> = {};
  (modules ?? []).forEach((m: { module_key: string; status: string }) => {
    moduleStatus[m.module_key] = m.status;
  });

  const completed = (modules ?? []).filter((m: { status: string }) =>
    m.status === "completed" || m.status === "failed" || m.status === "skipped"
  ).length;

  return {
    id: data.id,
    status: data.status,
    overall_score: data.overall_score,
    modules: moduleStatus,
    completed_count: completed,
    total_count: MODULE_KEYS.length,
  };
}

export async function getUserAnalyses(userId: string) {
  const { data } = await supabaseAdmin
    .from("cv_analyses")
    .select("id, file_name, status, overall_score, target_country, target_job_title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data ?? [];
}

export async function deleteAnalysis(analysisId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("cv_analyses")
    .select("id, file_storage_path")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .single();

  if (!data) return false;

  if (data.file_storage_path) {
    await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.CV_STUDIO_FILES)
      .remove([data.file_storage_path]);
  }

  await supabaseAdmin.from("cv_analysis_modules").delete().eq("analysis_id", analysisId);
  await supabaseAdmin.from("cv_analyses").delete().eq("id", analysisId);
  return true;
}
