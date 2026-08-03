import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import {
  getPhase2Overview,
  getPhase2Funnel,
  getPhase2TimeToHire,
  getHrHeadcount,
  getHrTurnover,
  getHrLeaveStats,
} from "./analytics.controller";

const router = Router();

router.get("/phase2/overview", authGuard, requirePermission("analytics.view"), getPhase2Overview);
router.get("/phase2/funnel", authGuard, requirePermission("analytics.view"), getPhase2Funnel);
router.get("/phase2/time-to-hire", authGuard, requirePermission("analytics.view"), getPhase2TimeToHire);

router.get("/hr/headcount", authGuard, requirePermission("analytics.view"), getHrHeadcount);
router.get("/hr/turnover", authGuard, requirePermission("analytics.view"), getHrTurnover);
router.get("/hr/leave-stats", authGuard, requirePermission("analytics.view"), getHrLeaveStats);

export default router;
