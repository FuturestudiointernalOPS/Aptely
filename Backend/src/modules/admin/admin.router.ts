import { Router } from "express";
import { authGuard, requireSuperAdmin } from "@/middleware/auth.middleware";
import { validateQuery } from "@/middleware/validate.middleware";
import { listUsersQuerySchema, listInstitutionsQuerySchema } from "./admin.schema";
import {
  getStats,
  getMetrics,
  getActivity,
  listUsers,
  getUserById,
  suspendUser,
  deleteUser,
  listInstitutions,
  getInstitutionById,
  deleteInstitution,
} from "./admin.controller";

export const adminRouter = Router();

// Toutes les routes /admin/* nécessitent un super admin authentifié.
// authGuard vérifie le JWT + charge req.user.isSuperAdmin
// requireSuperAdmin vérifie req.user.isSuperAdmin === true
adminRouter.use(authGuard, requireSuperAdmin);

// ─── Stats globales ───────────────────────────────────────────────────────────

/**
 * GET /admin/stats
 * Stats globales : nb users, institutions, candidatures, super admins
 */
adminRouter.get("/stats", getStats);
adminRouter.get("/metrics", getMetrics);
adminRouter.get("/activity", getActivity);

// ─── Gestion des utilisateurs ─────────────────────────────────────────────────

/**
 * GET /admin/users?page=1&limit=20&role=HR&search=alice
 * Liste tous les utilisateurs, filtrable et paginée
 */
adminRouter.get("/users", validateQuery(listUsersQuerySchema), listUsers);

/**
 * GET /admin/users/:id
 * Détail complet d'un utilisateur (profil + membership + talent DNA + candidatures)
 */
adminRouter.get("/users/:id", getUserById);

/**
 * PATCH /admin/users/:id/suspend
 * Suspendre ou réactiver un compte
 * Body: { "suspend": true | false }
 */
adminRouter.patch("/users/:id/suspend", suspendUser);

/**
 * DELETE /admin/users/:id
 * Supprimer définitivement un utilisateur (irréversible)
 */
adminRouter.delete("/users/:id", deleteUser);

// ─── Gestion des institutions ─────────────────────────────────────────────────

/**
 * GET /admin/institutions?page=1&limit=20&search=acme
 * Liste toutes les institutions, filtrable et paginée
 */
adminRouter.get("/institutions", validateQuery(listInstitutionsQuerySchema), listInstitutions);
adminRouter.get("/institutions/:id", getInstitutionById);
adminRouter.delete("/institutions/:id", deleteInstitution);
