import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { getDashboardStats, getRecentRoles, getRecentActivity } from "./hr-dashboard.controller";

import { getRecentApplications } from "./hr-dashboard.controller";

const router = Router();

// All dashboard routes require analytics.view in the active institution workspace.
const hrGuard = [authGuard, requirePermission("analytics.view")];

/**
 * @route   GET /hr/dashboard/stats
 * @desc    KPIs de l'institution : totalRoles, totalApplications, etc.
 * @access  HR
 */
router.get("/stats", ...hrGuard, getDashboardStats);

/**
 * @route   GET /hr/dashboard/recent-roles?limit=5
 * @desc    Derniers rôles créés par l'institution
 * @access  HR
 */
router.get("/recent-roles", ...hrGuard, getRecentRoles);

/**
 * @route   GET /hr/dashboard/recent-activity
 * @desc    Flux d'activité récente (rôles créés + candidatures reçues)
 * @access  HR
 */
router.get("/recent-activity", ...hrGuard, getRecentActivity);
router.get("/recent-applications", authGuard, requirePermission("analytics.view"), getRecentApplications);

export default router;
