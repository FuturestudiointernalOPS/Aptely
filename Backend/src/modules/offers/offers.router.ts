import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  createOfferSchema,
  updateOfferSchema,
  updateOfferStatusSchema,
  listOffersQuerySchema,
  generateOfferPdfSchema,
  counterOfferSchema,
  counterResponseSchema,
} from "./offers.schema";
import {
  createApprovalChain,
  getApprovalChain,
  approveStep,
  rejectStep,
} from "./offer-approvals.controller";
import {
  createOffer,
  updateOffer,
  updateOfferStatus,
  getOffer,
  getOfferVersions,
  listOffers,
  generateOfferPdf,
  getPublicOfferByToken,
  counterOffer,
  acceptOffer,
  rejectOffer,
  approveCounterOffer,
  rejectCounterOffer,
  publicAcceptOffer,
  publicRejectOffer,
  publicCounterOffer,
  getCounterHistory,
  getPendingApprovals,
  initOfferSigningChain,
  getOfferSigningChain,
  signOfferStep,
  signOfferByToken,
  resolveOfferSigners,
  getSignedOfferPdf,
} from "./offers.controller";

const router = Router();

/**
 * @route   GET /offers
 * @desc    HR lists all offers for their institution
 * @access  HR
 */
router.get(
  "/",
  authGuard,
  requirePermission("offers.manage"),
  validateQuery(listOffersQuerySchema),
  listOffers
);

/**
 * @route   GET /offers/pending-approvals
 * @desc    HR lists DRAFT offers with pending approval steps (for HiringQueue)
 * @access  HR (offers.manage)
 */
router.get(
  "/pending-approvals",
  authGuard,
  requirePermission("offers.manage"),
  getPendingApprovals
);

/**
 * @route   POST /offers
 * @desc    HR creates a new offer for an application
 * @access  HR
 */
router.post(
  "/",
  authGuard,
  requirePermission("offers.manage"),
  validate(createOfferSchema),
  createOffer
);

/**
 * @route   GET /offers/:id
 * @desc    Get offer details with latest version
 * @access  HR
 */
router.get(
  "/:id",
  authGuard,
  requirePermission("offers.manage"),
  getOffer
);

/**
 * @route   PATCH /offers/:id
 * @desc    HR updates an offer (creates a new version)
 * @access  HR
 */
router.patch(
  "/:id",
  authGuard,
  requirePermission("offers.manage"),
  validate(updateOfferSchema),
  updateOffer
);

/**
 * @route   PATCH /offers/:id/status
 * @desc    HR changes the status of an offer
 * @access  HR
 */
router.patch(
  "/:id/status",
  authGuard,
  requirePermission("offers.manage"),
  validate(updateOfferStatusSchema),
  updateOfferStatus
);

/**
 * @route   GET /offers/:id/versions
 * @desc    Get the full version history of an offer
 * @access  HR
 */
router.get(
  "/:id/versions",
  authGuard,
  requirePermission("offers.manage"),
  getOfferVersions
);

/**
 * @route   GET /offers/:id/counter-history
 * @desc    Get the full counter-offer negotiation history for an offer
 * @access  HR (offers.manage)
 */
router.get(
  "/:id/counter-history",
  authGuard,
  requirePermission("offers.manage"),
  getCounterHistory
);

router.post(
  "/:id/generate-pdf",
  authGuard,
  requirePermission("offers.manage"),
  validate(generateOfferPdfSchema),
  generateOfferPdf
);

router.get(
  "/public/:token",
  getPublicOfferByToken
);

router.post(
  "/public/:token/accept",
  publicAcceptOffer
);

router.post(
  "/public/:token/reject",
  publicRejectOffer
);

router.post(
  "/public/:token/counter",
  validate(counterOfferSchema),
  publicCounterOffer
);

router.post(
  "/:id/counter",
  authGuard,
  // Dual-actor route: HR (institution member) or CANDIDATE (application owner). Controller verifies ownership.
  validate(counterOfferSchema),
  counterOffer
);

router.post(
  "/:id/accept",
  authGuard,
  // Dual-actor route: HR (institution member) or CANDIDATE (application owner). Controller verifies ownership.
  acceptOffer
);

router.post(
  "/:id/reject",
  authGuard,
  // Dual-actor route: HR (institution member) or CANDIDATE (application owner). Controller verifies ownership.
  rejectOffer
);

// ─── Phase F — Counter-Offer Response (HR approves/rejects candidate counter) ────

/**
 * @route   POST /offers/:id/counter-response/approve
 * @desc    HR approves a candidate counter-offer (keeps new terms, COUNTER_OFFERED → SENT)
 * @access  HR (offers.manage)
 */
router.post(
  "/:id/counter-response/approve",
  authGuard,
  requirePermission("offers.manage"),
  validate(counterResponseSchema),
  approveCounterOffer
);

/**
 * @route   POST /offers/:id/counter-response/reject
 * @desc    HR rejects a candidate counter-offer (reverts to SENT with original terms)
 * @access  HR (offers.manage)
 */
router.post(
  "/:id/counter-response/reject",
  authGuard,
  requirePermission("offers.manage"),
  validate(counterResponseSchema),
  rejectCounterOffer
);

// ─── Phase F — Approval chain routes ──────────────────────────────────────────

/**
 * @route   POST /offers/:id/approval-chain
 * @desc    Initialize the multi-step approval chain for a DRAFT offer
 * @access  HR (offers.manage)
 */
router.post(
  "/:id/approval-chain",
  authGuard,
  requirePermission("offers.manage"),
  createApprovalChain
);

/**
 * @route   GET /offers/:id/approvals
 * @desc    Get the full approval chain for an offer (steps + status)
 * @access  HR (offers.manage)
 */
router.get(
  "/:id/approvals",
  authGuard,
  requirePermission("offers.manage"),
  getApprovalChain
);

/**
 * @route   POST /offers/:id/approvals/:step/approve
 * @desc    Approve a specific step in the offer approval chain
 * @access  HR member with matching role_specialization (or OWNER)
 */
router.post(
  "/:id/approvals/:step/approve",
  authGuard,
  requirePermission("offers.manage"),
  approveStep
);

/**
 * @route   POST /offers/:id/approvals/:step/reject
 * @desc    Reject a specific step in the offer approval chain
 * @access  HR member with matching role_specialization (or OWNER)
 */
router.post(
  "/:id/approvals/:step/reject",
  authGuard,
  requirePermission("offers.manage"),
  rejectStep
);

// ─── Signing Chain ─────────────────────────────────────────────────────────────

/**
 * @route   POST /offers/:id/signing-chain
 * @desc    Initialise offer signing chain (candidate + optional HR steps)
 * @access  HR
 */
router.post("/:id/signing-chain", authGuard, requirePermission("offers.manage"), initOfferSigningChain);

/**
 * @route   GET /offers/:id/signing-chain
 * @desc    Get signing chain status
 * @access  HR
 */
router.get("/:id/signing-chain", authGuard, requirePermission("offers.manage"), getOfferSigningChain);

/**
 * @route   POST /offers/:id/signing-chain/:position/sign
 * @desc    HR member signs their step
 * @access  HR
 */
router.post("/:id/signing-chain/:position/sign", authGuard, requirePermission("offers.manage"), signOfferStep);

/**
 * @route   POST /offers/sign/:token
 * @desc    Candidate signs offer via public token (no auth)
 * @access  Public
 */
router.post("/sign/:token", signOfferByToken);

/**
 * GET /offers/:id/resolve-signers
 * Resolve org-chart signers for an offer (department manager or OWNER fallback)
 */
router.get("/:id/resolve-signers", authGuard, resolveOfferSigners);

/**
 * GET /offers/:id/signed-pdf
 * Generate PDF with both signatures embedded
 */
router.get("/:id/signed-pdf", authGuard, requirePermission("offers.manage"), getSignedOfferPdf);

export default router;
