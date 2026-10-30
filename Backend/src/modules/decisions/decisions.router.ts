import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  createDecisionSchema,
  recommendDecisionSchema,
  ratifyDecisionSchema,
  decisionQueueQuerySchema,
} from "./decisions.schema";
import {
  createDecision,
  recommendDecision,
  decide,
  ratifyDecision,
  getDecisionQueue,
  getDecisionHistory,
  getDecisionState,
  getApplicationAuditLogs,
  getActionQueue,
} from "./decisions.controller";

const router = Router();

/**
 * @route   GET /decisions/queue
 * @desc    HR views the decision queue
 * @access  applications.decide
 */
router.get(
  "/queue",
  authGuard,
  requirePermission("applications.decide"),
  validateQuery(decisionQueueQuerySchema),
  getDecisionQueue
);

/**
 * @route   GET /decisions/action-queue
 * @desc    Returns pendingRecommendation, pendingDecision, pendingRatification lists (for HiringQueue)
 * @access  applications.decide
 */
router.get(
  "/action-queue",
  authGuard,
  requirePermission("applications.decide"),
  getActionQueue
);

/**
 * @route   POST /decisions/applications/:id
 * @desc    HR makes a single-step decision (legacy / simple flow)
 * @access  applications.decide
 */
router.post(
  "/applications/:id",
  authGuard,
  requirePermission("applications.decide"),
  validate(createDecisionSchema),
  createDecision
);

// ─── Phase F — Multi-step decision workflow ───────────────────────────────────

/**
 * @route   POST /decisions/applications/:id/recommend
 * @desc    Recruiter / Standard HR records a recommendation (does not change app status)
 * @access  applications.decide
 */
router.post(
  "/applications/:id/recommend",
  authGuard,
  requirePermission("applications.decide"),
  validate(recommendDecisionSchema),
  recommendDecision
);

/**
 * @route   POST /decisions/applications/:id/decide
 * @desc    Hiring Manager makes the binding decision (changes app status)
 * @access  applications.decide
 */
router.post(
  "/applications/:id/decide",
  authGuard,
  requirePermission("applications.decide"),
  validate(createDecisionSchema),
  decide
);

/**
 * @route   POST /decisions/applications/:id/ratify
 * @desc    HR Head ratifies an existing decision (adds ratification metadata)
 * @access  applications.decide
 */
router.post(
  "/applications/:id/ratify",
  authGuard,
  requirePermission("applications.decide"),
  validate(ratifyDecisionSchema),
  ratifyDecision
);

// ─── History + audit ──────────────────────────────────────────────────────────

/**
 * @route   GET /decisions/applications/:id/state
 * @desc    Returns current recommendation, decision, and ratification state
 * @access  applications.view (read) — mutations stay on applications.decide
 */
router.get(
  "/applications/:id/state",
  authGuard,
  requirePermission("applications.view"),
  getDecisionState
);

/**
 * @route   GET /decisions/applications/:id/history
 * @desc    Get full decision history (includes recommend/decide/ratify steps)
 * @access  applications.view (read)
 */
router.get(
  "/applications/:id/history",
  authGuard,
  requirePermission("applications.view"),
  getDecisionHistory
);

/**
 * @route   GET /decisions/applications/:id/audit-logs
 * @desc    Get full audit trail for an application
 * @access  applications.view (read)
 */
router.get(
  "/applications/:id/audit-logs",
  authGuard,
  requirePermission("applications.view"),
  getApplicationAuditLogs
);

export default router;
