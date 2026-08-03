import { Router } from "express";
import { authGuard, requirePersonalWorkspace } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import { submitReflectionSchema } from "./prep.schema";
import {
  getPrepBrief,
  generatePrepBrief,
  submitReflection,
  getReflection,
} from "./prep.controller";

const router = Router();

// ─── Prep Briefs (AI-generated, per application) ─────────────────────────────
router.get("/:applicationId/brief",  authGuard, requirePersonalWorkspace, getPrepBrief);
router.post("/:applicationId/brief", authGuard, requirePersonalWorkspace, generatePrepBrief);

// ─── Post-Interview Reflections ───────────────────────────────────────────────
router.get("/reflections/:interviewId",  authGuard, requirePersonalWorkspace, getReflection);
router.post("/reflections/:interviewId", authGuard, requirePersonalWorkspace, validate(submitReflectionSchema), submitReflection);

export default router;
