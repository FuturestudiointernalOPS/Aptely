import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesQuerySchema,
} from "./employees.schema";
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  terminateEmployee,
  listReviews,
  createReview,
  updateReview,
  acknowledgeReview,
} from "./employees.controller";
import { createReviewSchema, updateReviewSchema } from "./employees.schema";

const router = Router();

router.use(authGuard);

router.get(
  "/",
  requirePermission("employees.view"),
  validateQuery(listEmployeesQuerySchema),
  listEmployees
);

router.get(
  "/:userId",
  requirePermission("employees.view"),
  getEmployee
);

router.post(
  "/",
  requirePermission("employees.manage"),
  validate(createEmployeeSchema),
  createEmployee
);

router.patch(
  "/:userId",
  requirePermission("employees.manage"),
  validate(updateEmployeeSchema),
  updateEmployee
);

router.delete(
  "/:userId",
  requirePermission("employees.manage"),
  terminateEmployee
);

// ─── Performance reviews ──────────────────────────────────────────────────────

router.get("/:userId/reviews", requirePermission("employees.view"), listReviews);

router.post(
  "/:userId/reviews",
  requirePermission("employees.manage"),
  validate(createReviewSchema),
  createReview
);

router.patch(
  "/:userId/reviews/:reviewId",
  requirePermission("employees.manage"),
  validate(updateReviewSchema),
  updateReview
);

router.patch(
  "/:userId/reviews/:reviewId/acknowledge",
  acknowledgeReview
);

export default router;
