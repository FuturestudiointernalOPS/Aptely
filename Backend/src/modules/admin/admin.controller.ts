import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import { paginate } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import type { ListUsersQuery, ListInstitutionsQuery } from "./admin.schema";
import { deriveRoleFieldsFromFullForm } from "@/modules/roles/role-form.mapper";

// ─── Helpers (enterprise / user relationships) ───────────────────────────────

/** Membership statuses that count as a working member of an enterprise. */
const ACTIVE_MEMBER_STATUSES = new Set(["OWNER", "ADMIN", "ACTIVE"]);
/** Built-in roles that make up the enterprise's HR / recruitment team. */
const HR_TEAM_ROLES = new Set(["HR_LEAD", "STANDARD_HR", "RECRUITER", "HIRING_MANAGER"]);

type ProfileLite = { id: string; email: string | null; full_name: string | null; role: string | null };

async function profilesById(ids: string[]): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role")
    .in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, p as ProfileLite]));
}

/** Job posting titles live in role_dna.full_form_json (roles has no title column). */
async function roleTitlesById(roleIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(roleIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from("role_dna")
    .select("role_id, full_form_json")
    .in("role_id", unique);
  return new Map(
    (data ?? []).map((r) => [
      r.role_id as string,
      deriveRoleFieldsFromFullForm((r.full_form_json ?? {}) as Record<string, unknown>).title,
    ])
  );
}

async function institutionNamesById(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await supabaseAdmin.from("institutions").select("id, name").in("id", unique);
  return new Map((data ?? []).map((i) => [i.id as string, i.name as string]));
}

// ─── GET /admin/stats ─────────────────────────────────────────────────────────

export const getStats = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const since7d  = new Date(Date.now() - 7  * 86400000).toISOString();
    const since14d = new Date(Date.now() - 14 * 86400000).toISOString();

    const [
      usersRes, institutionsRes, applicationsRes, superAdminsRes,
      usersThisWeek, usersLastWeek,
      instsThisWeek, instsLastWeek,
      appsThisWeek,  appsLastWeek,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("institutions").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("applications").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("super_admins").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since7d),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since14d).lt("created_at", since7d),
      supabaseAdmin.from("institutions").select("*", { count: "exact", head: true }).gte("created_at", since7d),
      supabaseAdmin.from("institutions").select("*", { count: "exact", head: true }).gte("created_at", since14d).lt("created_at", since7d),
      supabaseAdmin.from("applications").select("*", { count: "exact", head: true }).gte("created_at", since7d),
      supabaseAdmin.from("applications").select("*", { count: "exact", head: true }).gte("created_at", since14d).lt("created_at", since7d),
    ]);

    const trend = (curr: number, prev: number) =>
      prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

    res.status(200).json({
      totalUsers:         usersRes.count ?? 0,
      totalInstitutions:  institutionsRes.count ?? 0,
      totalApplications:  applicationsRes.count ?? 0,
      totalSuperAdmins:   superAdminsRes.count ?? 0,
      trends: {
        users:        { thisWeek: usersThisWeek.count ?? 0,  pct: trend(usersThisWeek.count ?? 0,  usersLastWeek.count ?? 0) },
        institutions: { thisWeek: instsThisWeek.count ?? 0,  pct: trend(instsThisWeek.count ?? 0,  instsLastWeek.count ?? 0) },
        applications: { thisWeek: appsThisWeek.count ?? 0,   pct: trend(appsThisWeek.count ?? 0,   appsLastWeek.count ?? 0) },
      },
    });
  }
);

// ─── GET /admin/users ─────────────────────────────────────────────────────────

/**
 * Liste tous les utilisateurs de la plateforme.
 * Filtres optionnels : role (HR | CANDIDATE), search (email ou nom)
 * Pagination : ?page=1&limit=20
 */
export const listUsers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page, limit, role, search } = (res.locals["query"] ?? req.query) as ListUsersQuery;
    const { offset, limit: take } = paginate(page, limit, 20);

    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, institution_id, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (role) {
      query = query.eq("role", role);
    }

    if (search) {
      // Sanitize search : retirer les caractères spéciaux PostgREST pour éviter
      // l'injection de filtre via la syntaxe .or() de PostgREST.
      const safeSearch = search.replace(/[%_,()"'\\]/g, "");
      query = query.or(`email.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw new AppError(500, "Failed to fetch users");

    // Organisational relationship of each user (§3 step 8): enterprise + role.
    const userIds = (data ?? []).map((u) => u.id as string);
    const { data: memberRows } = userIds.length
      ? await supabaseAdmin
          .from("institution_members")
          .select("user_id, institution_id, role_specialization, status")
          .in("user_id", userIds)
      : { data: [] };
    const instNames = await institutionNamesById((memberRows ?? []).map((m) => m.institution_id as string));
    // Suspension lives on auth.users (ban), not on profiles: without it the list
    // showed every account as active and offered to suspend an already suspended one.
    const bans = new Map(
      await Promise.all(
        userIds.map(async (uid) => {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid);
          return [uid, (authUser?.user as { banned_until?: string | null } | undefined)?.banned_until ?? null] as const;
        })
      )
    );
    const items = (data ?? []).map((u) => ({
      ...u,
      banned_until: bans.get(u.id as string) ?? null,
      memberships: (memberRows ?? [])
        .filter((m) => m.user_id === u.id)
        .map((m) => ({
          institution_id: m.institution_id,
          institution_name: instNames.get(m.institution_id as string) ?? null,
          role_specialization: m.role_specialization ?? null,
          status: m.status,
        })),
    }));

    res.status(200).json({
      items,
      total: count ?? 0,
      page: parseInt(page ?? "1", 10),
      limit: take,
    });
  }
);

// ─── GET /admin/users/:id ─────────────────────────────────────────────────────

/**
 * Retourne le détail complet d'un utilisateur :
 * - Profil
 * - Membership institution (si HR)
 * - Talent DNA (si CANDIDATE)
 * - Candidatures actives
 */
export const getUserById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params["id"] as string;

    // Profil de base
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (profileError) throw new AppError(500, "Failed to fetch user");
    if (!profile) throw new AppError(404, "User not found");

    // Données supplémentaires selon le rôle — en parallèle
    const [membershipRes, talentRes, applicationsRes, authUserRes] = await Promise.all([
      // Entreprises (un utilisateur peut appartenir à plusieurs ; .maybeSingle()
      // échouait dans ce cas et renvoyait null).
      supabaseAdmin
        .from("institution_members")
        .select("institution_id, role_specialization, role_custom_label, status, joined_at")
        .eq("user_id", id)
        .order("joined_at", { ascending: true }),
      // Talent DNA (si CANDIDATE)
      supabaseAdmin
        .from("talent_dna")
        .select("completion_score, created_at, updated_at")
        .eq("candidate_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("applications")
        .select("id, role_id, status, created_at")
        .eq("candidate_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin.auth.admin.getUserById(id),
    ]);

    const memberships = membershipRes.data ?? [];
    const applications = applicationsRes.data ?? [];

    // Resolve the enterprise behind each application (role → institution) and the
    // human-readable names, so the Super Admin can check every relationship.
    const roleIds = applications.map((a) => a.role_id as string);
    const { data: roleRows } = roleIds.length
      ? await supabaseAdmin.from("roles").select("id, institution_id").in("id", roleIds)
      : { data: [] };
    const roleInst = new Map((roleRows ?? []).map((r) => [r.id as string, r.institution_id as string]));
    const [instNames, titles] = await Promise.all([
      institutionNamesById([
        ...memberships.map((m) => m.institution_id as string),
        ...(roleRows ?? []).map((r) => r.institution_id as string),
      ]),
      roleTitlesById(roleIds),
    ]);

    const membershipList = memberships.map((m) => ({
      institution_id: m.institution_id,
      institution_name: instNames.get(m.institution_id as string) ?? null,
      role_specialization: m.role_specialization ?? null,
      role_custom_label: m.role_custom_label ?? null,
      status: m.status,
      joined_at: m.joined_at,
    }));

    res.status(200).json({
      profile: {
        ...profile,
        banned_until: authUserRes.data.user?.banned_until ?? null,
      },
      memberships: membershipList,
      // Kept for backward compatibility with older clients: active membership first.
      membership: membershipList.find((m) => m.status === "ACTIVE") ?? membershipList[0] ?? null,
      talentDna: talentRes.data ?? null,
      recentApplications: applications.map((a) => {
        const instId = roleInst.get(a.role_id as string) ?? null;
        return {
          ...a,
          role_title: titles.get(a.role_id as string) ?? null,
          institution_id: instId,
          institution_name: instId ? instNames.get(instId) ?? null : null,
        };
      }),
    });
  }
);

// ─── PATCH /admin/users/:id/suspend ──────────────────────────────────────────

/**
 * Suspend ou réactive un compte utilisateur.
 * "Suspendre" = on ne peut pas désactiver un user directement dans auth.users via SDK,
 * on utilise admin.updateUserById pour bannir l'accès.
 *
 * Supabase Admin SDK : updateUserById avec ban_duration = "none" (réactiver)
 * ou ban_duration = "876600h" (100 ans ≈ permanent) pour suspendre.
 */
export const suspendUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params["id"] as string;
    const { suspend } = req.body as { suspend: boolean };

    if (typeof suspend !== "boolean") {
      throw new AppError(400, 'Body must contain { "suspend": true | false }');
    }

    // Empêcher de suspendre un super admin
    const { data: superAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();

    if (superAdmin) {
      throw new AppError(403, "Cannot suspend a super admin");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: suspend ? "876600h" : "none",
    });

    if (error) throw new AppError(500, "Failed to update user status");

    res.status(200).json({
      message: suspend ? "User suspended successfully" : "User reactivated successfully",
    });
  }
);

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────

/**
 * Supprime définitivement un utilisateur.
 * - Supprime d'abord les données liées (via CASCADE en base)
 * - Puis supprime le compte auth.users
 *
 * ⚠️  Action irréversible.
 */
export const deleteUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params["id"] as string;

    // Empêcher de supprimer un super admin
    const { data: superAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();

    if (superAdmin) {
      throw new AppError(403, "Cannot delete a super admin");
    }

    // Empêcher l'auto-suppression
    if (req.user!.id === id) {
      throw new AppError(403, "Cannot delete your own account");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) throw new AppError(500, "Failed to delete user");

    res.status(200).json({ message: "User deleted successfully" });
  }
);

// ─── GET /admin/institutions ──────────────────────────────────────────────────

/**
 * Liste toutes les institutions de la plateforme.
 * Filtres optionnels : search (nom)
 * Pagination : ?page=1&limit=20
 */
export const listInstitutions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page, limit, search } = (res.locals["query"] ?? req.query) as ListInstitutionsQuery;
    const { offset, limit: take } = paginate(page, limit, 20);

    let query = supabaseAdmin
      .from("institutions")
      .select("id, name, sector, location, stage, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (search) {
      const safeSearch = search.replace(/[%_,()"'\\]/g, "");
      query = query.ilike("name", `%${safeSearch}%`);
    }

    const { data, error, count } = await query;

    if (error) throw new AppError(500, "Failed to fetch institutions");

    // Per-enterprise counts for the list (§3: users, job postings at a glance).
    const ids = (data ?? []).map((i) => i.id as string);
    const [{ data: memberRows }, { data: roleRows }] = ids.length
      ? await Promise.all([
          supabaseAdmin.from("institution_members").select("institution_id, status").in("institution_id", ids),
          supabaseAdmin.from("roles").select("institution_id, status").in("institution_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const items = (data ?? []).map((inst) => ({
      ...inst,
      member_count: (memberRows ?? []).filter(
        (m) => m.institution_id === inst.id && ACTIVE_MEMBER_STATUSES.has(m.status as string)
      ).length,
      job_posting_count: (roleRows ?? []).filter((r) => r.institution_id === inst.id).length,
    }));

    res.status(200).json({
      items,
      total: count ?? 0,
      page: parseInt(page ?? "1", 10),
      limit: take,
    });
  }
);

// ─── GET /admin/metrics ───────────────────────────────────────────────────────

function groupByWeek(rows: { created_at: string }[]): { week: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const d = new Date(row.created_at);
    // ISO week start (Monday)
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    const week = d.toISOString().slice(0, 10);
    map.set(week, (map.get(week) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export const getMetrics = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const since8w  = new Date(Date.now() - 56 * 86400000).toISOString();
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString();
    const prevMonth30d = new Date(Date.now() - 60 * 86400000).toISOString();

    // Job postings are `roles`; job_positions are internal org-chart positions.
    const [jobsRes, appsRes, usersRes, activeInstRes, prevActiveInstRes, funnelCounts, acceptedOffersRes] =
      await Promise.all([
        supabaseAdmin.from("roles").select("created_at").gte("created_at", since8w),
        supabaseAdmin.from("applications").select("created_at").gte("created_at", since8w),
        supabaseAdmin.from("profiles").select("created_at").gte("created_at", since8w),
        // Active this month: institutions with job postings in last 30d
        supabaseAdmin.from("roles").select("institution_id").gte("created_at", since30d),
        // Active prev month: institutions with job postings 60d–30d ago
        supabaseAdmin
          .from("roles")
          .select("institution_id")
          .gte("created_at", prevMonth30d)
          .lt("created_at", since30d),
        Promise.all([
          supabaseAdmin.from("roles").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("applications").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("interviews").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("offers").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("offers").select("*", { count: "exact", head: true }).eq("status", "ACCEPTED"),
        ]),
        // Accepted offers → application → role (institution)
        supabaseAdmin
          .from("offers")
          .select(`
            id, updated_at,
            applications!inner(created_at, roles!inner(institution_id))
          `)
          .eq("status", "ACCEPTED"),
      ]);

    const uniqueActive = new Set(
      (activeInstRes.data ?? []).map((r: { institution_id: string }) => r.institution_id)
    ).size;

    // Retention rate: institutions active last month that are still active this month
    const prevActiveSet = new Set(
      (prevActiveInstRes.data ?? []).map((r: { institution_id: string }) => r.institution_id)
    );
    const currActiveSet = new Set(
      (activeInstRes.data ?? []).map((r: { institution_id: string }) => r.institution_id)
    );
    const retainedCount = [...prevActiveSet].filter((id) => currActiveSet.has(id)).length;
    const institutionRetentionPct = prevActiveSet.size > 0
      ? Math.round((retainedCount / prevActiveSet.size) * 100)
      : null;

    // Repeat hiring: institutions with >= 2 accepted offers
    // Supabase may return nested relations as object or array depending on cardinality.
    type RoleNest = { institution_id: string } | { institution_id: string }[];
    type AcceptedOfferRow = {
      id: string;
      updated_at: string;
      applications:
        | { created_at: string; roles: RoleNest }
        | { created_at: string; roles: RoleNest }[];
    };
    const acceptedOffers = (acceptedOffersRes.data ?? []) as unknown as AcceptedOfferRow[];

    const hiresPerInst = new Map<string, number>();
    const timesToHireMs: number[] = [];

    for (const offer of acceptedOffers) {
      const appRaw = offer.applications;
      const app = Array.isArray(appRaw) ? appRaw[0] : appRaw;
      const rolesRaw = app?.roles;
      const role = Array.isArray(rolesRaw) ? rolesRaw[0] : rolesRaw;
      const instId = role?.institution_id;
      if (instId) {
        hiresPerInst.set(instId, (hiresPerInst.get(instId) ?? 0) + 1);
      }
      const appCreated  = app?.created_at;
      const offerClosed = offer.updated_at;
      if (appCreated && offerClosed) {
        const ms = new Date(offerClosed).getTime() - new Date(appCreated).getTime();
        if (ms > 0) timesToHireMs.push(ms);
      }
    }

    const repeatHiringInstitutions = [...hiresPerInst.values()].filter((c) => c >= 2).length;
    const avgTimeToHireDays = timesToHireMs.length > 0
      ? Math.round(timesToHireMs.reduce((a, b) => a + b, 0) / timesToHireMs.length / 86400000)
      : null;

    const [jpCount, appCount, intCount, offCount, accCount] = funnelCounts;

    res.status(200).json({
      activeInstitutions30d:    uniqueActive,
      repeatHiringInstitutions,
      avgTimeToHireDays,
      institutionRetentionPct,
      funnel: {
        jobPositions: jpCount.count ?? 0,
        applications: appCount.count ?? 0,
        interviews:   intCount.count ?? 0,
        offers:       offCount.count ?? 0,
        accepted:     accCount.count ?? 0,
      },
      weeklyJobPostings:   groupByWeek(jobsRes.data ?? []),
      weeklyApplications:  groupByWeek(appsRes.data ?? []),
      weeklyNewUsers:      groupByWeek(usersRes.data ?? []),
    });
  }
);

// ─── GET /admin/activity ──────────────────────────────────────────────────────

export const getActivity = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

    const [usersRes, jobsRes, appsRes, offersRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("roles")
        .select("id, created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("applications")
        .select("id, created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("offers")
        .select("id, status, created_at, updated_at")
        .eq("status", "ACCEPTED")
        .gte("updated_at", since7d)
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    type ActivityEvent = { type: string; label: string; at: string };
    const jobTitles = await roleTitlesById((jobsRes.data ?? []).map((j) => j.id as string));

    const events: ActivityEvent[] = [
      ...(usersRes.data ?? []).map((u) => ({
        type: "signup",
        label: (u.full_name as string | null) ?? (u.email as string),
        at: u.created_at as string,
      })),
      ...(jobsRes.data ?? []).map((j) => ({
        type: "job_posted",
        label: jobTitles.get(j.id as string) ?? "Fiche de poste",
        at: j.created_at as string,
      })),
      ...(appsRes.data ?? []).map((a) => ({
        type: "application",
        // Neutral label — front localizes via type; keep id fragment for uniqueness
        label: `Application #${(a.id as string).slice(0, 6)}`,
        at: a.created_at as string,
      })),
      ...(offersRes.data ?? []).map((o) => ({
        type: "offer_accepted",
        label: "Offer accepted",
        at: o.updated_at as string,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 25);

    res.status(200).json(events);
  }
);

// ─── GET /admin/institutions/:id ──────────────────────────────────────────────

export const getInstitutionById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params["id"] as string;

    // Job postings are `roles` (job_positions are internal org-chart positions and
    // have no status column — querying it failed silently and always returned []).
    const [instRes, membersRes, rolesRes, employeesRes] = await Promise.all([
      supabaseAdmin
        .from("institutions")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("institution_members")
        .select("user_id, role_specialization, role_custom_label, status, joined_at")
        .eq("institution_id", id)
        .order("joined_at", { ascending: true }),
      supabaseAdmin
        .from("roles")
        .select("id, status, created_at")
        .eq("institution_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("employee_records")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", id),
    ]);

    if (instRes.error || membersRes.error || rolesRes.error) {
      throw new AppError(500, "Failed to fetch institution details");
    }
    if (!instRes.data) throw new AppError(404, "Institution not found");

    const memberRows = membersRes.data ?? [];
    const roleRows = rolesRes.data ?? [];
    const roleIds = roleRows.map((r) => r.id as string);

    const { data: appRows, error: appError } = roleIds.length
      ? await supabaseAdmin
          .from("applications")
          .select("id, candidate_id, role_id, status, created_at")
          .in("role_id", roleIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (appError) throw new AppError(500, "Failed to fetch institution applications");
    const applications = appRows ?? [];

    const [profiles, titles] = await Promise.all([
      profilesById([
        ...memberRows.map((m) => m.user_id as string),
        ...applications.map((a) => a.candidate_id as string),
      ]),
      roleTitlesById(roleIds),
    ]);

    const members = memberRows.map((m) => {
      const p = profiles.get(m.user_id as string);
      return {
        user_id: m.user_id,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        role_specialization: m.role_specialization ?? null,
        role_custom_label: m.role_custom_label ?? null,
        status: m.status,
        joined_at: m.joined_at,
      };
    });

    const activeMembers = members.filter((m) => ACTIVE_MEMBER_STATUSES.has(m.status as string));
    const candidateIds = new Set(applications.map((a) => a.candidate_id as string).filter(Boolean));

    res.status(200).json({
      institution: instRes.data,
      stats: {
        // Users = active members of the enterprise (pending requests / suspended excluded).
        totalUsers: activeMembers.length,
        pendingRequests: members.filter((m) => m.status === "PENDING").length,
        suspendedMembers: members.filter((m) => m.status === "SUSPENDED").length,
        // Employees = HR employee records (Phase 4 staff module).
        totalEmployees: employeesRes.count ?? 0,
        hrUsers: activeMembers.filter((m) => HR_TEAM_ROLES.has(m.role_specialization as string)).length,
        jobPostings: roleRows.length,
        openJobPostings: roleRows.filter((r) => r.status === "ACTIVE").length,
        applications: applications.length,
        candidates: candidateIds.size,
      },
      members,
      jobPostings: roleRows.map((r) => ({
        id: r.id,
        title: titles.get(r.id as string) ?? null,
        status: r.status,
        created_at: r.created_at,
      })),
      candidates: applications.slice(0, 50).map((a) => {
        const p = profiles.get(a.candidate_id as string);
        return {
          application_id: a.id,
          candidate_id: a.candidate_id,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          role_id: a.role_id,
          role_title: titles.get(a.role_id as string) ?? null,
          status: a.status,
          applied_at: a.created_at,
        };
      }),
    });
  }
);

// ─── DELETE /admin/institutions/:id ───────────────────────────────────────────

/**
 * Supprime définitivement une institution et toutes ses données liées
 * (membres, rôles, candidatures — via CASCADE en base).
 *
 * ⚠️  Action irréversible.
 */
export const deleteInstitution = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const { error } = await supabaseAdmin.from("institutions").delete().eq("id", id);

    if (error) throw new AppError(500, "Failed to delete institution");

    res.status(200).json({ message: "Institution deleted successfully" });
  }
);
