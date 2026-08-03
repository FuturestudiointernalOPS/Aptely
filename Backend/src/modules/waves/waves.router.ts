import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  createWaveSchema,
  updateWaveSchema,
  generateWaveSlotsSchema,
  createWaveSlotSchema,
  inviteCandidatesSchema,
  updateWaveCandidateStatusSchema,
  confirmWaveBookingSchema,
  createWaveTemplateSchema,
} from "./waves.schema";
import {
  listWavesForRole,
  createWave,
  getWave,
  updateWave,
  deleteWave,
  listWaveSlots,
  createWaveSlot,
  generateWaveSlots,
  deleteWaveSlot,
  listWaveCandidates,
  inviteCandidates,
  updateWaveCandidateStatus,
  removeWaveCandidate,
  getWaveBookingByToken,
  confirmWaveBooking,
  getWaveAnalytics,
  listWaveTemplates,
  createWaveTemplate,
} from "./waves.controller";

const router = Router();

// ─── Public routes (no auth) ──────────────────────────────────────────────────

/**
 * @route   GET /waves/booking/:token
 * @desc    Candidate views wave info and available slots via invite token
 * @access  Public
 */
router.get("/booking/:token", getWaveBookingByToken);

/**
 * @route   POST /waves/booking/:token/confirm
 * @desc    Candidate confirms a slot booking
 * @access  Public
 */
router.post("/booking/:token/confirm", validate(confirmWaveBookingSchema), confirmWaveBooking);

// ─── Protected HR routes ──────────────────────────────────────────────────────

router.use(authGuard, requirePermission("interviews.manage"));

/**
 * @route   GET /waves/templates
 * @desc    HR lists wave templates for their institution
 * @access  HR
 */
router.get("/templates", listWaveTemplates);

/**
 * @route   POST /waves/templates
 * @desc    HR creates a wave template
 * @access  HR
 */
router.post("/templates", validate(createWaveTemplateSchema), createWaveTemplate);

/**
 * @route   GET /waves/role/:roleId
 * @desc    HR lists all waves for a role
 * @access  HR
 */
router.get("/role/:roleId", listWavesForRole);

/**
 * @route   POST /waves
 * @desc    HR creates a new recruitment wave
 * @access  HR
 */
router.post("/", validate(createWaveSchema), createWave);

/**
 * @route   GET /waves/:id
 * @desc    HR gets wave details
 * @access  HR
 */
router.get("/:id", getWave);

/**
 * @route   PATCH /waves/:id
 * @desc    HR updates wave settings
 * @access  HR
 */
router.patch("/:id", validate(updateWaveSchema), updateWave);

/**
 * @route   DELETE /waves/:id
 * @desc    HR deletes a wave (only DRAFT allowed)
 * @access  HR
 */
router.delete("/:id", deleteWave);

/**
 * @route   GET /waves/:id/slots
 * @desc    HR lists all slots for a wave
 * @access  HR
 */
router.get("/:id/slots", listWaveSlots);

/**
 * @route   POST /waves/:id/slots
 * @desc    HR creates a single slot for a wave
 * @access  HR
 */
router.post("/:id/slots", validate(createWaveSlotSchema), createWaveSlot);

/**
 * @route   POST /waves/:id/slots/generate
 * @desc    HR batch-generates slots in a date range
 * @access  HR
 */
router.post("/:id/slots/generate", validate(generateWaveSlotsSchema), generateWaveSlots);

/**
 * @route   DELETE /waves/:id/slots/:slotId
 * @desc    HR deletes a slot
 * @access  HR
 */
router.delete("/:id/slots/:slotId", deleteWaveSlot);

/**
 * @route   GET /waves/:id/candidates
 * @desc    HR lists candidates assigned to a wave
 * @access  HR
 */
router.get("/:id/candidates", listWaveCandidates);

/**
 * @route   POST /waves/:id/candidates/invite
 * @desc    HR invites candidates to a wave
 * @access  HR
 */
router.post("/:id/candidates/invite", validate(inviteCandidatesSchema), inviteCandidates);

/**
 * @route   PATCH /waves/:id/candidates/:waveCandidateId/status
 * @desc    HR updates candidate status in wave
 * @access  HR
 */
router.patch("/:id/candidates/:waveCandidateId/status", validate(updateWaveCandidateStatusSchema), updateWaveCandidateStatus);

/**
 * @route   DELETE /waves/:id/candidates/:waveCandidateId
 * @desc    HR removes a candidate from a wave
 * @access  HR
 */
router.delete("/:id/candidates/:waveCandidateId", removeWaveCandidate);

/**
 * @route   GET /waves/:id/analytics
 * @desc    HR gets wave analytics (fill rate, candidate status breakdown)
 * @access  HR
 */
router.get("/:id/analytics", getWaveAnalytics);

export default router;
