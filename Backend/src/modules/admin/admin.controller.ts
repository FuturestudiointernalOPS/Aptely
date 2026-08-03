import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import { paginate } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import type { ListUsersQuery, ListInstitutionsQuery } from "./admin.schema";

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

    res.status(200).json({
      items: data,
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
    const { id } = req.params;

    // Profil de base
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (profileError) throw new AppError(500, "Failed to fetch user");
    if (!profile) throw new AppError(404, "User not found");

    // Données supplémentaires selon le rôle — en parallèle
    const [membershipRes, talentRes, applicationsRes] = await Promise.all([
      // Institution (si HR)
      supabaseAdmin
        .from("institution_members")
        .select("institution_id, status, joined_at")
        .eq("user_id", id)
        .maybeSingle(),
      // Talent DNA (si CANDIDATE)
      supabaseAdmin
        .from("talent_dna")
        .select("completion_score, created_at, updated_at")
        .eq("candidate_id", id)
        .maybeSingle(),
      // Candidatures
      supabaseAdmin
        .from("applications")
        .select("id, role_id, status, created_at")
        .eq("candidate_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    res.status(200).json({
      profile,
      membership: membershipRes.data ?? null,
      talentDna: talentRes.data ?? null,
      recentApplications: applicationsRes.data ?? [],
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

    res.status(200).json({
      items: data,
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

    const [jobsRes, appsRes, usersRes, activeInstRes, prevActiveInstRes, funnelCounts, acceptedOffersRes] =
      await Promise.all([
        supabaseAdmin.from("job_positions").select("created_at").gte("created_at", since8w),
        supabaseAdmin.from("applications").select("created_at").gte("created_at", since8w),
        supabaseAdmin.from("profiles").select("created_at").gte("created_at", since8w),
        // Active this month: institutions with job postings in last 30d
        supabaseAdmin.from("job_positions").select("institution_id").gte("created_at", since30d),
        // Active prev month: institutions with job postings 60d–30d ago
        supabaseAdmin
          .from("job_positions")
          .select("institution_id")
          .gte("created_at", prevMonth30d)
          .lt("created_at", since30d),
        Promise.all([
          supabaseAdmin.from("job_positions").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("applications").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("interviews").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("offers").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("offers").select("*", { count: "exact", head: true }).eq("status", "ACCEPTED"),
        ]),
        // Accepted offers with application chain for PMF metrics
        supabaseAdmin
          .from("offers")
          .select(`
            id, updated_at,
            applications!inner(created_at, job_positions!inner(institution_id))
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
    type AcceptedOfferRow = {
      id: string;
      updated_at: string;
      applications: {
        created_at: string;
        job_positions: { institution_id: string }[];
      }[];
    };
    const acceptedOffers = (acceptedOffersRes.data ?? []) as unknown as AcceptedOfferRow[];

    const hiresPerInst = new Map<string, number>();
    const timesToHireMs: number[] = [];

    for (const offer of acceptedOffers) {
      const app     = offer.applications?.[0];
      const instId  = app?.job_positions?.[0]?.institution_id;
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
        .from("job_positions")
        .select("id, title, created_at")
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

    const events: ActivityEvent[] = [
      ...(usersRes.data ?? []).map((u) => ({
        type: "signup",
        label: (u.full_name as string | null) ?? (u.email as string),
        at: u.created_at as string,
      })),
      ...(jobsRes.data ?? []).map((j) => ({
        type: "job_posted",
        label: j.title as string,
        at: j.created_at as string,
      })),
      ...(appsRes.data ?? []).map((a) => ({
        type: "application",
        label: `Candidature #${(a.id as string).slice(0, 6)}`,
        at: a.created_at as string,
      })),
      ...(offersRes.data ?? []).map((o) => ({
        type: "offer_accepted",
        label: `Offre acceptée`,
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
    const { id } = req.params;

    const [instRes, membersRes, jobsRes] = await Promise.all([
      supabaseAdmin
        .from("institutions")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("institution_members")
        .select("user_id, role_specialization, status, joined_at")
        .eq("institution_id", id),
      supabaseAdmin
        .from("job_positions")
        .select("id, title, status, created_at")
        .eq("institution_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (!instRes.data) throw new AppError(404, "Institution not found");

    res.status(200).json({
      institution: instRes.data,
      members: membersRes.data ?? [],
      jobPositions: jobsRes.data ?? [],
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
