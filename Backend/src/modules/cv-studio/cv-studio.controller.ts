import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/helpers";
import { AppError } from "@/middleware/error.middleware";
import { supabaseAdmin } from "@/config/supabase";
import pino from "pino";

const log = pino({ name: "cv-studio" });
import type { StartAnalysisInput, HrStartAnalysisInput } from "./cv-studio.schema";
import {
  createAnalysis,
  getAnalysis,
  getAnalysisStatus,
  getAnalysisStatusHr,
  getAnalysisHr,
  getUserAnalyses,
  deleteAnalysis,
} from "./cv-studio.service";
import {
  generateCorrectedPdf,
  generateCorrectedDocx,
  computeDiff,
} from "./cv-studio-export.service";

function getLocale(req: AuthenticatedRequest): "fr" | "en" {
  const header = (req.headers["x-locale"] ?? "").toString().toLowerCase();
  return header === "en" ? "en" : "fr";
}

// POST /cv-studio/analyze
export const startAnalysisHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const file = (req as Express.Request & { file?: Express.Multer.File }).file;

    if (!file) throw new AppError(400, "No file provided");
    if (file.mimetype !== "application/pdf") throw new AppError(415, "Only PDF files are accepted");
    if (file.size > 10 * 1024 * 1024) throw new AppError(413, "File exceeds 10 MB limit");

    const body = req.body as StartAnalysisInput;

    const analysisId = await createAnalysis(userId, file.buffer, file.originalname, {
      locale: getLocale(req),
      targetCountry: body.target_country,
      targetJobTitle: body.target_job_title,
      roleId: body.role_id,
      initiatedBy: "candidate",
    });

    res.status(202).json({ data: { id: analysisId, status: "processing" } });
  }
);

// GET /cv-studio/analyses
export const listAnalysesHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const data = await getUserAnalyses(req.user!.id);
    res.json({ data });
  }
);

// GET /cv-studio/analyses/:id
export const getAnalysisHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const data = await getAnalysis(req.params.id as string, req.user!.id);
    if (!data) throw new AppError(404, "Analysis not found");
    res.json({ data });
  }
);

// GET /cv-studio/analyses/:id/status
export const getAnalysisStatusHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const data = await getAnalysisStatus(req.params.id as string, req.user!.id);
    if (!data) throw new AppError(404, "Analysis not found");
    res.json({ data });
  }
);

// DELETE /cv-studio/analyses/:id
export const deleteAnalysisHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const deleted = await deleteAnalysis(req.params.id as string, req.user!.id);
    if (!deleted) throw new AppError(404, "Analysis not found");
    res.json({ data: { deleted: true } });
  }
);

// POST /cv-studio/analyses/:id/export
export const exportCorrectedCvHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const analysisId = req.params.id as string;
    const format = (req.body as { format?: string }).format;

    if (format !== "pdf" && format !== "docx") {
      throw new AppError(400, "Format must be 'pdf' or 'docx'");
    }

    const analysis = await getAnalysis(analysisId, userId);
    if (!analysis) throw new AppError(404, "Analysis not found");

    const autoMod = analysis.modules?.find(
      (m: { module_key: string }) => m.module_key === "auto_correction"
    );
    if (!autoMod || autoMod.status !== "completed" || !autoMod.result_json) {
      throw new AppError(400, "Auto-correction not yet completed");
    }

    const raw = autoMod.result_json as Record<string, unknown>;
    if (!Array.isArray(raw.corrected_sections) || typeof raw.full_corrected_text !== "string") {
      throw new AppError(500, "Auto-correction data is malformed");
    }
    const correctionData = raw as unknown as {
      corrected_sections: Array<{ section_name: string; original_text: string; corrected_text: string; changes: Array<{ type: string; original: string; replacement: string; reason: string }> }>;
      full_corrected_text: string;
      summary: { total_changes: number; by_type: Record<string, number> };
    };

    const downloadUrl = format === "pdf"
      ? await generateCorrectedPdf(analysisId, userId, correctionData)
      : await generateCorrectedDocx(analysisId, userId, correctionData);

    res.json({ data: { downloadUrl, format, expiresIn: 3600 } });
  }
);

// GET /cv-studio/analyses/:id/diff
export const getDiffHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const analysisId = req.params.id as string;

    const analysis = await getAnalysis(analysisId, userId);
    if (!analysis) throw new AppError(404, "Analysis not found");

    const autoMod = analysis.modules?.find(
      (m: { module_key: string }) => m.module_key === "auto_correction"
    );
    if (!autoMod || autoMod.status !== "completed" || !autoMod.result_json) {
      throw new AppError(400, "Auto-correction not yet completed");
    }

    const result = autoMod.result_json as {
      corrected_sections: Array<{ section_name: string; original_text: string; corrected_text: string }>;
      full_corrected_text: string;
    };

    const originalText = analysis.extracted_text ?? "";
    const changes = computeDiff(originalText, result.full_corrected_text);

    res.json({
      data: {
        original: originalText,
        corrected: result.full_corrected_text,
        sections: result.corrected_sections,
        changes,
      },
    });
  }
);

// POST /cv-studio/hr/analyze
export const hrStartAnalysisHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const body = req.body as HrStartAnalysisInput;
    const hrUserId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "No institution context");

    const { count } = await supabaseAdmin
      .from("applications")
      .select("id, roles!inner(institution_id)", { count: "exact", head: true })
      .eq("candidate_id", body.candidate_id)
      .eq("roles.institution_id", institutionId);
    if (!count || count === 0) {
      throw new AppError(403, "Candidate does not belong to your institution");
    }

    const file = (req as Express.Request & { file?: Express.Multer.File }).file;
    if (!file) throw new AppError(400, "No file provided");
    if (file.mimetype !== "application/pdf") throw new AppError(415, "Only PDF files are accepted");
    if (file.size > 10 * 1024 * 1024) throw new AppError(413, "File exceeds 10 MB limit");

    const analysisId = await createAnalysis(body.candidate_id, file.buffer, file.originalname, {
      locale: getLocale(req),
      targetCountry: body.target_country,
      targetJobTitle: body.target_job_title,
      roleId: body.role_id,
      initiatedBy: "hr",
      initiatedByUser: hrUserId,
    });

    log.info({ hrUserId, candidateId: body.candidate_id, analysisId }, "HR initiated CV analysis");
    res.status(202).json({ data: { id: analysisId, status: "processing" } });
  }
);

// GET /cv-studio/hr/analyses/:id/status
export const hrGetAnalysisStatusHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "No institution context");
    const data = await getAnalysisStatusHr(req.params.id as string, institutionId);
    if (!data) throw new AppError(404, "Analysis not found");
    res.json({ data });
  }
);

// GET /cv-studio/hr/analyses/:id
export const hrGetAnalysisHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "No institution context");
    const data = await getAnalysisHr(req.params.id as string, institutionId);
    if (!data) throw new AppError(404, "Analysis not found");
    res.json({ data });
  }
);
