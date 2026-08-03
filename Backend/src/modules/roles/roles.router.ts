import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import {
  createRoleSchema,
  updateRoleSchema,
  updateRoleStatusSchema,
  updateRoleDnaSchema,
  listRolesQuerySchema,
  listRoleApplicationsQuerySchema,
} from "./roles.schema";
import {
  listRoles,
  createRole,
  getRoleById,
  updateRole,
  deleteRole,
  updateRoleStatus,
  getRoleShareLink,
  updateRoleDna,
  evaluateRole,
  getRoleApplications,
} from "./roles.controller";
import { getPublicRole, discoverRoles } from "./roles.public.controller";

const router = Router();

// ─── PUBLIC routes ────────────────────────────────────────────────────────
router.get("/public/discover", discoverRoles);
router.get("/public/:shareLink", getPublicRole);

// Toutes les routes /roles nécessitent d'être HR et authentifié
router.use(authGuard, requirePermission("applications.view"));

/**
 * @route   GET /roles
 * @desc    Liste les rôles de l'institution (filtres : status, search)
 * @access  HR
 */
router.get("/", validateQuery(listRolesQuerySchema), listRoles);

/**
 * @route   POST /roles
 * @desc    Créer un nouveau rôle (statut DRAFT par défaut)
 * @access  HR
 */
router.post("/", validate(createRoleSchema), createRole);

/**
 * @route   GET /roles/:id
 * @desc    Détail d'un rôle avec son Role DNA
 * @access  HR (institution owner)
 */
router.get("/:id", getRoleById);

/**
 * @route   PATCH /roles/:id
 * @desc    Mise à jour des métadonnées d'un rôle
 * @access  HR (institution owner)
 */
router.patch("/:id", validate(updateRoleSchema), updateRole);

/**
 * @route   DELETE /roles/:id
 * @desc    Supprimer un rôle (cascade : DNA, applications, match_results)
 * @access  HR roles.delete (OWNER/ADMIN par défaut)
 */
router.delete("/:id", requirePermission("roles.delete"), deleteRole);

/**
 * @route   PATCH /roles/:id/status
 * @desc    Changer le statut du rôle (ACTIVE | DRAFT | CLOSED | CANCELLED)
 * @access  HR (institution owner)
 */
router.patch("/:id/status", validate(updateRoleStatusSchema), updateRoleStatus);

/**
 * @route   GET /roles/:id/share-link
 * @desc    Retourne le share link du rôle
 * @access  HR (institution owner)
 */
router.get("/:id/share-link", getRoleShareLink);

/**
 * @route   PATCH /roles/:id/dna
 * @desc    Mettre à jour le Role DNA (mission, problèmes, contraintes...)
 * @access  HR (institution owner)
 */
router.patch("/:id/dna", validate(updateRoleDnaSchema), updateRoleDna);

/**
 * @route   POST /roles/:id/evaluate
 * @desc    Déclencher l'analyse IA pour toutes les candidatures PENDING
 * @access  HR (institution owner)
 */
router.post("/:id/evaluate", evaluateRole);

/**
 * @route   GET /roles/:id/applications
 * @desc    Liste les candidatures d'un rôle (avec matchScore si disponible)
 * @access  HR (institution owner)
 */
router.get(
  "/:id/applications",
  validateQuery(listRoleApplicationsQuerySchema),
  getRoleApplications
);

export { router as rolesRouter };
