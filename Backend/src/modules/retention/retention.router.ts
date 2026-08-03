import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { getDashboard, getEmployeeRisk, computeAll, getDigest } from "./retention.controller";

const router = Router();
router.use(authGuard);

router.get("/dashboard",      requirePermission("retention.view"), getDashboard);
router.get("/digest",         requirePermission("retention.view"), getDigest);
router.post("/compute",       requirePermission("retention.view"), computeAll);
router.get("/:userId",        requirePermission("retention.view"), getEmployeeRisk);

export default router;
