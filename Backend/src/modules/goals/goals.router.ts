import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import {
  listGoals, createGoal, getGoal, updateGoal, deleteGoal,
  listKRs, createKR, updateKR, deleteKR,
  listTasks, createTask, updateTask, deleteTask,
  listRoles, assignRole, removeRole,
  validateGoal, commitGoal, launchGoal, completeGoal,
  getSession, updateSessionStep, getSessionResponses, addSessionResponse,
} from "./goals.controller";

const router = Router();

// All goals routes require auth
router.use(authGuard);

// ─── Goals CRUD ────────────────────────────────────────────────────────────────
router.get("/", requirePermission("goals.view"), listGoals);
router.post("/", requirePermission("goals.manage"), createGoal);
router.get("/:id", requirePermission("goals.view"), getGoal);
router.patch("/:id", requirePermission("goals.manage"), updateGoal);
router.delete("/:id", requirePermission("goals.manage"), deleteGoal);

// ─── Key Results ───────────────────────────────────────────────────────────────
router.get("/:id/key-results", requirePermission("goals.view"), listKRs);
router.post("/:id/key-results", requirePermission("goals.manage"), createKR);
router.patch("/:id/key-results/:krId", requirePermission("goals.manage"), updateKR);
router.delete("/:id/key-results/:krId", requirePermission("goals.manage"), deleteKR);

// ─── Tasks ─────────────────────────────────────────────────────────────────────
router.get("/:id/tasks", requirePermission("goals.view"), listTasks);
router.post("/:id/tasks", requirePermission("goals.manage"), createTask);
router.patch("/:id/tasks/:taskId", requirePermission("goals.manage"), updateTask);
router.delete("/:id/tasks/:taskId", requirePermission("goals.manage"), deleteTask);

// ─── PACI Roles ────────────────────────────────────────────────────────────────
router.get("/:id/roles", requirePermission("goals.view"), listRoles);
router.post("/:id/roles", requirePermission("goals.manage"), assignRole);
router.delete("/:id/roles/:roleId", requirePermission("goals.manage"), removeRole);

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
router.post("/:id/validate", authGuard, validateGoal);
router.post("/:id/commit", authGuard, commitGoal);
router.post("/:id/launch", requirePermission("goals.manage"), launchGoal);
router.post("/:id/complete", requirePermission("goals.manage"), completeGoal);

// ─── Live Session ──────────────────────────────────────────────────────────────
router.get("/:id/session", requirePermission("goals.view"), getSession);
router.patch("/:id/session/step", requirePermission("goals.manage"), updateSessionStep);
router.get("/:id/session/responses", requirePermission("goals.view"), getSessionResponses);
router.post("/:id/session/responses", authGuard, addSessionResponse);

export default router;
