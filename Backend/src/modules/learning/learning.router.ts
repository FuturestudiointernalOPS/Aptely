import { Router } from "express";
import { authGuard } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permissions.middleware";
import {
  listPlans,
  createPlan,
  getPlan,
  updatePlan,
  addActivity,
  updateActivity,
  deleteActivity,
  getSkillGaps,
  computeGaps,
  getLearningAnalytics,
  getMyPlan,
  updateMyActivity,
} from "./learning.controller";

const router = Router();

// All routes require auth
router.use(authGuard);

// Self-service — employee/candidate views & updates their own plan (no learning.manage needed)
router.get("/my-plan", getMyPlan);
router.patch("/my-plan/activities/:actId", updateMyActivity);

// Plans
router.get("/plans", requirePermission("learning.manage"), listPlans);
router.post("/plans", requirePermission("learning.manage"), createPlan);
router.get("/plans/:id", requirePermission("learning.manage"), getPlan);
router.patch("/plans/:id", requirePermission("learning.manage"), updatePlan);

// Activities
router.post("/plans/:id/activities", requirePermission("learning.manage"), addActivity);
router.patch("/plans/:id/activities/:actId", requirePermission("learning.manage"), updateActivity);
router.delete("/plans/:id/activities/:actId", requirePermission("learning.manage"), deleteActivity);

// Skill gaps
router.get("/skill-gaps/:userId", requirePermission("learning.manage"), getSkillGaps);
router.post("/skill-gaps/:userId/compute", requirePermission("learning.manage"), computeGaps);

// Analytics
router.get("/analytics", requirePermission("learning.manage"), getLearningAnalytics);

export default router;
