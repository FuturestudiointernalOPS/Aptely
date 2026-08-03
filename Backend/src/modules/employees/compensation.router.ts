import { Router } from "express";
import { authGuard } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permissions.middleware";
import {
  listSalaryBands, createSalaryBand, updateSalaryBand, deleteSalaryBand,
  getCompHistory, createCompReview, updateCompReview,
  getPendingApprovals, getCompAnalytics,
} from "./compensation.controller";

const router = Router();

router.use(authGuard);

// Salary bands
router.get("/bands", requirePermission("compensation.manage"), listSalaryBands);
router.post("/bands", requirePermission("compensation.manage"), createSalaryBand);
router.patch("/bands/:id", requirePermission("compensation.manage"), updateSalaryBand);
router.delete("/bands/:id", requirePermission("compensation.manage"), deleteSalaryBand);

// Compensation history & reviews
router.get("/pending-approvals", requirePermission("compensation.manage"), getPendingApprovals);
router.get("/analytics", requirePermission("compensation.manage"), getCompAnalytics);
router.get("/:userId/history", requirePermission("compensation.manage"), getCompHistory);
router.post("/:userId/review", requirePermission("compensation.manage"), createCompReview);
router.patch("/:userId/review/:id", requirePermission("compensation.manage"), updateCompReview);

export default router;
