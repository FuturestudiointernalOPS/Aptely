import { Response } from "express";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { deriveRoleFieldsFromFullForm } from "@/modules/roles/role-form.mapper";
import { supabaseAdmin } from "@/config/supabase";

// ─── GET /hr/dashboard/stats ──────────────────────────────────────────────────

export const getDashboardStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from("roles")
      .select("id, status")
      .eq("institution_id", institutionId);

    if (rolesError) throw new AppError(500, "Failed to fetch roles");

    const roleIds = (roleRows ?? []).map((r) => r.id);
    const totalRoles = roleIds.length;
    // Only published roles are "open": drafts, closed and cancelled roles are not.
    const activeRoleIds = (roleRows ?? []).filter((r) => r.status === "ACTIVE").map((r) => r.id as string);
    const safeRoleIds = roleIds.length > 0 ? roleIds : [""];

    const [
      { count: totalApplications },
      { count: pendingApplications },
      { count: analyzingApplications },
      { count: validatedApplications },
      { count: rejectedApplications },
      { count: activeHRMembers },
      { count: pendingAccessRequests },
    ] = await Promise.all([
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).in("role_id", safeRoleIds),
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).in("role_id", safeRoleIds).eq("status", "PENDING"),
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).in("role_id", safeRoleIds).eq("status", "ANALYSING"),
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).in("role_id", safeRoleIds).eq("status", "VALIDATED"),
      supabaseAdmin.from("applications").select("id", { count: "exact", head: true }).in("role_id", safeRoleIds).eq("status", "REJECTED"),
      supabaseAdmin.from("institution_members").select("id", { count: "exact", head: true }).eq("institution_id", institutionId).in("status", ["OWNER", "ADMIN", "ACTIVE"]),
      supabaseAdmin.from("institution_members").select("id", { count: "exact", head: true }).eq("institution_id", institutionId).eq("status", "PENDING"),
    ]);

    // Open roles that have not received a single application yet (all of them, not only the latest).
    let activeRolesWithoutApplications = activeRoleIds.length;
    if (activeRoleIds.length > 0) {
      const { data: appliedRows } = await supabaseAdmin
        .from("applications")
        .select("role_id")
        .in("role_id", activeRoleIds);
      const applied = new Set((appliedRows ?? []).map((a) => a.role_id as string));
      activeRolesWithoutApplications = activeRoleIds.filter((id) => !applied.has(id)).length;
    }

    res.status(200).json({
      totalRoles,
      activeRoles: activeRoleIds.length,
      activeRolesWithoutApplications,
      totalApplications: totalApplications ?? 0,
      pendingApplications: pendingApplications ?? 0,
      analyzingApplications: analyzingApplications ?? 0,
      validatedApplications: validatedApplications ?? 0,
      rejectedApplications: rejectedApplications ?? 0,
      activeHRMembers: activeHRMembers ?? 0,
      pendingAccessRequests: pendingAccessRequests ?? 0,
    });
  }
);

// ─── GET /hr/dashboard/recent-roles ──────────────────────────────────────────

export const getRecentRoles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const limitParam = req.query["limit"];
    const limit = limitParam ? parseInt(String(limitParam), 10) : 5;

    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("id, status, created_at, role_dna(full_form_json)")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 20));

    if (error) throw new AppError(500, "Failed to fetch recent roles");

    const normalized = (data ?? []).map((role: Record<string, unknown>) => {
      const roleDna = Array.isArray(role.role_dna) ? role.role_dna[0] : role.role_dna;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;
      const derived = deriveRoleFieldsFromFullForm(fullForm);

      return {
        id: role.id,
        status: role.status,
        created_at: role.created_at,
        title: derived.title,
        location: derived.location,
        type: derived.type,
        end_date: derived.endDate,
      };
    });

    // The role list needs the real applicant count (the front used to default it to 0).
    const recentIds = normalized.map((r) => r.id as string);
    const counts = new Map<string, number>();
    if (recentIds.length > 0) {
      const { data: appRows } = await supabaseAdmin
        .from("applications")
        .select("role_id")
        .in("role_id", recentIds);
      for (const a of appRows ?? []) {
        const rid = a.role_id as string;
        counts.set(rid, (counts.get(rid) ?? 0) + 1);
      }
    }

    res.status(200).json({
      data: normalized.map((r) => ({ ...r, applicationsCount: counts.get(r.id as string) ?? 0 })),
    });
  }
);

// ─── GET /hr/dashboard/recent-activity ───────────────────────────────────────

export const getRecentActivity = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data: roleRows } = await supabaseAdmin
      .from("roles")
      .select("id, role_dna(full_form_json)")
      .eq("institution_id", institutionId);

    const roleIds = (roleRows ?? []).map((r) => r.id);
    const roleTitleMap: Record<string, string> = {};
    (roleRows ?? []).forEach((r) => {
      const roleDna = Array.isArray(r.role_dna) ? r.role_dna[0] : r.role_dna;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;
      roleTitleMap[r.id] = deriveRoleFieldsFromFullForm(fullForm).title;
    });

    const [recentRolesRes, recentAppsRes] = await Promise.all([
      supabaseAdmin
        .from("roles")
        .select("id, created_at, role_dna(full_form_json)")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false })
        .limit(5),

      roleIds.length > 0
        ? supabaseAdmin
            .from("applications")
            .select("id, role_id, created_at, profiles!applications_candidate_id_fkey(full_name)")
            .in("role_id", roleIds)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (recentRolesRes.error) console.error("Recent roles error:", recentRolesRes.error);
    if (recentAppsRes.error) console.error("Recent apps error:", recentAppsRes.error);

    type ActivityItem = {
      type: "APPLICATION_RECEIVED" | "ROLE_CREATED";
      message: string;
      createdAt: string;
    };

    const activities: ActivityItem[] = [];

    (recentRolesRes.data ?? []).forEach((role) => {
      const roleDna = Array.isArray(role.role_dna) ? role.role_dna[0] : role.role_dna;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;
      const roleTitle = deriveRoleFieldsFromFullForm(fullForm).title;
      activities.push({
        type: "ROLE_CREATED",
        message: `New role "${roleTitle}" was created`,
        createdAt: role.created_at,
      });
    });

    (recentAppsRes.data ?? []).forEach((app) => {
      const roleTitle = roleTitleMap[app.role_id] ?? "Unknown";
      const candidateName =
        (app.profiles as unknown as { full_name?: string } | null)?.full_name ?? "A candidate";
      activities.push({
        type: "APPLICATION_RECEIVED",
        message: `${candidateName} applied to "${roleTitle}"`,
        createdAt: app.created_at,
      });
    });

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.status(200).json({ data: activities.slice(0, 10) });
  }
);

// ─── GET /hr/dashboard/recent-applications ────────────────────────────────────

export const getRecentApplications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = req.user!.institutionId;
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { data, error } = await supabaseAdmin
      .from("applications")
      .select(
        `
        id,
        created_at,
        status,
        profiles!applications_candidate_id_fkey(full_name),
        roles!inner(institution_id, role_dna(full_form_json))
      `
      )
      .eq("roles.institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }

    const formatted = (data || []).map((app: any) => {
      const roleDna = Array.isArray(app.roles?.role_dna) ? app.roles.role_dna[0] : app.roles?.role_dna;
      const fullForm = roleDna?.full_form_json as Record<string, unknown> | undefined;

      return {
        applicationId: app.id,
        candidateName: app.profiles?.full_name,
        roleTitle: deriveRoleFieldsFromFullForm(fullForm).title,
        submittedAt: app.created_at,
        status: app.status,
      };
    });

    res.status(200).json(formatted);
  }
);
