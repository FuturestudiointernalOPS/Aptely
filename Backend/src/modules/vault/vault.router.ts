import { Router } from "express";
import multer from "multer";
import { authGuard, requirePersonalWorkspace } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  addSkillProofSchema,
  addWorkEvidenceSchema,
  requestEndorsementSchema,
  submitEndorsementSchema,
} from "./vault.schema";
import {
  uploadVaultFile,
  listSkillProofs,
  addSkillProof,
  deleteSkillProof,
  listWorkEvidence,
  addWorkEvidence,
  deleteWorkEvidence,
  getCompletionScore,
  requestEndorsement,
  listEndorsements,
  deleteEndorsement,
  getEndorsementByToken,
  submitEndorsement,
  listReferences,
  addReference,
  deleteReference,
} from "./vault.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard cap before controller
});

// ─── File Upload ──────────────────────────────────────────────────────────────
router.post(
  "/me/proofs/upload",
  authGuard,
  requirePersonalWorkspace,
  upload.single("file"),
  uploadVaultFile
);

// ─── Skill Proofs (authenticated CANDIDATE) ───────────────────────────────────
router.get("/me/proofs", authGuard, requirePersonalWorkspace, listSkillProofs);
router.post(
  "/me/proofs",
  authGuard,
  requirePersonalWorkspace,
  validate(addSkillProofSchema),
  addSkillProof
);
router.delete("/me/proofs/:id", authGuard, requirePersonalWorkspace, deleteSkillProof);

// ─── Work Evidence ─────────────────────────────────────────────────────────────
router.get("/me/evidence", authGuard, requirePersonalWorkspace, listWorkEvidence);
router.post(
  "/me/evidence",
  authGuard,
  requirePersonalWorkspace,
  validate(addWorkEvidenceSchema),
  addWorkEvidence
);
router.delete("/me/evidence/:id", authGuard, requirePersonalWorkspace, deleteWorkEvidence);

// ─── Completion Score ──────────────────────────────────────────────────────────
router.get("/me/score", authGuard, requirePersonalWorkspace, getCompletionScore);

// ─── Endorsements (authenticated + public token routes) ───────────────────────
router.get("/me/endorsements", authGuard, requirePersonalWorkspace, listEndorsements);
router.post(
  "/me/endorsements/request",
  authGuard,
  requirePersonalWorkspace,
  validate(requestEndorsementSchema),
  requestEndorsement
);
router.delete("/me/endorsements/:id", authGuard, requirePersonalWorkspace, deleteEndorsement);

// ─── References ───────────────────────────────────────────────────────────────
router.get("/me/references", authGuard, requirePersonalWorkspace, listReferences);
router.post("/me/references", authGuard, requirePersonalWorkspace, addReference);
router.delete("/me/references/:id", authGuard, requirePersonalWorkspace, deleteReference);

// Public — no auth required
router.get("/endorse/:token", getEndorsementByToken);
router.post("/endorse/:token", validate(submitEndorsementSchema), submitEndorsement);

export default router;
