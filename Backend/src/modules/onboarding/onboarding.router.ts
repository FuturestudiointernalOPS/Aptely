import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  createTemplateSchema,
  updateTemplateSchema,
  instantiateChecklistSchema,
  updateTaskStatusSchema,
  listTemplatesQuerySchema,
  presignOnboardingUploadSchema,
  completeOnboardingUploadSchema,
  verifyOnboardingDocumentSchema,
  initSigningChainSchema,
  signDocumentSchema,
  rejectSignerStepSchema,
} from "./onboarding.schema";
import {
  createTemplate,
  updateTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  instantiateChecklist,
  getChecklist,
  updateTaskStatus,
  presignDocumentUpload,
  completeDocumentUpload,
  verifyOnboardingDocument,
  initSigningChain,
  getSigningChain,
  signDocument,
  rejectSignerStep,
  candidateSignByToken,
} from "./onboarding.controller";

const router = Router();

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * @route   GET /onboarding/templates
 * @access  onboarding.manage
 */
router.get(
  "/templates",
  authGuard,
  requirePermission("onboarding.manage"),
  validateQuery(listTemplatesQuerySchema),
  listTemplates
);

/**
 * @route   POST /onboarding/templates
 * @access  onboarding.manage
 */
router.post(
  "/templates",
  authGuard,
  requirePermission("onboarding.manage"),
  validate(createTemplateSchema),
  createTemplate
);

/**
 * @route   GET /onboarding/templates/:templateId
 * @access  onboarding.manage
 */
router.get(
  "/templates/:templateId",
  authGuard,
  requirePermission("onboarding.manage"),
  getTemplate
);

/**
 * @route   PATCH /onboarding/templates/:templateId
 * @access  onboarding.manage
 */
router.patch(
  "/templates/:templateId",
  authGuard,
  requirePermission("onboarding.manage"),
  validate(updateTemplateSchema),
  updateTemplate
);

/**
 * @route   DELETE /onboarding/templates/:templateId
 * @access  onboarding.manage
 */
router.delete(
  "/templates/:templateId",
  authGuard,
  requirePermission("onboarding.manage"),
  deleteTemplate
);

// ─── Checklists ───────────────────────────────────────────────────────────────

/**
 * @route   POST /onboarding/checklists/instantiate
 * @access  onboarding.manage
 */
router.post(
  "/checklists/instantiate",
  authGuard,
  requirePermission("onboarding.manage"),
  validate(instantiateChecklistSchema),
  instantiateChecklist
);

/**
 * @route   GET /onboarding/checklists/:applicationId
 * @desc    Get the onboarding checklist for an application (HR or Candidate)
 * @access  Authenticated
 */
router.get(
  "/checklists/:applicationId",
  authGuard,
  getChecklist
);

// ─── Tasks ────────────────────────────────────────────────────────────────────

/**
 * @route   PATCH /onboarding/tasks/:taskId/status
 * @desc    Update task status (HR or Candidate depending on assignee_type)
 * @access  Authenticated
 */
router.patch(
  "/tasks/:taskId/status",
  authGuard,
  validate(updateTaskStatusSchema),
  updateTaskStatus
);

// ─── Documents ────────────────────────────────────────────────────────────────

router.post(
  "/documents/presign-upload",
  authGuard,
  validate(presignOnboardingUploadSchema),
  presignDocumentUpload
);

router.post(
  "/documents/complete",
  authGuard,
  validate(completeOnboardingUploadSchema),
  completeDocumentUpload
);

router.patch(
  "/documents/:id/verify",
  authGuard,
  requirePermission("onboarding.manage"),
  validate(verifyOnboardingDocumentSchema),
  verifyOnboardingDocument
);

// ─── Phase F — Signing chain ──────────────────────────────────────────────────

/**
 * @route   POST /onboarding/documents/sign/:token
 * @desc    Public route — candidate signs via unique token (no auth required)
 * @access  Public (token is the secret)
 */
router.post(
  "/documents/sign/:token",
  validate(signDocumentSchema),
  candidateSignByToken
);

/**
 * @route   POST /onboarding/documents/:id/signing-chain
 * @desc    HR initialises the ordered signing chain for a document
 * @access  onboarding.manage
 */
router.post(
  "/documents/:id/signing-chain",
  authGuard,
  requirePermission("onboarding.manage"),
  validate(initSigningChainSchema),
  initSigningChain
);

/**
 * @route   GET /onboarding/documents/:id/signing-chain
 * @desc    Get signing chain status for a document
 * @access  onboarding.manage
 */
router.get(
  "/documents/:id/signing-chain",
  authGuard,
  requirePermission("onboarding.manage"),
  getSigningChain
);

/**
 * @route   POST /onboarding/documents/:id/signing-chain/:position/sign
 * @desc    Institution member signs their step (role checked in controller)
 * @access  Authenticated
 */
router.post(
  "/documents/:id/signing-chain/:position/sign",
  authGuard,
  validate(signDocumentSchema),
  signDocument
);

/**
 * @route   POST /onboarding/documents/:id/signing-chain/:position/reject
 * @desc    Institution member rejects their signing step
 * @access  Authenticated
 */
router.post(
  "/documents/:id/signing-chain/:position/reject",
  authGuard,
  validate(rejectSignerStepSchema),
  rejectSignerStep
);

export default router;
