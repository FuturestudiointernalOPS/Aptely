import crypto from "crypto";
import { Response } from "express";
import { Resend } from "resend";
import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";
import { buildLogoPath } from "@/services/storage.service";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import { retryWithBackoff } from "@/utils/retry";
import { clearAuthCache } from "@/middleware/auth.middleware";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  expandAliases,
  roleRank,
} from "@/middleware/permissions.middleware";
import {
  getMembershipStatus,
  assertOwner,
  assertManager,
  checkPermission,
  countOwners,
  getEffectiveRole,
  rankOf,
  assertRankAuthority,
  resolveInstitutionId,
  DEFAULT_PERSONAL_SETTINGS,
} from "./institution.service";
export { checkPermission } from "./institution.service";

const resend = new Resend(env.RESEND_API_KEY);
import type {
  UpdateInstitutionInput,
  JoinRequestActionInput,
  CreateInstitutionInput,
  JoinInstitutionInput,
  PersonalSettingsInput,
  UpdateMemberRoleInput,
} from "./institution.schema";

// Invite codes/links to join an institution are rotated periodically so a leaked
// or screenshotted code doesn't stay valid forever.
const INVITE_ROTATION_DAYS = 30;

type InviteRow = {
  id: string;
  token: string;
  created_at: string;
  role_specialization: string | null;
  job_position_id: string | null;
  custom_label: string | null;
};

/** Revokes and regenerates an invite if it's older than the rotation window. Returns the (possibly new) row. */
async function rotateInviteIfStale(invite: InviteRow, institutionId: string, createdBy: string): Promise<InviteRow> {
  const rotationMs = INVITE_ROTATION_DAYS * 24 * 60 * 60 * 1000;
  const isStale = Date.now() - new Date(invite.created_at).getTime() > rotationMs;
  if (!isStale) return invite;

  await supabaseAdmin
    .from("institution_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invite.id);

  const newToken = crypto.randomBytes(16).toString("base64url");
  const { data: created, error } = await supabaseAdmin
    .from("institution_invitations")
    .insert({
      institution_id: institutionId,
      token: newToken,
      created_by: createdBy,
      role_specialization: invite.role_specialization ?? null,
      job_position_id: invite.job_position_id ?? null,
      custom_label: invite.custom_label ?? null,
    })
    .select("id, token, created_at, role_specialization, job_position_id, custom_label")
    .single();

  if (error || !created) throw new AppError(500, "Failed to rotate invite link");
  return created as InviteRow;
}

/** Legacy membership status that goes with a role (OWNER→OWNER, ADMIN→ADMIN, else ACTIVE). */
function statusForRole(role: string): "OWNER" | "ADMIN" | "ACTIVE" {
  return role === "OWNER" ? "OWNER" : role === "ADMIN" ? "ADMIN" : "ACTIVE";
}

/**
 * Sets the legacy profiles.institution_id only when the user has none, so managing a
 * member here never silently moves someone whose primary workspace is elsewhere.
 */
async function linkProfileIfUnbound(userId: string, institutionId: string): Promise<void> {
  await supabaseAdmin.from("profiles").update({ role: "HR" }).eq("id", userId);
  await supabaseAdmin
    .from("profiles")
    .update({ institution_id: institutionId })
    .eq("id", userId)
    .is("institution_id", null);
}

// Built-in roles an invite may carry. OWNER is only obtainable through
// transfer-ownership; CUSTOM needs a custom role id, which invites don't carry.
const INVITABLE_ROLES = ["ADMIN", "HR_LEAD", "STANDARD_HR", "HIRING_MANAGER", "RECRUITER", "MEMBER"];

/**
 * An invite grants its role to whoever opens it, so creating (or regenerating) a
 * role-scoped invite is the same as assigning that role: the actor must strictly
 * outrank it, exactly like PATCH /members/:userId/role-specialization.
 */
async function assertCanInviteAs(
  actorId: string,
  institutionId: string,
  role: string | null | undefined
): Promise<void> {
  if (!role) return;
  if (!INVITABLE_ROLES.includes(role)) throw new AppError(422, "Invalid invitation role");
  const actor = await getEffectiveRole(actorId, institutionId, supabaseAdmin);
  if (!actor) throw new AppError(403, "You are not a member of this institution");
  const actorRank = await rankOf(actor.role, actor.customRoleId, institutionId, supabaseAdmin);
  if (actorRank <= roleRank(role)) {
    throw new AppError(403, "You cannot invite someone at or above your own rank");
  }
}

// ─── POST /institution/create ─────────────────────────────────────────────────

export const createInstitution = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    // Post-refactor: any authenticated user can create an institution.
    // They become OWNER of the new institution. They can still belong to other institutions.
    // Only block if they already OWN one — owners can't create unlimited institutions
    // (anti-abuse + future billing).
    const { data: existingOwned } = await supabaseAdmin
      .from("institution_members")
      .select("institution_id")
      .eq("user_id", userId)
      .eq("role_specialization", "OWNER")
      .limit(1);

    if (existingOwned && existingOwned.length > 0) {
      throw new AppError(409, "You already own an institution. Leave or transfer ownership first.");
    }

    const body = req.body as CreateInstitutionInput;

    const { data: institution, error: instError } = await retryWithBackoff(
      async () =>
        supabaseAdmin
          .from("institutions")
          .insert({
            name: body.name,
            website: body.website ?? null,
            sector: body.sector ?? null,
            team_size: body.teamSize ?? null,
            stage: body.stage ?? null,
            location: body.location ?? null,
            description: body.description ?? null,
            logo_url: null,
          })
          .select("id, name")
          .single(),
      { maxRetries: 3, operation: "Create Institution" }
    );

    if (instError || !institution) {
      console.error(`[INSTITUTION] Failed to create institution: ${instError?.message}`);
      throw new AppError(500, "Failed to create institution");
    }

    // Set institution_id on profile only if user has none yet (legacy back-compat for HR users).
    // Post-refactor users skip this — workspace context tracks active institution separately.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, institution_id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: createProfileError } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: userEmail,
        full_name: userEmail.split("@")[0],
        institution_id: institution.id,
        last_active_institution_id: institution.id,
        role: "HR",
      });
      if (createProfileError) throw new AppError(500, "Failed to create user profile");
    } else {
      // Update last_active_institution_id; only set legacy institution_id if user had none.
      const updateFields: Record<string, unknown> = {
        last_active_institution_id: institution.id,
      };
      if (!existingProfile.institution_id) updateFields["institution_id"] = institution.id;
      updateFields["role"] = "HR";

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(updateFields)
        .eq("id", userId);

      if (profileError)
        throw new AppError(500, `Failed to update profile: ${profileError.message}`);
    }

    const ownerRoleLabel = (body.ownerRoleLabel ?? "").trim() || null;

    const { error: memberError } = await retryWithBackoff(
      async () =>
        supabaseAdmin.from("institution_members").insert({
          user_id: userId,
          institution_id: institution.id,
          status: "OWNER",
          role_specialization: "OWNER",
          created_via: "OWNER_CREATED",
          ...(ownerRoleLabel ? { role_custom_label: ownerRoleLabel } : {}),
        }),
      { maxRetries: 3, operation: `Add OWNER Member for ${userId}` }
    );

    if (memberError) {
      throw new AppError(500, "Failed to set institution owner");
    }

    // Sync JWT app_metadata.active_institution_id so subsequent requests use the new workspace.
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { active_institution_id: institution.id },
      });
    } catch (e) {
      console.warn("[Institution] Failed to sync JWT active_institution_id:", e);
    }

    clearAuthCache(userId);

    res.status(201).json({
      institutionId: institution.id,
      institutionName: institution.name,
    });
  }
);

// ─── POST /institution/join ───────────────────────────────────────────────────

export const joinInstitution = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    if (req.user!.institutionId) {
      throw new AppError(
        409,
        "You are already linked to an institution. Leave it first before joining another."
      );
    }

    const body = req.body as JoinInstitutionInput;

    const { data: institution, error: instError } = await retryWithBackoff(
      async () =>
        supabaseAdmin.from("institutions").select("id, name").eq("id", body.institutionId).single(),
      { maxRetries: 3, operation: "Find Institution by ID" }
    );

    if (instError || !institution) {
      throw new AppError(404, "Institution not found. Please double-check and try again.");
    }

    const { data: existingMember } = await retryWithBackoff(
      async () =>
        supabaseAdmin
          .from("institution_members")
          .select("id, status")
          .eq("user_id", userId)
          .eq("institution_id", institution.id)
          .maybeSingle(),
      { maxRetries: 2, operation: "Check Existing Membership" }
    );

    if (existingMember) {
      if (existingMember.status === "PENDING") {
        throw new AppError(409, "You already have a pending request to join this institution.");
      }
      if (["ACTIVE", "OWNER", "ADMIN"].includes(existingMember.status)) {
        throw new AppError(409, "You are already a member of this institution.");
      }
    }

    const { error: joinError } = await retryWithBackoff(
      async () =>
        supabaseAdmin.from("institution_members").insert({
          user_id: userId,
          institution_id: institution.id,
          status: "PENDING",
        }),
      { maxRetries: 3, operation: "Create Join Request" }
    );

    if (joinError) {
      throw new AppError(500, "Failed to submit join request");
    }

    res.status(201).json({
      message: "Join request submitted. Awaiting admin approval.",
      data: {
        institutionId: institution.id,
        institutionName: institution.name,
        status: "PENDING",
      },
    });
  }
);

// ─── GET /institution ─────────────────────────────────────────────────────────

export const getInstitution = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data, error } = await supabaseAdmin
      .from("institutions")
      .select(
        "id, name, website, sector, team_size, stage, location, description, logo_url, created_at, updated_at"
      )
      .eq("id", institutionId)
      .single();

    if (error || !data) throw new AppError(404, "Institution not found");

    res.status(200).json({ data });
  }
);

// ─── PATCH /institution ───────────────────────────────────────────────────────

export const updateInstitution = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    // Access is the route's requirePermission("settings.edit") — granted to OWNER and
    // ADMIN by default. An extra owner-only check here made the settings form (and
    // the logo/department/webhook settings it sits next to) fail for admins.

    const body = req.body as UpdateInstitutionInput;
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates["name"] = body.name;
    if (body.website !== undefined) updates["website"] = body.website;
    if (body.sector !== undefined) updates["sector"] = body.sector;
    if (body.teamSize !== undefined) updates["team_size"] = body.teamSize;
    if (body.stage !== undefined) updates["stage"] = body.stage;
    if (body.location !== undefined) updates["location"] = body.location;
    if (body.description !== undefined) updates["description"] = body.description;
    if (body.logoUrl !== undefined) updates["logo_url"] = body.logoUrl;

    if (Object.keys(updates).length === 0) {
      throw new AppError(422, "No fields to update");
    }

    // Use service role for the write; access is enforced by the route permission.
    const { data, error } = await supabaseAdmin
      .from("institutions")
      .update(updates)
      .eq("id", institutionId)
      .select(
        "id, name, website, sector, team_size, stage, location, description, logo_url, updated_at"
      )
      .single();

    if (error || !data) throw new AppError(500, "Failed to update institution");

    res.status(200).json({ data });
  }
);

// ─── GET/PATCH /institution/personal-settings ────────────────────────────────

export const getPersonalSettings = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("personal_settings_json")
      .eq("id", userId)
      .single();

    if (error || !data) throw new AppError(404, "Profile not found");

    const persisted =
      data.personal_settings_json && typeof data.personal_settings_json === "object"
        ? (data.personal_settings_json as Record<string, unknown>)
        : {};

    res.status(200).json({
      data: { ...DEFAULT_PERSONAL_SETTINGS, ...persisted },
    });
  }
);

export const updatePersonalSettings = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const input = req.body as PersonalSettingsInput;

    const payload = { ...DEFAULT_PERSONAL_SETTINGS, ...input };

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ personal_settings_json: payload })
      .eq("id", userId)
      .select("personal_settings_json")
      .single();

    if (error || !data) throw new AppError(500, "Failed to update personal settings");

    res.status(200).json({ data: data.personal_settings_json });
  }
);

// ─── GET /institution/members ─────────────────────────────────────────────────

export const getMembers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
    const offset = (page - 1) * limit;

    const { data, error } = await supabaseAdmin
      .from("institution_members")
      .select(
        `id, user_id, status, role_specialization, role_custom_label, custom_role_id, joined_at`
      )
      .eq("institution_id", institutionId)
      .in("status", ["OWNER", "ADMIN", "ACTIVE", "SUSPENDED"])
      .order("joined_at", { ascending: true });

    if (error) throw new AppError(500, "Failed to fetch members");

    // Fetch profiles separately — no FK constraint on user_id for Supabase join
    const userIds = (data ?? []).map((m) => m.user_id).filter(Boolean);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    let filtered = (data ?? []).map((member) => ({
      ...member,
      profiles: profileMap[member.user_id] ?? null,
    }));

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((member) => {
        const profile = (member as any).profiles as { full_name?: string; email?: string } | null;
        return (
          profile?.email?.toLowerCase().includes(q) || profile?.full_name?.toLowerCase().includes(q)
        );
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    res
      .status(200)
      .json({ data: paginated, meta: { total, page, limit, hasMore: offset + limit < total } });
  }
);

// ─── POST /institution/leave ──────────────────────────────────────────────────

export const leaveInstitution = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = req.user!.institutionId;

    if (!institutionId) throw new AppError(400, "You are not linked to any institution");

    const { data: member, error: memberError } = await supabaseAdmin
      .from("institution_members")
      .select("status")
      .eq("user_id", userId)
      .eq("institution_id", institutionId)
      .single();

    if (memberError || !member) throw new AppError(404, "Membership not found");

    if (member.status === "OWNER") {
      const count = await countOwners(institutionId, supabaseAdmin);
      if (count === 1) {
        throw new AppError(
          409,
          "You are the only OWNER of this institution. You must promote another OWNER before leaving."
        );
      }
    }

    // Service role needed to ensure cascade — also clears profile binding
    const { error: deleteError } = await supabaseAdmin
      .from("institution_members")
      .delete()
      .eq("user_id", userId)
      .eq("institution_id", institutionId);

    if (deleteError) throw new AppError(500, "Failed to leave institution");

    // Only unbind the legacy primary institution if it is the one being left.
    await supabaseAdmin
      .from("profiles")
      .update({ institution_id: null })
      .eq("id", userId)
      .eq("institution_id", institutionId);

    clearAuthCache(userId);

    res.status(200).json({ message: "You have successfully left the institution" });
  }
);

// ─── DELETE /institution/members/:userId ──────────────────────────────────────

export const removeMember = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const currentUserId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const targetUserId = req.params["userId"] as string;

    if (targetUserId === currentUserId) {
      throw new AppError(422, "Use POST /institution/leave to leave the institution");
    }

    // Use supabaseAdmin to bypass RLS for admin operations
    const targetStatus = await getMembershipStatus(targetUserId, institutionId, supabaseAdmin);
    if (!targetStatus) throw new AppError(404, "Membership not found");

    if (targetStatus === "OWNER") {
      throw new AppError(403, "The owner must transfer ownership before being removed");
    }
    // Rank guard: actor must strictly outrank the target (permission gated at route).
    await assertRankAuthority(currentUserId, targetUserId, institutionId, supabaseAdmin);

    // Service role needed to update another user's profile
    const { error } = await supabaseAdmin
      .from("institution_members")
      .delete()
      .eq("user_id", targetUserId)
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to remove member");

    await supabaseAdmin
      .from("profiles")
      .update({ institution_id: null })
      .eq("id", targetUserId)
      .eq("institution_id", institutionId);

    // Drop the cached membership so the removal applies to the very next request.
    clearAuthCache(targetUserId);

    res.status(200).json({ message: "Member removed successfully" });
  }
);

// ─── GET /institution/join-requests ──────────────────────────────────────────

export const getJoinRequests = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await assertManager(userId, institutionId, supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("institution_members")
      .select(`id, user_id, joined_at, status`)
      .eq("institution_id", institutionId)
      .eq("status", "PENDING")
      .order("joined_at", { ascending: true });

    if (error) throw new AppError(500, "Failed to fetch join requests");

    // Fetch profiles separately — no FK constraint on user_id
    const userIds = (data ?? []).map((row) => row.user_id).filter(Boolean);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds);
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    const normalized = (data ?? []).map((row) => ({
      ...row,
      profiles: profileMap[row.user_id] ?? null,
    }));

    res.status(200).json({ data: normalized });
  }
);

// ─── PATCH /institution/join-requests/:userId ─────────────────────────────────

export const handleJoinRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const currentUserId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await assertManager(currentUserId, institutionId, supabaseAdmin);

    const targetUserId = req.params["userId"] as string;
    const { action } = req.body as JoinRequestActionInput;

    const { data: joinReq, error: fetchError } = await supabaseAdmin
      .from("institution_members")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("institution_id", institutionId)
      .eq("status", "PENDING")
      .single();

    if (fetchError || !joinReq) throw new AppError(404, "Join request not found");

    if (action === "ACCEPT") {
      // Service role needed — updating another user's profile
      await linkProfileIfUnbound(targetUserId, institutionId);

      // Pending rows carry no role; give the canonical MEMBER role like invite joins do.
      const { error: updateMemberError } = await supabaseAdmin
        .from("institution_members")
        .update({ status: "ACTIVE", role_specialization: "MEMBER" })
        .eq("id", joinReq.id);

      if (updateMemberError) throw new AppError(500, "Failed to add user to institution members");

      clearAuthCache(targetUserId);
      res.status(200).json({ message: "Join request accepted" });
    } else if (action === "REJECT") {
      const { error: deleteError } = await supabaseAdmin
        .from("institution_members")
        .delete()
        .eq("id", joinReq.id);

      if (deleteError) throw new AppError(500, "Failed to reject join request");

      res.status(200).json({ message: "Join request rejected" });
    } else {
      throw new AppError(400, "Invalid action. Must be 'ACCEPT' or 'REJECT'");
    }
  }
);

export const deleteJoinRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const requestId = req.params["requestId"] as string;
    const currentUserId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await assertManager(currentUserId, institutionId, supabaseAdmin);

    const { error } = await supabaseAdmin
      .from("institution_members")
      .delete()
      .eq("id", requestId)
      .eq("institution_id", institutionId)
      .eq("status", "PENDING");

    if (error) throw new AppError(500, "Failed to delete join request");

    res.status(200).json({ requestId, status: "DELETED" });
  }
);

export const updateMemberStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.params["userId"] as string;
    const { status } = req.body as { status: "ACTIVE" | "SUSPENDED" };
    const currentUserId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const target = await getEffectiveRole(userId, institutionId, supabaseAdmin);
    if (!target) throw new AppError(404, "Membership not found");

    if (target.status === "OWNER") {
      throw new AppError(403, "Owner status can only be changed through role management");
    }
    if (target.status === "PENDING") {
      throw new AppError(422, "Pending join requests must be accepted or rejected");
    }
    // Rank guard: actor must strictly outrank the target (permission gated at route).
    await assertRankAuthority(currentUserId, userId, institutionId, supabaseAdmin);

    // Reactivating restores the status that matches the member's role — an ADMIN
    // must come back as ADMIN, not as a plain ACTIVE member.
    const nextStatus = status === "SUSPENDED" ? "SUSPENDED" : statusForRole(target.role);

    // Service role needed — modifies another user's membership + profile
    const { error } = await supabaseAdmin
      .from("institution_members")
      .update({ status: nextStatus })
      .eq("user_id", userId)
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to update member status");

    if (nextStatus === "SUSPENDED") {
      await supabaseAdmin
        .from("profiles")
        .update({ institution_id: null })
        .eq("id", userId)
        .eq("institution_id", institutionId);
    } else {
      await linkProfileIfUnbound(userId, institutionId);
    }

    clearAuthCache(userId);
    res.status(200).json({ userId, status: nextStatus });
  }
);

export const updateMemberRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const targetUserId = req.params["userId"] as string;
    const { role } = req.body as UpdateMemberRoleInput;
    const currentUserId = req.user!.id;
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await assertOwner(currentUserId, institutionId, supabaseAdmin);

    const targetStatus = await getMembershipStatus(targetUserId, institutionId, supabaseAdmin);
    if (!targetStatus) throw new AppError(404, "Membership not found");
    if (targetStatus === "PENDING")
      throw new AppError(422, "Cannot assign role while membership is pending");

    if (targetUserId === currentUserId && role !== "OWNER") {
      const owners = await countOwners(institutionId, supabaseAdmin);
      if (owners <= 1)
        throw new AppError(409, "You are the only OWNER. Promote another owner first.");
    }

    if (targetStatus === "OWNER" && role !== "OWNER") {
      const owners = await countOwners(institutionId, supabaseAdmin);
      if (owners <= 1) throw new AppError(409, "You cannot demote the only OWNER.");
    }

    // A role change must not lift a suspension.
    const newStatus = targetStatus === "SUSPENDED" ? "SUSPENDED" : statusForRole(role);
    const { error } = await supabaseAdmin
      .from("institution_members")
      .update({ status: newStatus, role_specialization: role })
      .eq("user_id", targetUserId)
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to update member role");

    if (newStatus !== "SUSPENDED") await linkProfileIfUnbound(targetUserId, institutionId);

    clearAuthCache(targetUserId);
    res.status(200).json({ userId: targetUserId, role });
  }
);

// ─── POST /institution/transfer-ownership ─────────────────────────────────────
// Atomic swap: the new owner becomes OWNER, the current owner becomes ADMIN.
export const transferOwnership = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const currentUserId = req.user!.id;
    const institutionId = req.user!.activeInstitutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { newOwnerUserId } = req.body as { newOwnerUserId: string };

    await assertOwner(currentUserId, institutionId, supabaseAdmin);

    if (newOwnerUserId === currentUserId) {
      throw new AppError(400, "You already own this institution");
    }

    const targetStatus = await getMembershipStatus(newOwnerUserId, institutionId, supabaseAdmin);
    if (!targetStatus) throw new AppError(404, "Target user is not a member of this institution");
    if (targetStatus === "PENDING" || targetStatus === "SUSPENDED") {
      throw new AppError(422, "Target member must be active to receive ownership");
    }

    const { error } = await supabaseAdmin.rpc("transfer_institution_ownership", {
      p_institution: institutionId,
      p_current: currentUserId,
      p_new: newOwnerUserId,
    });
    if (error) throw new AppError(500, error.message || "Failed to transfer ownership");

    // Both members' effective roles changed — refresh their cached auth profiles.
    clearAuthCache(currentUserId);
    clearAuthCache(newOwnerUserId);

    res.status(200).json({ newOwnerUserId, previousOwnerUserId: currentUserId });
  }
);

const LOGO_EXTS = ["jpg", "jpeg", "png", "webp"];

export const presignLogoUpload = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Access: route-level requirePermission("settings.edit").
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { fileName } = req.body as { fileName?: string };
    if (!fileName || typeof fileName !== "string") {
      throw new AppError(400, "fileName is required");
    }
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!LOGO_EXTS.includes(ext)) {
      throw new AppError(415, "Only JPG, PNG or WEBP images are allowed");
    }

    const path = buildLogoPath(institutionId, fileName);
    const { data, error } = await supabaseAdmin.storage
      .from("logos")
      .createSignedUploadUrl(path);

    if (error || !data) throw new AppError(500, "Failed to create upload URL");
    res.status(200).json({ signedUrl: data.signedUrl, token: data.token, path });
  }
);

export const setLogo = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Access: route-level requirePermission("settings.edit").
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { path } = req.body as { path?: string };
    if (!path || typeof path !== "string") throw new AppError(400, "path is required");
    // The logo path is prefixed with the institution's id — reject paths that aren't theirs.
    if (!path.includes(institutionId)) throw new AppError(403, "Invalid logo path");

    const { data: pub } = supabaseAdmin.storage.from("logos").getPublicUrl(path);
    const logoUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error } = await supabaseAdmin
      .from("institutions")
      .update({ logo_url: logoUrl })
      .eq("id", institutionId);

    if (error) throw new AppError(500, "Failed to save logo");
    res.status(200).json({ logoUrl });
  }
);

export const deleteLogo = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Access: route-level requirePermission("settings.edit").
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data: institution } = await supabaseAdmin
      .from("institutions")
      .select("logo_url")
      .eq("id", institutionId)
      .single();

    if (institution?.logo_url) {
      const storagePath = institution.logo_url.split("/logos/")[1];
      if (storagePath) {
        await supabaseAdmin.storage.from("logos").remove([storagePath]);
      }
    }

    await supabaseAdmin.from("institutions").update({ logo_url: null }).eq("id", institutionId);

    res.json({ status: "LOGO_REMOVED" });
  }
);

// ─── GET /institution/search ──────────────────────────────────────────────────

// ─── POST /institution/:institutionId/join-request ────────────────────────────

export const joinInstitutionBySearch = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const param = String(req.params.institutionId ?? "");

    if (req.user!.institutionId) throw new AppError(400, "User already has an institution");

    // `param` may be an institution UUID (search-by-id flow) OR an invitation
    // token/code entered manually. Resolve invite tokens to their institution.
    let institutionId = param;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
    if (!isUuid) {
      const { data: invite } = await supabaseAdmin
        .from("institution_invitations")
        .select("institution_id")
        .eq("token", param)
        .is("revoked_at", null)
        .maybeSingle();
      if (!invite?.institution_id) {
        throw new AppError(404, "Invalid or revoked invite code");
      }
      institutionId = invite.institution_id as string;
    }

    const { data: institution, error: instError } = await supabaseAdmin
      .from("institutions")
      .select("id, name")
      .eq("id", institutionId)
      .single();

    if (instError || !institution) throw new AppError(404, "Institution not found");

    const { data: existingRequest } = await supabaseAdmin
      .from("institution_members")
      .select("id")
      .eq("user_id", userId)
      .eq("institution_id", institutionId)
      .eq("status", "PENDING");

    if (existingRequest && existingRequest.length > 0) {
      throw new AppError(400, "You already have a pending request for this institution");
    }

    const { data: joinRequest, error: createError } = await supabaseAdmin
      .from("institution_members")
      .insert({ user_id: userId, institution_id: institutionId, status: "PENDING" })
      .select()
      .single();

    if (createError) throw new AppError(500, `Error creating join request: ${createError.message}`);

    // Set role early so re-login redirects to HR onboarding, not candidate
    await supabaseAdmin.from("profiles").update({ role: "HR" }).eq("id", userId);

    res.json({
      institutionId,
      institutionName: institution.name,
      requestId: joinRequest.id,
      status: "PENDING",
    });
  }
);

// ─── DELETE /institution/:institutionId/join-request ──────────────────────────

export const cancelJoinRequest = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { institutionId } = req.params;

    const { error: deleteError, data: deletedData } = await supabaseAdmin
      .from("institution_members")
      .delete()
      .eq("user_id", userId)
      .eq("institution_id", institutionId)
      .eq("status", "PENDING")
      .select()
      .single();

    if (deleteError)
      throw new AppError(500, `Error canceling join request: ${deleteError.message}`);
    if (!deletedData) throw new AppError(404, "No pending join request found for this institution");

    res.json({ message: "Join request canceled successfully", institutionId });
  }
);

// ─── POST /institution/invitations ───────────────────────────────────────────

export const createInviteLink = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");
    // Access: route-level requirePermission("members.invite").

    const { data: institution } = await supabaseAdmin
      .from("institutions")
      .select("id, name, logo_url")
      .eq("id", user.institutionId)
      .single();

    if (!institution) throw new AppError(404, "Institution not found");

    const {
      email: recipientEmail,
      roleSpecialization,
      jobPositionId,
      customLabel,
    } = req.body as {
      email?: string;
      roleSpecialization?: string;
      jobPositionId?: string;
      customLabel?: string;
    };

    await assertCanInviteAs(user.id, user.institutionId, roleSpecialization);
    if (jobPositionId) {
      const { data: position } = await supabaseAdmin
        .from("job_positions")
        .select("id")
        .eq("id", jobPositionId)
        .eq("institution_id", user.institutionId)
        .maybeSingle();
      if (!position) throw new AppError(404, "Job position not found");
    }

    // Each role+position combo gets its own token (never reuse across roles)
    let query = supabaseAdmin
      .from("institution_invitations")
      .select("id, token, created_at, role_specialization, job_position_id, custom_label")
      .eq("institution_id", user.institutionId)
      .is("revoked_at", null);

    if (roleSpecialization) {
      query = query.eq("role_specialization", roleSpecialization);
    } else {
      query = query.is("role_specialization", null);
    }
    if (jobPositionId) {
      query = query.eq("job_position_id", jobPositionId);
    } else {
      query = query.is("job_position_id", null);
    }

    const { data: found } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let existing: InviteRow | null = found as InviteRow | null;
    if (existing) {
      existing = await rotateInviteIfStale(existing, user.institutionId, user.id);
    }

    if (!existing) {
      const token = crypto.randomBytes(16).toString("base64url");
      const { data: created, error } = await supabaseAdmin
        .from("institution_invitations")
        .insert({
          institution_id: user.institutionId,
          token,
          created_by: user.id,
          role_specialization: roleSpecialization ?? null,
          job_position_id: jobPositionId ?? null,
          custom_label: customLabel ?? null,
        })
        .select("id, token, created_at, role_specialization, job_position_id, custom_label")
        .single();
      if (error || !created) throw new AppError(500, "Failed to create invite link");
      existing = created as InviteRow;
    }

    const inviteUrl = `${env.FRONTEND_URL}/join/${existing.token}`;
    // Use the full token as the shareable code. A truncated/upper-cased prefix is
    // lossy and cannot be resolved back to the invitation, which made the manual
    // "enter code" join flow always fail.
    const inviteCode = existing.token;
    if (recipientEmail) {
      try {
        const { error: inviteEmailError } = await resend.emails.send({
          from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
          to: recipientEmail,
          subject: `Vous êtes invité à rejoindre ${institution.name} sur Aptely`,
          html: `
            <div style="background:#0f1117;padding:32px 0;font-family:sans-serif;">
              <div style="max-width:520px;margin:0 auto;background:#1a1d2e;border-radius:12px;padding:40px;color:#f0f0f0;">
                <div style="text-align:center;margin-bottom:28px;">
                  <span style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#FF6B00;">Aptely</span>
                </div>
                <h2 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#ffffff;">Vous êtes invité à rejoindre ${institution.name}</h2>
                <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 12px;">
                  Utilisez ce code pour rejoindre <strong style="color:#ffffff;">${institution.name}</strong> sur Aptely :
                </p>
                <div style="text-align:center;margin:16px 0 24px;">
                  <span style="display:inline-block;background:#1a1d2e;border:2px dashed #FF6B00;color:#FF6B00;padding:16px 28px;border-radius:8px;font-size:24px;font-weight:900;letter-spacing:6px;font-family:monospace;">${inviteCode}</span>
                </div>
                <div style="text-align:center;margin:28px 0;">
                  <a href="${env.FRONTEND_URL}/register?token=${existing.token}" style="display:inline-block;background:#FF6B00;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
                    Rejoindre l'institution
                  </a>
                </div>
                <p style="color:#6b7280;font-size:12px;margin:24px 0 0;">Ou copiez ce lien : ${inviteUrl}</p>
                <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Si vous n'attendiez pas cette invitation, ignorez cet email.</p>
              </div>
            </div>
          `,
          text: `Vous êtes invité à rejoindre ${institution.name} sur Aptely.\n\nCode d'invitation : ${inviteCode}\n\nRejoindre ici : ${inviteUrl}`,
        });
        if (inviteEmailError) {
          console.error("[INVITE] Failed to send invite email:", inviteEmailError.message);
          // Don't throw — the invite link was created — but inform the frontend
          res.status(201).json({
            data: {
              inviteUrl,
              token: existing.token,
              inviteCode,
              institutionName: institution.name,
              emailSent: false,
              emailError:
                "L'email n'a pas pu être délivré. Utilisez le lien d'invitation à la place.",
            },
          });
          return;
        }
      } catch (sendErr) {
        console.error("[INVITE] Resend threw:", sendErr);
        res.status(201).json({
          data: {
            inviteUrl,
            token: existing.token,
            inviteCode,
            institutionName: institution.name,
            emailSent: false,
            emailError: "L'envoi d'email a échoué. Utilisez le lien d'invitation à la place.",
          },
        });
        return;
      }
    }

    res.status(201).json({
      data: {
        inviteUrl,
        token: existing.token,
        inviteCode,
        institutionName: institution.name,
        emailSent: !!recipientEmail,
      },
    });
  }
);

// ─── GET /institution/invitations ────────────────────────────────────────────

export const getInviteLinks = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    // Only the canonical, unscoped invite (no role / job-position) is returned so the
    // code shown in Settings always matches the generic "copy link/code" buttons in the
    // Équipe page and the code sent by email. Role-scoped invites are targeted, not shown here.
    const { data, error } = await supabaseAdmin
      .from("institution_invitations")
      .select("id, token, created_by, created_at, revoked_at, role_specialization, job_position_id, custom_label")
      .eq("institution_id", user.institutionId)
      .is("revoked_at", null)
      .is("role_specialization", null)
      .is("job_position_id", null)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch invitations");

    // The canonical (most recent, unscoped) invite is rotated here too, so the code
    // shown in Settings is never older than the rotation window even if no one
    // clicked "generate" recently.
    const rows = data ?? [];
    const canonical = rows[0]
      ? await rotateInviteIfStale(rows[0] as InviteRow, user.institutionId, rows[0].created_by ?? user.id)
      : null;

    const invites = rows.map((inv, i) => {
      const row = i === 0 && canonical ? canonical : inv;
      return {
        id: row.id,
        token: row.token,
        inviteUrl: `${env.FRONTEND_URL}/join/${row.token}`,
        createdAt: row.created_at,
      };
    });

    res.status(200).json({ data: invites });
  }
);

// ─── DELETE /institution/invitations/:id ─────────────────────────────────────

export const revokeInvite = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    // Access: route-level requirePermission("members.invite").

    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("institution_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("institution_id", user.institutionId);

    if (error) throw new AppError(500, "Failed to revoke invite");
    res.status(200).json({ message: "Invite link revoked" });
  }
);

export const regenerateInvite = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    // Access: route-level requirePermission("members.invite").

    const { id } = req.params;

    // Get the existing invite to preserve its role/position settings
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("institution_invitations")
      .select("id, role_specialization, job_position_id, custom_label")
      .eq("id", id)
      .eq("institution_id", user.institutionId)
      .is("revoked_at", null)
      .single();

    if (fetchErr || !existing) throw new AppError(404, "Active invite not found");
    // Regenerating hands out a fresh token carrying the same role.
    await assertCanInviteAs(user.id, user.institutionId, existing.role_specialization as string | null);

    // Revoke the old token
    await supabaseAdmin
      .from("institution_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    // Create a new token preserving the same role/position
    const newToken = crypto.randomBytes(16).toString("base64url");
    const { data: created, error: createErr } = await supabaseAdmin
      .from("institution_invitations")
      .insert({
        institution_id: user.institutionId,
        token: newToken,
        created_by: user.id,
        role_specialization: existing.role_specialization ?? null,
        job_position_id: existing.job_position_id ?? null,
        custom_label: existing.custom_label ?? null,
      })
      .select("id, token")
      .single();

    if (createErr || !created) throw new AppError(500, "Failed to create new invite link");

    const inviteUrl = `${env.FRONTEND_URL}/join/${created.token}`;
    const inviteCode = created.token;

    res.status(200).json({
      data: {
        id: created.id,
        inviteUrl,
        token: created.token,
        inviteCode,
        message: "Invite link regenerated — old link is now invalid.",
      },
    });
  }
);

// ─── GET /institution/invitations/public/:token (no auth) ────────────────────

export const getInviteInfo = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { token } = _req.params;

    const { data, error } = await supabaseAdmin
      .from("institution_invitations")
      .select(
        "id, institution_id, role_specialization, job_position_id, custom_label, institutions(name, logo_url)"
      )
      .eq("token", token)
      .is("revoked_at", null)
      .maybeSingle();

    if (error || !data) throw new AppError(404, "Invalid or revoked invite link");

    const inst = Array.isArray(data.institutions)
      ? data.institutions[0]
      : (data.institutions as any);
    const inviteData = data as any;

    // Resolve job position title if present
    let jobPositionTitle: string | null = null;
    if (inviteData.job_position_id) {
      const { data: jp } = await supabaseAdmin
        .from("job_positions")
        .select("title")
        .eq("id", inviteData.job_position_id)
        .maybeSingle();
      jobPositionTitle = jp?.title ?? null;
    }

    res.status(200).json({
      data: {
        institutionId: data.institution_id,
        institutionName: inst?.name || "Unknown",
        logoUrl: inst?.logo_url || null,
        roleSpecialization: inviteData.role_specialization ?? null,
        jobPositionId: inviteData.job_position_id ?? null,
        jobPositionTitle,
        customLabel: inviteData.custom_label ?? null,
      },
    });
  }
);

// ─── POST /institution/invitations/join/:token ───────────────────────────────

export const joinByInvite = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const { token } = req.params;

    if (user.institutionId) throw new AppError(409, "You are already linked to an institution");

    const { data: invite, error } = await supabaseAdmin
      .from("institution_invitations")
      .select(
        "id, institution_id, role_specialization, job_position_id, custom_label, institutions(name)"
      )
      .eq("token", token)
      .is("revoked_at", null)
      .maybeSingle();

    if (error || !invite) throw new AppError(404, "Invalid or revoked invite link");

    const institutionId = invite.institution_id;
    // Never honour a role an invite may not carry (e.g. legacy OWNER-scoped rows).
    const rawInviteRole = ((invite as any).role_specialization as string | null) ?? null;
    const inviteRole = rawInviteRole && INVITABLE_ROLES.includes(rawInviteRole) ? rawInviteRole : null;
    const inviteJobPositionId = (invite as any).job_position_id ?? null;

    // Check not already a member
    const { data: existing } = await supabaseAdmin
      .from("institution_members")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("institution_id", institutionId)
      .maybeSingle();

    const memberFields = {
      // ADMIN invites must land with the ADMIN status (manager checks read it).
      status: statusForRole(inviteRole || "MEMBER"),
      // Canonical (no-role) invites default the member to MEMBER. Without this the
      // column stays null and role resolution falls back to the status "ACTIVE",
      // which is not a valid RBAC rank. Role-scoped invites keep their role.
      role_specialization: inviteRole || "MEMBER",
      ...(inviteJobPositionId ? { job_position_id: inviteJobPositionId } : {}),
    };

    if (existing) {
      if (["ACTIVE", "OWNER", "ADMIN"].includes(existing.status)) {
        throw new AppError(409, "You are already a member of this institution");
      }
      // Upgrade pending request to ACTIVE + assign role from invite
      const { error: memberUpdateError } = await supabaseAdmin
        .from("institution_members")
        .update(memberFields)
        .eq("user_id", user.id)
        .eq("institution_id", institutionId);

      if (memberUpdateError) throw new AppError(500, "Failed to join institution");
    } else {
      const { error: memberInsertError } = await supabaseAdmin.from("institution_members").insert({
        user_id: user.id,
        institution_id: institutionId,
        ...memberFields,
      });

      if (memberInsertError) throw new AppError(500, "Failed to join institution");
    }

    // Sync profile
    await supabaseAdmin
      .from("profiles")
      .update({ institution_id: institutionId, role: "HR" })
      .eq("id", user.id);

    // Sync JWT claims
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        institution_id: institutionId,
        active_institution_id: institutionId,
        is_super_admin: false,
      },
    });

    clearAuthCache(user.id);

    const inst = Array.isArray(invite.institutions)
      ? invite.institutions[0]
      : (invite.institutions as any);

    res.status(200).json({
      message: "Successfully joined institution",
      data: { institutionId, institutionName: inst?.name || "Institution" },
    });
  }
);

// ─── GET /institution/permissions ────────────────────────────────────────────

export const getPermissions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data, error } = await supabaseAdmin
      .from("institution_role_permissions")
      .select("role, permission, granted")
      .eq("institution_id", user.institutionId)
      .order("role");

    if (error) throw new AppError(500, "Failed to fetch permissions");

    // Build grouped result with per-role defaults filled in for every editable role.
    // expandAliases turns the legacy members.manage umbrella into granular members.*.
    const toPermMap = (perms: string[]): Record<string, boolean> =>
      Object.fromEntries(Array.from(expandAliases(new Set(perms))).map((p) => [p, true]));

    // Editable built-in roles (OWNER is omitted — always full, never configurable).
    const EDITABLE_ROLES = [
      "ADMIN",
      "HR_LEAD",
      "STANDARD_HR",
      "HIRING_MANAGER",
      "RECRUITER",
      "MEMBER",
    ];
    const grouped: Record<string, Record<string, boolean>> = {};
    for (const r of EDITABLE_ROLES) {
      grouped[r] = toPermMap(DEFAULT_PERMISSIONS[r] ?? []);
    }
    // Overlay DB custom config (takes precedence over defaults).
    for (const row of data ?? []) {
      if (!grouped[row.role]) grouped[row.role] = {};
      grouped[row.role][row.permission] = row.granted;
    }

    // A member only sees the permissions of roles strictly below their own rank
    // (same rule as editing): an HR lead must not read what the admin can do.
    const actor = await getEffectiveRole(user.id, user.institutionId, supabaseAdmin);
    if (!actor) throw new AppError(403, "You are not a member of this institution");
    const actorRank = await rankOf(actor.role, actor.customRoleId, user.institutionId, supabaseAdmin);
    for (const key of Object.keys(grouped)) {
      const rank = EDITABLE_ROLES.includes(key)
        ? roleRank(key)
        : await rankOf("CUSTOM", key, user.institutionId, supabaseAdmin);
      if (rank >= actorRank) delete grouped[key];
    }

    // Return flat object (not wrapped in { data }) so frontend can use it directly
    res.status(200).json(grouped);
  }
);

// ─── PUT /institution/permissions/:role ──────────────────────────────────────

export const updateRolePermissions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    if (!user.institutionId) throw new AppError(403, "You are not linked to any institution");

    // OWNER bypasses; ADMIN/others need members.roles. checkPermission throws on denial.
    await checkPermission(user.id, user.institutionId, "members.roles", supabaseAdmin);

    const { role } = req.params as { role: string };
    const EDITABLE_ROLES = [
      "ADMIN",
      "HR_LEAD",
      "STANDARD_HR",
      "HIRING_MANAGER",
      "RECRUITER",
      "MEMBER",
    ];
    if (!EDITABLE_ROLES.includes(role)) {
      throw new AppError(
        400,
        `Cannot configure permissions for "${role}". Editable roles: ${EDITABLE_ROLES.join(", ")}`
      );
    }

    // Same rank rule as custom roles: only strictly lower roles can be configured, so
    // an ADMIN cannot rewrite the ADMIN role (its own and its peers' permissions).
    const actor = await getEffectiveRole(user.id, user.institutionId, supabaseAdmin);
    if (!actor) throw new AppError(403, "You are not a member of this institution");
    const actorRank = await rankOf(actor.role, actor.customRoleId, user.institutionId, supabaseAdmin);
    if (actorRank <= roleRank(role)) {
      throw new AppError(403, "You cannot configure a role at or above your own rank");
    }

    const permissions = req.body as Record<string, boolean>;
    // Source of truth = ALL_PERMISSIONS (members.manage alias is never persisted).
    const validPerms = ALL_PERMISSIONS as readonly string[];

    const upsertRows = Object.entries(permissions)
      .filter(([perm]) => validPerms.includes(perm))
      .map(([perm, granted]) => ({
        institution_id: user.institutionId!,
        role,
        permission: perm,
        granted: Boolean(granted),
        updated_at: new Date().toISOString(),
      }));

    if (upsertRows.length === 0) throw new AppError(400, "No valid permissions provided");

    const { error } = await supabaseAdmin
      .from("institution_role_permissions")
      .upsert(upsertRows, { onConflict: "institution_id,role,permission" });

    if (error) throw new AppError(500, "Failed to update permissions");

    res.status(200).json({ message: "Permissions updated", data: permissions });
  }
);

// ─── Custom roles (CRUD) ──────────────────────────────────────────────────────
// A custom role is a named, reusable role whose permissions live in
// institution_role_permissions keyed by the custom role id (text).

// GET /institution/custom-roles
export const getCustomRoles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data: roles, error } = await supabaseAdmin
      .from("institution_custom_roles")
      .select("id, name, rank, created_at")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: true });
    if (error) throw new AppError(500, "Failed to load custom roles");

    const roleIds = (roles ?? []).map((r) => r.id as string);

    // Permissions granted to each custom role.
    const permsByRole: Record<string, string[]> = {};
    // Member count per custom role.
    const countByRole: Record<string, number> = {};
    if (roleIds.length > 0) {
      const [{ data: perms }, { data: mem }] = await Promise.all([
        supabaseAdmin
          .from("institution_role_permissions")
          .select("role, permission, granted")
          .eq("institution_id", institutionId)
          .in("role", roleIds),
        supabaseAdmin
          .from("institution_members")
          .select("custom_role_id")
          .eq("institution_id", institutionId)
          .in("custom_role_id", roleIds),
      ]);
      for (const p of perms ?? []) {
        if (!p.granted) continue;
        (permsByRole[p.role as string] ??= []).push(p.permission as string);
      }
      for (const m of mem ?? []) {
        const cid = m.custom_role_id as string | null;
        if (cid) countByRole[cid] = (countByRole[cid] ?? 0) + 1;
      }
    }

    res.status(200).json({
      data: (roles ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        rank: r.rank,
        created_at: r.created_at,
        permissions: permsByRole[r.id as string] ?? [],
        member_count: countByRole[r.id as string] ?? 0,
      })),
    });
  }
);

// POST /institution/custom-roles  { name, rank?, permissions?: string[] }
export const createCustomRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    const { name, rank, permissions } = req.body as {
      name: string;
      rank?: number;
      permissions?: string[];
    };

    // Default rank = 15 (just above MEMBER). Range enforced by DB CHECK (1..99).
    const reqRank = typeof rank === "number" ? rank : 15;
    // Rank guard: actor cannot create a role at or above their own rank.
    const actor = await getEffectiveRole(req.user!.id, institutionId, supabaseAdmin);
    if (!actor) throw new AppError(403, "You are not a member of this institution");
    const actorRank = await rankOf(actor.role, actor.customRoleId, institutionId, supabaseAdmin);
    if (actorRank <= reqRank) {
      throw new AppError(403, "You cannot create a custom role at or above your own rank");
    }

    const { data: role, error } = await supabaseAdmin
      .from("institution_custom_roles")
      .insert({ institution_id: institutionId, name: name.trim(), rank: reqRank })
      .select("id, name, rank, created_at")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new AppError(409, "A role with this name already exists");
      }
      throw new AppError(500, "Failed to create custom role");
    }

    const validPerms = (permissions ?? []).filter((p) =>
      (ALL_PERMISSIONS as readonly string[]).includes(p)
    );
    if (validPerms.length > 0) {
      const rows = validPerms.map((p) => ({
        institution_id: institutionId,
        role: role.id,
        permission: p,
        granted: true,
        updated_at: new Date().toISOString(),
      }));
      const { error: pe } = await supabaseAdmin
        .from("institution_role_permissions")
        .upsert(rows, { onConflict: "institution_id,role,permission" });
      if (pe) throw new AppError(500, "Role created but saving permissions failed");
    }

    res.status(201).json({
      data: {
        id: role.id,
        name: role.name,
        rank: role.rank,
        created_at: role.created_at,
        permissions: validPerms,
        member_count: 0,
      },
    });
  }
);

// PATCH /institution/custom-roles/:id  { name?, rank?, permissions?: string[] }
export const updateCustomRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    const { id } = req.params as { id: string };
    const { name, rank, permissions } = req.body as {
      name?: string;
      rank?: number;
      permissions?: string[];
    };

    const { data: existing } = await supabaseAdmin
      .from("institution_custom_roles")
      .select("id, rank")
      .eq("id", id)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!existing) throw new AppError(404, "Custom role not found");

    // Rank guard: actor cannot manage a role at or above their own rank,
    // and cannot raise a role to ≥ their own rank.
    const actor = await getEffectiveRole(req.user!.id, institutionId, supabaseAdmin);
    if (!actor) throw new AppError(403, "You are not a member of this institution");
    const actorRank = await rankOf(actor.role, actor.customRoleId, institutionId, supabaseAdmin);
    if (actorRank <= (existing.rank as number)) {
      throw new AppError(403, "You cannot manage a custom role at or above your own rank");
    }
    if (typeof rank === "number" && actorRank <= rank) {
      throw new AppError(403, "You cannot set a rank at or above your own");
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof name === "string" && name.trim().length > 0) updates.name = name.trim();
    if (typeof rank === "number") updates.rank = rank;
    if (Object.keys(updates).length > 1) {
      const { error } = await supabaseAdmin
        .from("institution_custom_roles")
        .update(updates)
        .eq("id", id)
        .eq("institution_id", institutionId);
      if (error) {
        if ((error as { code?: string }).code === "23505") {
          throw new AppError(409, "A role with this name already exists");
        }
        throw new AppError(500, "Failed to update the custom role");
      }
    }

    if (Array.isArray(permissions)) {
      // Replace the full permission set: clear then insert the granted ones.
      const { error: de } = await supabaseAdmin
        .from("institution_role_permissions")
        .delete()
        .eq("institution_id", institutionId)
        .eq("role", id);
      if (de) throw new AppError(500, "Failed to update permissions");

      const validPerms = permissions.filter((p) =>
        (ALL_PERMISSIONS as readonly string[]).includes(p)
      );
      if (validPerms.length > 0) {
        const rows = validPerms.map((p) => ({
          institution_id: institutionId,
          role: id,
          permission: p,
          granted: true,
          updated_at: new Date().toISOString(),
        }));
        const { error: ie } = await supabaseAdmin
          .from("institution_role_permissions")
          .upsert(rows, { onConflict: "institution_id,role,permission" });
        if (ie) throw new AppError(500, "Failed to set permissions");
      }
    }

    res.status(200).json({ message: "Custom role updated" });
  }
);

// DELETE /institution/custom-roles/:id
export const deleteCustomRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    const { id } = req.params as { id: string };

    const { data: existing } = await supabaseAdmin
      .from("institution_custom_roles")
      .select("id, rank")
      .eq("id", id)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!existing) throw new AppError(404, "Custom role not found");

    // Rank guard: actor cannot delete a role at or above their own rank.
    const actor = await getEffectiveRole(req.user!.id, institutionId, supabaseAdmin);
    if (!actor) throw new AppError(403, "You are not a member of this institution");
    const actorRank = await rankOf(actor.role, actor.customRoleId, institutionId, supabaseAdmin);
    if (actorRank <= (existing.rank as number)) {
      throw new AppError(403, "You cannot delete a custom role at or above your own rank");
    }

    // Downgrade affected members to MEMBER (clear the custom link + label).
    const { data: affected } = await supabaseAdmin
      .from("institution_members")
      .select("user_id")
      .eq("institution_id", institutionId)
      .eq("custom_role_id", id);

    // Status is left untouched so suspended members stay suspended.
    await supabaseAdmin
      .from("institution_members")
      .update({
        role_specialization: "MEMBER",
        custom_role_id: null,
        role_custom_label: null,
      })
      .eq("institution_id", institutionId)
      .eq("custom_role_id", id);

    // Remove its permission rows, then the role itself.
    await supabaseAdmin
      .from("institution_role_permissions")
      .delete()
      .eq("institution_id", institutionId)
      .eq("role", id);

    const { error } = await supabaseAdmin
      .from("institution_custom_roles")
      .delete()
      .eq("id", id)
      .eq("institution_id", institutionId);
    if (error) throw new AppError(500, "Failed to delete custom role");

    for (const m of affected ?? []) {
      if (m?.user_id) clearAuthCache(m.user_id as string);
    }
    res.status(200).json({ message: "Custom role deleted" });
  }
);

// PATCH /institution/members/:userId/role-specialization
// { roleSpecialization, customRoleId? } — writes role_specialization + custom link
// and syncs the legacy status (OWNER→OWNER, ADMIN→ADMIN, else ACTIVE).
export const updateMemberRoleSpecialization = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");
    const { userId } = req.params as { userId: string };
    const { roleSpecialization, customRoleId } = req.body as {
      roleSpecialization: string;
      customRoleId?: string;
    };

    // Ownership changes go through transfer-ownership (keeps exactly one OWNER).
    if (roleSpecialization === "OWNER") {
      throw new AppError(400, "Use transfer-ownership to assign the OWNER role");
    }

    const { data: target } = await supabaseAdmin
      .from("institution_members")
      .select("id, status")
      .eq("user_id", userId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!target) throw new AppError(404, "Member not found");
    if (target.status === "OWNER") {
      throw new AppError(400, "Cannot change the owner's role. Transfer ownership first.");
    }
    if (target.status === "PENDING") {
      throw new AppError(422, "Cannot assign a role while the join request is pending");
    }

    // Rank guard: actor must outrank the target AND the role being assigned.
    await assertRankAuthority(
      req.user!.id,
      userId,
      institutionId,
      supabaseAdmin,
      roleSpecialization,
      customRoleId ?? null
    );

    let custom_role_id: string | null = null;
    let role_custom_label: string | null = null;
    let status = "ACTIVE";

    if (roleSpecialization === "CUSTOM") {
      if (!customRoleId) throw new AppError(400, "customRoleId is required for CUSTOM role");
      const { data: cr } = await supabaseAdmin
        .from("institution_custom_roles")
        .select("id, name")
        .eq("id", customRoleId)
        .eq("institution_id", institutionId)
        .maybeSingle();
      if (!cr) throw new AppError(404, "Custom role not found");
      custom_role_id = cr.id as string;
      role_custom_label = cr.name as string;
    } else if (roleSpecialization === "ADMIN") {
      status = "ADMIN";
    }
    // A role change must not lift a suspension.
    if (target.status === "SUSPENDED") status = "SUSPENDED";

    const { error } = await supabaseAdmin
      .from("institution_members")
      .update({
        role_specialization: roleSpecialization,
        custom_role_id,
        role_custom_label,
        status,
      })
      .eq("user_id", userId)
      .eq("institution_id", institutionId);
    if (error) throw new AppError(500, "Failed to update member role");

    clearAuthCache(userId);
    res.status(200).json({ message: "Member role updated" });
  }
);

// ─── GET /institution/memberships ────────────────────────────────────────────
// Returns every institution this user is a member of (for workspace switcher).
// Includes the personal "Individual" workspace as a synthetic entry.
export const getMyMemberships = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const { data: memberships, error } = await supabaseAdmin
      .from("institution_members")
      .select(
        `
        institution_id,
        status,
        role_specialization,
        role_custom_label,
        joined_at,
        institutions!inner ( id, name, logo_url, sector )
      `
      )
      .eq("user_id", userId)
      // Pending join requests are not usable workspaces (every call would be denied).
      .in("status", ["OWNER", "ADMIN", "ACTIVE"])
      .order("joined_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to load memberships");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("last_active_institution_id, full_name")
      .eq("id", userId)
      .maybeSingle();

    const formatted = (memberships ?? []).map((m: Record<string, unknown>) => {
      const inst = Array.isArray(m["institutions"]) ? m["institutions"][0] : m["institutions"];
      return {
        institution_id: m["institution_id"],
        institution_name: (inst as Record<string, unknown> | undefined)?.["name"] ?? null,
        institution_logo_url: (inst as Record<string, unknown> | undefined)?.["logo_url"] ?? null,
        institution_sector: (inst as Record<string, unknown> | undefined)?.["sector"] ?? null,
        status: m["status"],
        role_specialization: m["role_specialization"] ?? null,
        role_custom_label: m["role_custom_label"] ?? null,
        joined_at: m["joined_at"],
      };
    });

    res.status(200).json({
      data: {
        active_institution_id: profile?.last_active_institution_id ?? null,
        personal_workspace: { name: profile?.full_name ?? "Individual" },
        memberships: formatted,
      },
    });
  }
);

// ─── GET /institution/me/permissions ─────────────────────────────────────────
// Returns the set of permissions the caller has in their active workspace.
// Frontend uses this to gate UI affordances (buttons, nav items).
export const getMyPermissions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const institutionId = resolveInstitutionId(req);

    // Personal workspace: no institution-scoped permissions.
    if (!institutionId) {
      res.status(200).json({
        data: {
          institution_id: null,
          membership_status: null,
          role_specialization: null,
          permissions: [],
        },
      });
      return;
    }

    const { data: membership } = await supabaseAdmin
      .from("institution_members")
      .select("status, role_specialization, role_custom_label, custom_role_id")
      .eq("user_id", userId)
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (!membership) {
      res.status(200).json({
        data: {
          institution_id: institutionId,
          membership_status: null,
          role_specialization: null,
          permissions: [],
        },
      });
      return;
    }

    const role = (membership.role_specialization as string | null) ?? (membership.status as string);

    // OWNER bypass — return ALL known permissions.
    if (role === "OWNER") {
      res.status(200).json({
        data: {
          institution_id: institutionId,
          membership_status: membership.status,
          role_specialization: membership.role_specialization,
          role_custom_label: membership.role_custom_label,
          permissions: ALL_PERMISSIONS,
        },
      });
      return;
    }

    // Suspended/pending: no permissions.
    if (membership.status === "SUSPENDED" || membership.status === "PENDING") {
      res.status(200).json({
        data: {
          institution_id: institutionId,
          membership_status: membership.status,
          role_specialization: membership.role_specialization,
          role_custom_label: membership.role_custom_label,
          permissions: [],
        },
      });
      return;
    }

    // Custom config in DB takes precedence; otherwise default per role_specialization.
    // CUSTOM resolves to its custom role id; ACTIVE maps to MEMBER (legacy).
    const customRoleId = membership.custom_role_id as string | null;
    const lookupRole =
      role === "CUSTOM" && customRoleId ? customRoleId : role === "ACTIVE" ? "MEMBER" : role;
    const { data: customRows } = await supabaseAdmin
      .from("institution_role_permissions")
      .select("permission, granted")
      .eq("institution_id", institutionId)
      .eq("role", lookupRole);

    // Build the granted set: explicit custom config if present, else role defaults.
    // expandAliases turns the legacy members.manage umbrella into granular members.*.
    const grantedSet: Set<string> =
      customRows && customRows.length > 0
        ? new Set(customRows.filter((r) => r.granted).map((r) => r.permission as string))
        : new Set<string>(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS[lookupRole] ?? []);
    const permissions: string[] = Array.from(expandAliases(grantedSet));

    res.status(200).json({
      data: {
        institution_id: institutionId,
        membership_status: membership.status,
        role_specialization: membership.role_specialization,
        role_custom_label: membership.role_custom_label,
        permissions,
      },
    });
  }
);

// ─── PATCH /institution/me/active ────────────────────────────────────────────
// Switch the active workspace. Persists last_active_institution_id and (optionally)
// re-issues a new JWT with updated app_metadata. For now we just persist;
// the frontend includes X-Workspace-Id on subsequent requests.
export const setActiveWorkspace = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { institution_id } = req.body as { institution_id: string | null };

    // null means "switch to personal Individual workspace".
    if (institution_id !== null) {
      const { data: membership } = await supabaseAdmin
        .from("institution_members")
        .select("status")
        .eq("user_id", userId)
        .eq("institution_id", institution_id)
        .maybeSingle();

      if (!membership || membership.status === "SUSPENDED" || membership.status === "PENDING") {
        throw new AppError(403, "You are not an active member of this institution");
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ last_active_institution_id: institution_id })
      .eq("id", userId);

    if (error) throw new AppError(500, "Failed to switch workspace");

    // Best-effort: refresh JWT app_metadata so future tokens carry it.
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { active_institution_id: institution_id },
      });
    } catch (e) {
      console.warn("[Workspace] Failed to sync JWT claims:", e);
    }

    res.status(200).json({ data: { active_institution_id: institution_id } });
  }
);

// All known modules in display order
const ALL_MODULES = [
  { key: "recruitment", label: "Recrutement" },
  { key: "hr", label: "RH & Employés" },
  { key: "payroll", label: "Paie" },
  { key: "projects", label: "Projets" },
  { key: "goals", label: "Goals & OKRs" },
];

export const getMyModules = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);

    if (!institutionId) {
      res.status(200).json({ data: [] });
      return;
    }

    const { data: rows } = await supabaseAdmin
      .from("institution_modules")
      .select("module_key, is_active")
      .eq("institution_id", institutionId);

    // If no rows yet (institution pre-dates migration), default to recruitment active
    const activeKeys = new Set(
      rows && rows.length > 0
        ? rows
            .filter((r: { module_key: string; is_active: boolean }) => r.is_active)
            .map((r: { module_key: string; is_active: boolean }) => r.module_key)
        : ["recruitment"]
    );

    res.status(200).json({
      data: ALL_MODULES.map((m) => ({ ...m, is_active: activeKeys.has(m.key) })),
    });
  }
);

export const getDepartments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);

    if (!institutionId) {
      res.status(200).json({ data: [] });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("id, name, description, parent_department_id, manager_user_id")
      .eq("institution_id", institutionId)
      .order("name");

    if (error) throw new AppError(500, "Failed to fetch departments");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── Member Availability ──────────────────────────────────────────────────────

export const getMyAvailability = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) {
      res.status(200).json({ data: [] });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("member_availabilities")
      .select("id, day_of_week, start_time, end_time, timezone, is_active")
      .eq("institution_id", institutionId)
      .eq("user_id", req.user!.id)
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time");

    if (error) throw new AppError(500, "Failed to fetch availability");
    res.status(200).json({ data: data ?? [] });
  }
);

export const upsertMyAvailability = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const slots: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
      timezone?: string;
    }> = req.body.slots ?? [];

    // Fetch current slots for rollback
    const { data: oldSlots } = await supabaseAdmin
      .from("member_availabilities")
      .select("*")
      .eq("institution_id", institutionId)
      .eq("user_id", req.user!.id);

    await supabaseAdmin
      .from("member_availabilities")
      .delete()
      .eq("institution_id", institutionId)
      .eq("user_id", req.user!.id);

    if (slots.length > 0) {
      const rows = slots.map((s) => ({
        institution_id: institutionId,
        user_id: req.user!.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        timezone: s.timezone ?? "UTC",
        is_active: true,
      }));
      const { error } = await supabaseAdmin.from("member_availabilities").insert(rows);
      if (error) {
        if (oldSlots && oldSlots.length > 0) {
          await supabaseAdmin.from("member_availabilities").insert(oldSlots);
        }
        throw new AppError(500, "Failed to save availability");
      }
    }

    res.status(200).json({ success: true, saved: slots.length });
  }
);

export const getMemberAvailability = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) {
      res.status(200).json({ data: [] });
      return;
    }
    const { userId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("member_availabilities")
      .select("id, day_of_week, start_time, end_time, timezone, is_active")
      .eq("institution_id", institutionId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time");

    if (error) throw new AppError(500, "Failed to fetch availability");
    res.status(200).json({ data: data ?? [] });
  }
);

export const getAvailabilityOverlap = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) {
      res.status(200).json({ data: [] });
      return;
    }

    const userIdsRaw = (req.query.userIds as string) ?? "";
    const userIds = userIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (userIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("member_availabilities")
      .select("user_id, day_of_week, start_time, end_time, timezone")
      .eq("institution_id", institutionId)
      .in("user_id", userIds)
      .eq("is_active", true);

    if (error) throw new AppError(500, "Failed to fetch availability");

    // Group by day_of_week+time and keep only slots present for ALL requested users
    const bySlot = new Map<string, Set<string>>();
    for (const row of data ?? []) {
      const key = `${row.day_of_week}|${row.start_time}|${row.end_time}`;
      if (!bySlot.has(key)) bySlot.set(key, new Set());
      bySlot.get(key)!.add(row.user_id);
    }

    const overlaps = [];
    for (const [key, users] of bySlot.entries()) {
      if (users.size === userIds.length) {
        const [day_of_week, start_time, end_time] = key.split("|");
        overlaps.push({ day_of_week: Number(day_of_week), start_time, end_time });
      }
    }

    res.status(200).json({ data: overlaps });
  }
);

// ─── Job Positions ────────────────────────────────────────────────────────────

export const getJobPositions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) {
      res.status(200).json({ data: [] });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("job_positions")
      .select("id, title, department_id, module_access")
      .eq("institution_id", institutionId)
      .order("title");

    if (error) throw new AppError(500, "Failed to fetch job positions");
    res.status(200).json({ data: data ?? [] });
  }
);

// ─── Department CRUD ──────────────────────────────────────────────────────────

export const createDepartment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const { name, description, parent_department_id, manager_user_id } = req.body as {
      name: string;
      description?: string;
      parent_department_id?: string | null;
      manager_user_id?: string | null;
    };
    if (!name?.trim()) throw new AppError(400, "Department name is required");

    const { data, error } = await supabaseAdmin
      .from("departments")
      .insert({
        institution_id: institutionId,
        name: name.trim(),
        description: description ?? null,
        parent_department_id: parent_department_id ?? null,
        manager_user_id: manager_user_id ?? null,
      })
      .select("id, name, description, parent_department_id, manager_user_id")
      .single();

    if (error) throw new AppError(500, "Failed to create department");
    res.status(201).json({ data });
  }
);

export const updateDepartment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const { id } = req.params;
    const { name, description, parent_department_id, manager_user_id } = req.body as {
      name?: string;
      description?: string;
      parent_department_id?: string | null;
      manager_user_id?: string | null;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (parent_department_id !== undefined) updates.parent_department_id = parent_department_id;
    if (manager_user_id !== undefined) updates.manager_user_id = manager_user_id;

    const { data, error } = await supabaseAdmin
      .from("departments")
      .update(updates)
      .eq("id", id)
      .eq("institution_id", institutionId)
      .select("id, name, description, parent_department_id, manager_user_id")
      .single();

    if (error || !data) throw new AppError(404, "Department not found");
    res.status(200).json({ data });
  }
);

export const deleteDepartment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("departments")
      .delete()
      .eq("id", id)
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to delete department");
    res.status(200).json({ success: true });
  }
);

// ─── Job Position CRUD ────────────────────────────────────────────────────────

export const createJobPosition = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const { title, department_id } = req.body as {
      title: string;
      department_id?: string | null;
    };
    if (!title?.trim()) throw new AppError(400, "Job position title is required");

    const { data, error } = await supabaseAdmin
      .from("job_positions")
      .insert({
        institution_id: institutionId,
        title: title.trim(),
        department_id: department_id ?? null,
        module_access: [],
      })
      .select("id, title, department_id, module_access")
      .single();

    if (error) throw new AppError(500, "Failed to create job position");
    res.status(201).json({ data });
  }
);

export const updateJobPosition = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const { id } = req.params;
    const { title, department_id } = req.body as {
      title?: string;
      department_id?: string | null;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (department_id !== undefined) updates.department_id = department_id;

    const { data, error } = await supabaseAdmin
      .from("job_positions")
      .update(updates)
      .eq("id", id)
      .eq("institution_id", institutionId)
      .select("id, title, department_id, module_access")
      .single();

    if (error || !data) throw new AppError(404, "Job position not found");
    res.status(200).json({ data });
  }
);

export const deleteJobPosition = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("job_positions")
      .delete()
      .eq("id", id)
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to delete job position");
    res.status(200).json({ success: true });
  }
);

// ─── PATCH /institution/me/owner-label ────────────────────────────────────────
// Self-service: lets the current user update their own role_custom_label.
// No rank check — user only renames their own display label, not permissions.
export const updateOwnerLabel = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = req.workspace?.institutionId ?? req.user!.institutionId;
    if (!institutionId) throw new AppError(400, "No institution context");

    const raw = (req.body?.label ?? "") as string;
    const label = raw.trim().slice(0, 80) || null;

    const { error } = await supabaseAdmin
      .from("institution_members")
      .update({ role_custom_label: label })
      .eq("user_id", userId)
      .eq("institution_id", institutionId);

    if (error) throw new AppError(500, "Failed to update role label");
    res.status(200).json({ label });
  }
);
