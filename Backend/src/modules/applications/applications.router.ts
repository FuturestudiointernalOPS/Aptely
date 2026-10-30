import { Router } from "express";
import { authGuard, requirePersonalWorkspace } from "@/middleware/auth.middleware";
import {
  requirePermission,
  requirePermissionOrPersonalWorkspace,
} from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  updateApplicationStatusSchema,
  updateApplicationNotesSchema,
  listApplicationsQuerySchema,
} from "./applications.schema";
import {
  getMyApplications,
  getApplicationById,
  listApplications,
  updateApplicationStatus,
  updateApplicationNotes,
  getDocuments,
  deleteApplication,
  getSortedTalents,
  reviewSortedTalent,
  finalizeSelection,
  getEmailPreview,
  sendEmails,
  closeApplication,
  getShareLink,
  relaunchApplicationMatching,
} from "./applications.controller";

import {
  applyPublic,
  getPublicApplicationStatus,
  getPublicRoleBySlug,
} from "./applications.public.controller";
import multer from "multer";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

// ─── PUBLIC routes ────────────────────────────────────────────────────────
/**
 * @route   GET /applications/role/:slug
 * @desc    Get role details publicly by share link slug
 * @access  Public (no auth required)
 */
router.get("/role/:slug", getPublicRoleBySlug);
router.get("/public/status/:applicationId", authGuard, requirePersonalWorkspace, getPublicApplicationStatus);

router.post(
  "/public/:shareLink",
  (req, _res, next) => { console.log("[router] POST /public/:shareLink matched, shareLink:", req.params.shareLink); next(); },
  authGuard,
  upload.fields([{ name: "cv", maxCount: 1 }, { name: "documents", maxCount: 10 }]),
  applyPublic
);

// ─── Candidate routes ─────────────────────────────────────────────────────────
router.get(
  "/my",
  authGuard,
  requirePersonalWorkspace,
  validateQuery(listApplicationsQuerySchema),
  getMyApplications
);

// ─── HR routes ────────────────────────────────────────────────────────────────
/**
 * @route   GET /applications
 * @desc    HR liste toutes les candidatures de son institution
 * @access  HR
 */
router.get(
  "/",
  authGuard,
  requirePermission("applications.view"),
  validateQuery(listApplicationsQuerySchema),
  listApplications
);

/**
 * @route   PATCH /applications/:id/status
 * @desc    HR change le statut d'une candidature
 * @access  HR
 */
router.patch(
  "/:id/status",
  authGuard,
  requirePermission("applications.decide"),
  validate(updateApplicationStatusSchema),
  updateApplicationStatus
);

/**
 * @route   PATCH /applications/:id/notes
 * @desc    HR modifie les notes internes d'une candidature
 * @access  HR
 */
router.patch(
  "/:id/notes",
  authGuard,
  requirePermission("applications.view"),
  validate(updateApplicationNotesSchema),
  updateApplicationNotes
);

/**
 * @route   GET /applications/:id
 * @desc    Détail candidature — HR (applications.view) ou talent (workspace perso, sa propre app)
 * @access  HR | Candidate (own application)
 */
router.get(
  "/:id",
  authGuard,
  requirePermissionOrPersonalWorkspace("applications.view"),
  getApplicationById
);

/**
 * @route   GET /applications/:id/documents
 * @desc    Liste les documents avec signed URLs (1h)
 * @access  HR
 */
router.get("/:id/documents", authGuard, requirePermission("applications.view"), getDocuments);

/**
 * @route   DELETE /applications/:id
 * @desc    Supprimer une candidature (HR institution)
 * @access  HR
 */
router.delete("/:id", authGuard, requirePermission("applications.decide"), deleteApplication);
router.get("/:id/share-link", authGuard, requirePermission("applications.view"), getShareLink);

// ─── Phase 4 — Sorted Talents & Selection ─────────────────────────────────────
/**
 * @route   GET /applications/:id/sorted-talents
 * @desc    HR retrieves the AI-ranked candidate list for an application
 * @access  HR
 */
router.get("/:id/sorted-talents", authGuard, requirePermission("applications.view"), getSortedTalents);

/**
 * @route   PATCH /applications/:id/sorted-talents/:talentId
 * @desc    HR marks a candidate as approved (true) or disapproved (false)
 * @access  HR
 */
router.patch("/:id/sorted-talents/:talentId", authGuard, requirePermission("applications.decide"), reviewSortedTalent);

/**
 * @route   POST /applications/:id/finalize-selection
 * @desc    HR finalizes selection, generates email templates, sets status FINISHED
 * @access  HR
 */
router.post("/:id/finalize-selection", authGuard, requirePermission("applications.decide"), finalizeSelection);

/**
 * @route   GET /applications/:id/email-preview
 * @desc    HR previews the stored email templates for this application
 * @access  HR
 */
router.get("/:id/email-preview", authGuard, requirePermission("communications.send"), getEmailPreview);

/**
 * @route   POST /applications/:id/send-emails
 * @desc    HR sends approval/rejection emails to all reviewed candidates
 * @access  HR
 */
router.post("/:id/send-emails", authGuard, requirePermission("communications.send"), sendEmails);

/**
 * @route   PATCH /applications/:id/close
 * @desc    HR manually closes an application (sets status FINISHED)
 * @access  HR
 */
router.patch("/:id/close", authGuard, requirePermission("applications.decide"), closeApplication);

/**
 * @route   POST /applications/:id/relaunch-matching
 * @desc    HR relance l'IA pour une candidature précise
 * @access  HR
 */
router.post("/:id/relaunch-matching", authGuard, requirePermission("applications.view"), relaunchApplicationMatching);

export default router;
