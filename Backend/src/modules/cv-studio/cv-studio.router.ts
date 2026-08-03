import { Router } from "express";
import multer from "multer";
import { authGuard, requirePersonalWorkspace } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import { cvStudioRateLimiter } from "@/middleware/rateLimiter.middleware";
import { startAnalysisSchema, hrStartAnalysisSchema } from "./cv-studio.schema";
import {
  startAnalysisHandler,
  listAnalysesHandler,
  getAnalysisHandler,
  getAnalysisStatusHandler,
  deleteAnalysisHandler,
  exportCorrectedCvHandler,
  getDiffHandler,
  hrStartAnalysisHandler,
  hrGetAnalysisStatusHandler,
  hrGetAnalysisHandler,
} from "./cv-studio.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Candidate routes ───────────────────────────────────────────────────────

router.post(
  "/analyze",
  authGuard,
  requirePersonalWorkspace,
  cvStudioRateLimiter,
  upload.single("file"),
  validate(startAnalysisSchema),
  startAnalysisHandler
);

router.get("/analyses", authGuard, requirePersonalWorkspace, listAnalysesHandler);
router.get("/analyses/:id", authGuard, requirePersonalWorkspace, getAnalysisHandler);
router.get("/analyses/:id/status", authGuard, requirePersonalWorkspace, getAnalysisStatusHandler);
router.delete("/analyses/:id", authGuard, requirePersonalWorkspace, deleteAnalysisHandler);
router.post("/analyses/:id/export", authGuard, requirePersonalWorkspace, exportCorrectedCvHandler);
router.get("/analyses/:id/diff", authGuard, requirePersonalWorkspace, getDiffHandler);

// ─── HR routes ──────────────────────────────────────────────────────────────

router.post(
  "/hr/analyze",
  authGuard,
  requirePermission("applications.view"),
  cvStudioRateLimiter,
  upload.single("file"),
  validate(hrStartAnalysisSchema),
  hrStartAnalysisHandler
);

router.get(
  "/hr/analyses/:id/status",
  authGuard,
  requirePermission("applications.view"),
  hrGetAnalysisStatusHandler
);

router.get(
  "/hr/analyses/:id",
  authGuard,
  requirePermission("applications.view"),
  hrGetAnalysisHandler
);

export default router;
