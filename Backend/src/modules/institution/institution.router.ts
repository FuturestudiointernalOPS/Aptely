import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import {
  createInstitutionSchema,
  joinInstitutionSchema,
  updateInstitutionSchema,
  joinRequestActionSchema,
  updateMemberStatusSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
  createCustomRoleSchema,
  updateCustomRoleSchema,
  updateMemberRoleSpecializationSchema,
  personalSettingsSchema,
} from "./institution.schema";
import {
  createInstitution,
  joinInstitution,
  getInstitution,
  getPermissions,
  updateRolePermissions,
  updateInstitution,
  getMembers,
  leaveInstitution,
  removeMember,
  getJoinRequests,
  handleJoinRequest,
  deleteJoinRequest,
  updateMemberStatus,
  updateMemberRole,
  transferOwnership,
  getCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  updateMemberRoleSpecialization,
  deleteLogo,
  presignLogoUpload,
  setLogo,
  joinInstitutionBySearch,
  cancelJoinRequest,
  getPersonalSettings,
  updatePersonalSettings,
  createInviteLink,
  getInviteLinks,
  revokeInvite,
  regenerateInvite,
  getInviteInfo,
  joinByInvite,
  getMyMemberships,
  setActiveWorkspace,
  getMyPermissions,
  getMyModules,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getJobPositions,
  createJobPosition,
  updateJobPosition,
  deleteJobPosition,
  getMyAvailability,
  upsertMyAvailability,
  getMemberAvailability,
  getAvailabilityOverlap,
  updateOwnerLabel,
} from "./institution.controller";

const router = Router();

// Toutes les routes nécessitent un HR authentifié
// Most institution operations require members.manage. Each route below uses hrGuard
// for general institution access; sensitive ones (members, invites) layer in additional
// permissions.
const hrGuard = [authGuard, requirePermission("applications.view")];

/**
 * @route   POST /institution/create
 * @desc    HR creates a new institution (becomes OWNER)
 * @access  HR (without institution)
 */
router.post("/create", authGuard, validate(createInstitutionSchema), createInstitution);

/**
 * @route   GET /institution/memberships
 * @desc    List all institutions current user is a member of (for workspace switcher).
 * @access  Any authenticated user
 */
router.get("/memberships", authGuard, getMyMemberships);

/**
 * @route   PATCH /institution/me/active
 * @desc    Switch active workspace (set last_active_institution_id + sync JWT claims).
 * @access  Any authenticated user
 */
router.patch("/me/active", authGuard, setActiveWorkspace);

/**
 * @route   GET /institution/me/permissions
 * @desc    Get the caller's effective permissions in the active workspace.
 * @access  Any authenticated user
 */
router.get("/me/permissions", authGuard, getMyPermissions);

/**
 * @route   GET /institution/me/modules
 * @desc    Get active modules for the caller's active institution.
 * @access  Any authenticated user
 */
router.get("/me/modules", authGuard, getMyModules);

/**
 * @route   PATCH /institution/me/owner-label
 * @desc    Update the caller's own role_custom_label (no rank check — self-service)
 * @access  Any authenticated institution member
 */
router.patch("/me/owner-label", authGuard, updateOwnerLabel);

/**
 * GET /institution/me/departments
 * List departments for the active institution.
 */
router.get("/me/departments", authGuard, getDepartments);

/**
 * @route   POST /institution/join
 * @desc    HR joins an existing institution via join code
 * @access  HR (without institution)
 */
router.post("/join", authGuard, validate(joinInstitutionSchema), joinInstitution);

/**
 * @route   POST /institution/:institutionId/join-request
 * @desc    HR requests to join a specific institution by ID
 * @access  Authenticated (without institution)
 */
router.post("/:institutionId/join-request", authGuard, joinInstitutionBySearch);

/**
 * @route   DELETE /institution/:institutionId/join-request
 * @desc    HR cancels their pending join request
 * @access  HR (with pending request)
 *
 * Headers: Authorization: Bearer <accessToken>
 * Returns: { message, institutionId }
 */
router.delete("/:institutionId/join-request", authGuard, cancelJoinRequest);

/**
 * @route   POST /institution/leave
 * @desc    HR leaves their institution (with OWNER-only restriction)
 * @access  HR
 */
router.post("/leave", ...hrGuard, leaveInstitution);

/**
 * @route   GET /institution
 * @desc    Récupère les paramètres de l'institution du HR connecté
 * @access  HR
 */
router.get("/", ...hrGuard, getInstitution);

/**
 * @route   PATCH /institution
 * @desc    Met à jour les infos de l'institution (settings.edit)
 * @access  HR settings.edit
 */
router.patch(
  "/",
  authGuard,
  requirePermission("settings.edit"),
  validate(updateInstitutionSchema),
  updateInstitution
);

/**
 * @route   GET /institution/personal-settings
 * @desc    Returns the authenticated user's personal settings
 * @access  HR
 */
router.get("/personal-settings", ...hrGuard, getPersonalSettings);

/**
 * @route   PATCH /institution/personal-settings
 * @desc    Updates the authenticated user's personal settings
 * @access  HR
 */
router.patch(
  "/personal-settings",
  ...hrGuard,
  validate(personalSettingsSchema),
  updatePersonalSettings
);

/**
 * @route   GET /institution/members
 * @desc    Liste les membres actifs de l'institution
 * @access  HR
 */
router.get("/members", ...hrGuard, getMembers);

/**
 * @route   DELETE /institution/members/:userId
 * @desc    Retire un membre (members.remove, avec restrictions)
 * @access  HR members.remove
 */
router.delete("/members/:userId", authGuard, requirePermission("members.remove"), removeMember);

/**
 * @route   GET /institution/join-requests
 * @desc    Liste les demandes d'adhésion en attente (OWNER ou ADMIN)
 * @access  HR manager
 */
router.get("/join-requests", ...hrGuard, getJoinRequests);

/**
 * @route   PATCH /institution/join-requests/:userId
 * @desc    Accepte ou rejette une demande (OWNER ou ADMIN)
 *          body: { action: "ACCEPT" | "REJECT" }
 * @access  HR manager
 */
router.patch(
  "/join-requests/:userId",
  authGuard,
  requirePermission("members.invite"),
  validate(joinRequestActionSchema),
  handleJoinRequest
);

router.patch(
  "/members/:userId/status",
  authGuard,
  requirePermission("members.remove"),
  validate(updateMemberStatusSchema),
  updateMemberStatus
);

router.patch(
  "/members/:userId/role",
  authGuard,
  requirePermission("members.roles"),
  validate(updateMemberRoleSchema),
  updateMemberRole
);

// Transfer ownership — OWNER hands over to a member (atomic OWNER↔ADMIN swap).
router.post("/transfer-ownership", authGuard, validate(transferOwnershipSchema), transferOwnership);

// Backward-compat route kept temporarily for older clients.
router.patch(
  "/hr/:userId",
  authGuard,
  requirePermission("members.remove"),
  validate(updateMemberStatusSchema),
  updateMemberStatus
);

router.delete(
  "/requests/:requestId",
  authGuard,
  requirePermission("members.invite"),
  deleteJoinRequest
);
router.post("/settings/logo/presign", authGuard, requirePermission("settings.edit"), presignLogoUpload);
router.post("/settings/logo", authGuard, requirePermission("settings.edit"), setLogo);
router.delete("/settings/logo", authGuard, requirePermission("settings.edit"), deleteLogo);

// ─── Role permissions ─────────────────────────────────────────────────────────
router.get("/permissions", ...hrGuard, getPermissions);
router.put("/permissions/:role", ...hrGuard, updateRolePermissions);

// ─── Custom roles ─────────────────────────────────────────────────────────────
// Read = members.view (managers + HR_LEAD/STANDARD_HR); writes = members.roles.
router.get("/custom-roles", authGuard, requirePermission("members.view"), getCustomRoles);
router.post(
  "/custom-roles",
  authGuard,
  requirePermission("members.roles"),
  validate(createCustomRoleSchema),
  createCustomRole
);
router.patch(
  "/custom-roles/:id",
  authGuard,
  requirePermission("members.roles"),
  validate(updateCustomRoleSchema),
  updateCustomRole
);
router.delete("/custom-roles/:id", authGuard, requirePermission("members.roles"), deleteCustomRole);

// Assign a role_specialization (built-in or CUSTOM) to a member.
router.patch(
  "/members/:userId/role-specialization",
  authGuard,
  requirePermission("members.roles"),
  validate(updateMemberRoleSpecializationSchema),
  updateMemberRoleSpecialization
);

// ─── Invite links ─────────────────────────────────────────────────────────────
router.get("/invitations/public/:token", getInviteInfo);
router.post("/invitations/join/:token", authGuard, joinByInvite);
router.post("/invitations", authGuard, requirePermission("members.invite"), createInviteLink);
router.get("/invitations", ...hrGuard, getInviteLinks);
router.delete("/invitations/:id", authGuard, requirePermission("members.invite"), revokeInvite);
router.patch("/invitations/:id/regenerate", authGuard, requirePermission("members.invite"), regenerateInvite);

// ─── Departments ─────────────────────────────────────────────────────────────
router.get("/departments", authGuard, getDepartments);
router.post("/departments", authGuard, requirePermission("settings.edit"), createDepartment);
router.patch("/departments/:id", authGuard, requirePermission("settings.edit"), updateDepartment);
router.delete("/departments/:id", authGuard, requirePermission("settings.edit"), deleteDepartment);

// ─── Job Positions ────────────────────────────────────────────────────────────
router.get("/job-positions", authGuard, getJobPositions);
router.post("/job-positions", authGuard, requirePermission("settings.edit"), createJobPosition);
router.patch(
  "/job-positions/:id",
  authGuard,
  requirePermission("settings.edit"),
  updateJobPosition
);
router.delete(
  "/job-positions/:id",
  authGuard,
  requirePermission("settings.edit"),
  deleteJobPosition
);

// ─── Member availability ──────────────────────────────────────────────────────
router.get("/availability/me", authGuard, getMyAvailability);
router.put("/availability/me", authGuard, upsertMyAvailability);
router.get("/availability/overlap", authGuard, getAvailabilityOverlap);
router.get("/members/:userId/availability", authGuard, getMemberAvailability);

export default router;
