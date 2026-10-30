import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import { matchRateLimiter } from "@/middleware/rateLimiter.middleware";
import { matchRoleSchema } from "./matching.schema";
import { matchRole } from "./matching.controller";

const router = Router();

// All matching routes require institution-level applications.view permission.
router.use(authGuard, requirePermission("applications.view"));

/**
 * @route   POST /match  (and GET)
 * @desc    Hint for clients that hit the wrong path (INV-019)
 * @access  HR
 */
router.all("/", (_req, res) => {
  res.status(404).json({
    error: "Not found. Use POST /match/role with body { roleId }.",
    path: "/match/role",
  });
});

/**
 * @route   POST /match/role
 * @desc    Run the AI matching engine for a role
 *          Returns ranked candidates with scores and AI explanations
 * @access  HR
 * @rateLimit matchRateLimiter (10 req/hour per IP)
 */
router.post("/role", matchRateLimiter, validate(matchRoleSchema), matchRole);

export default router;
