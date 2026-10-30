import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { getDashboardStats, getRecentRoles, getRecentActivity } from "./hr-dashboard.controller";

import { getRecentApplications } from "./hr-dashboard.controller";

const router = Router();

// Recruitment command-center KPIs — gated by applications.view (not analytics.view).
// Recruiters and hiring managers hold applications.view but not analytics.view;
// analytics.view stays reserved for /analytics/* (Phase 2 funnel + Phase 4 HR metrics).
const hrGuard = [authGuard, requirePermission("applications.view")];

/**
 * @route   GET /hr/dashboard/stats
 * @desc    KPIs de l'institution : totalRoles, totalApplications, etc.
 * @access  HR (applications.view — includes RECRUITER / HIRING_MANAGER)
 */
router.get("/stats", ...hrGuard, getDashboardStats);

/**
 * @route   GET /hr/dashboard/recent-roles?limit=5
 * @desc    Derniers rôles créés par l'institution
 * @access  HR (applications.view)
 */
router.get("/recent-roles", ...hrGuard, getRecentRoles);

/**
 * @route   GET /hr/dashboard/recent-activity
 * @desc    Flux d'activité récente (rôles créés + candidatures reçues)
 * @access  HR (applications.view)
 */
router.get("/recent-activity", ...hrGuard, getRecentActivity);
router.get("/recent-applications", ...hrGuard, getRecentApplications);

export default router;
