import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  createOffboardingSchema,
  updateOffboardingSchema,
  addTaskSchema,
} from "./offboarding.schema";
import {
  getOffboarding,
  createOffboarding,
  updateOffboarding,
  toggleTask,
  addTask,
  deleteOffboarding,
} from "./offboarding.controller";

const router = Router();

router.use(authGuard);

router.get("/:userId", requirePermission("employees.view"), getOffboarding);

router.post(
  "/:userId",
  requirePermission("employees.manage"),
  validate(createOffboardingSchema),
  createOffboarding
);

router.patch(
  "/:userId",
  requirePermission("employees.manage"),
  validate(updateOffboardingSchema),
  updateOffboarding
);

router.patch(
  "/:userId/tasks/:taskId/toggle",
  requirePermission("employees.manage"),
  toggleTask
);

router.post(
  "/:userId/tasks",
  requirePermission("employees.manage"),
  validate(addTaskSchema),
  addTask
);

router.delete(
  "/:userId",
  requirePermission("employees.manage"),
  deleteOffboarding
);

export default router;
