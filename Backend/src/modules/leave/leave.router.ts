import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  createLeaveRequestSchema,
  reviewLeaveRequestSchema,
  updatePoliciesSchema,
  listRequestsQuerySchema,
} from "./leave.schema";
import {
  listLeaveRequests,
  listMyLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveBalance,
  getLeavePolices,
  updateLeavePolices,
} from "./leave.controller";

const router = Router();

router.use(authGuard);

// HR — list all requests in institution
router.get(
  "/requests",
  requirePermission("employees.view"),
  validateQuery(listRequestsQuerySchema),
  listLeaveRequests
);

// Employee — own requests
router.get("/requests/me", listMyLeaveRequests);

// Employee — submit request
router.post(
  "/requests",
  validate(createLeaveRequestSchema),
  createLeaveRequest
);

// HR — approve / reject
router.patch(
  "/requests/:id/approve",
  requirePermission("employees.manage"),
  validate(reviewLeaveRequestSchema),
  approveLeaveRequest
);
router.patch(
  "/requests/:id/reject",
  requirePermission("employees.manage"),
  validate(reviewLeaveRequestSchema),
  rejectLeaveRequest
);

// Employee — cancel own pending request
router.delete("/requests/:id", cancelLeaveRequest);

// Balance — HR or self
router.get("/balance/:userId", getLeaveBalance);

// Policies
router.get("/policies", getLeavePolices);
router.patch(
  "/policies",
  requirePermission("settings.edit"),
  validate(updatePoliciesSchema),
  updateLeavePolices
);

export default router;
