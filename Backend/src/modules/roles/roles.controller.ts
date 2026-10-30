import { Response } from "express";
import { createAuthenticatedClient, supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler, paginate, generateShareLink } from "@/utils/helpers";
import type { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { runMatching } from "@/modules/matching/matching.service";
import { deriveRoleFieldsFromFullForm } from "./role-form.mapper";
import { checkPermission } from "@/modules/institution/institution.controller";
import { resolveInstitutionId } from "@/modules/institution/institution.service";
import type {
  CreateRoleInput,
  UpdateRoleInput,
  UpdateRoleStatusInput,
  UpdateRoleDnaInput,
  ListRolesQuery,
  ListRoleApplicationsQuery,
} from "./roles.schema";

type DB = ReturnType<typeof createAuthenticatedClient>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertRoleOwnership(roleId: string, institutionId: string, supabaseAdmin: DB): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("id", roleId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (error) throw new AppError(500, "Failed to verify role ownership");
  if (!data) throw new AppError(404, "Role not found");
}

// ─── GET /roles ──────────────────────────────────────────────────────────────

export const listRoles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const { page, limit, status, search } = (res.locals["query"] ?? req.query) as ListRolesQuery;
    const { offset, limit: take } = paginate(page, limit, 20);

    let query = supabaseAdmin
      .from("roles")
      .select(
        `
        id, status, share_link,
        created_at, updated_at,
        role_dna(full_form_json),
        applications(count)
        `,
        { count: "exact" }
      )
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (status) query = query.eq("status", status);
    if (search) {
      // Search is handled client-side from full_form_json title in JSON-only mode.
    }

    const { data, error, count } = await query;

    if (error) throw new AppError(500, "Failed to fetch roles");

    const roles = await Promise.all((data ?? []).map(async (r: Record<string, unknown>) => {
      const apps = r.applications as { count: number }[] | undefined;
      const roleDna = Array.isArray(r.role_dna) ? r.role_dna[0] : r.role_dna;
      const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
        | Record<string, unknown>
        | undefined;
      const derived = deriveRoleFieldsFromFullForm(fullForm);
      const metadataMissing =
        !fullForm ||
        Object.keys(fullForm).length === 0 ||
        (derived.title === "Untitled Role" && !derived.location);

      return {
        ...r,
        title: derived.title,
        description: derived.description,
        location: derived.location,
        type: derived.type,
        end_date: derived.endDate,
        metadata_missing: metadataMissing,
        applications: undefined,
        role_dna: undefined,
        applicationsCount: apps?.[0]?.count ?? 0,
      };
    }));

    res.status(200).json({
      data: roles,
      meta: {
        total: count ?? 0,
        page: parseInt(page ?? "1", 10),
        limit: take,
      },
    });
  }
);

// ─── POST /roles ──────────────────────────────────────────────────────────────

export const createRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await checkPermission(userId, institutionId, "roles.create", supabaseAdmin);

    const body = req.body as CreateRoleInput;
    const fullForm = body.fullForm as Record<string, unknown> | undefined;

    const shareLink = generateShareLink("role");

    const { department_id, hiring_manager_user_id } = body as any;

    // Insert via supabaseAdmin (bypass RLS) — access already gated by checkPermission above,
    // per project convention writes use supabaseAdmin while req.supabaseAdmin stays for RLS-scoped reads.
    const minimalInsert = await supabaseAdmin
      .from("roles")
      .insert({
        institution_id: institutionId,
        share_link: shareLink,
        status: "DRAFT" as const,
        ...(department_id ? { department_id } : {}),
        ...(hiring_manager_user_id ? { hiring_manager_user_id } : {}),
      })
      .select()
      .single();

    if (minimalInsert.error) {
      console.error("ROLE CREATE ERROR (Minimal Insert Failed):", minimalInsert.error);
      throw new AppError(500, "Failed to create role record", {
        code: minimalInsert.error.code,
        details: minimalInsert.error.details,
        hint: minimalInsert.error.hint,
        message: minimalInsert.error.message,
        possibleCause:
          minimalInsert.error.code === "42703"
            ? "Schema mismatch: required role columns may be missing (check migration 021+)"
            : undefined,
      });
    }

    const data = minimalInsert.data as Record<string, unknown>;

    if (fullForm) {
      const { error: dnaError } = await supabaseAdmin
        .from("role_dna")
        .update({ full_form_json: fullForm })
        .eq("role_id", data.id as string);

      if (dnaError) {
        console.error("ROLE DNA INIT ERROR:", dnaError);
        throw new AppError(500, "Failed to initialize role JSON form", {
          code: dnaError.code,
          details: dnaError.details,
          hint: dnaError.hint,
          message: dnaError.message,
        });
      }
    }


    res.status(201).json({ data });
  }
);

// ─── GET /roles/:id ───────────────────────────────────────────────────────────

export const getRoleById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;

    const { data, error } = await supabaseAdmin
      .from("roles")
      .select(
        `
        *,
        role_dna(*)
        `
      )
      .eq("id", id)
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (error) throw new AppError(500, "Failed to fetch role");
    if (!data) throw new AppError(404, "Role not found");

    const roleDna = Array.isArray(data.role_dna) ? data.role_dna[0] : data.role_dna;
    const fullForm = (roleDna as Record<string, unknown> | undefined)?.full_form_json as
      | Record<string, unknown>
      | undefined;
    const derived = deriveRoleFieldsFromFullForm(fullForm);
    const metadataMissing =
      !fullForm ||
      Object.keys(fullForm).length === 0 ||
      (derived.title === "Untitled Role" && !derived.location);

    const normalized = {
      ...data,
      role_dna: roleDna ?? null,
      title: derived.title,
      description: derived.description,
      location: derived.location,
      type: derived.type,
      end_date: derived.endDate,
      application_form: derived.applicationForm,
      metadata_missing: metadataMissing,
    };

    res.status(200).json({ data: normalized });
  }
);

// ─── PATCH /roles/:id ─────────────────────────────────────────────────────────

export const updateRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await checkPermission(userId, institutionId, "roles.update", supabaseAdmin);

    const id = req.params["id"] as string;
    await assertRoleOwnership(id, institutionId, supabaseAdmin);

    const body = req.body as UpdateRoleInput;
    const fullForm = body.fullForm as Record<string, unknown> | undefined;

    if (fullForm) {
      const { error: dnaError } = await supabaseAdmin
        .from("role_dna")
        .update({ full_form_json: fullForm })
        .eq("role_id", id);

      if (dnaError) throw new AppError(500, "Failed to update role JSON form");

      // Touch roles.updated_at so list queries reflect the change
      await supabaseAdmin
        .from("roles")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
    }

    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("id, status, share_link, created_at, updated_at")
      .eq("id", id)
      .single();

    if (error) throw new AppError(500, "Failed to fetch role after update");

    res.status(200).json({ data });
  }
);

// ─── DELETE /roles/:id ────────────────────────────────────────────────────────

export const deleteRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await checkPermission(userId, institutionId, "roles.delete", supabaseAdmin);

    const id = req.params["id"] as string;
    await assertRoleOwnership(id, institutionId, supabaseAdmin);

    const { error } = await supabaseAdmin.from("roles").delete().eq("id", id);

    if (error) throw new AppError(500, "Failed to delete role");

    res.status(200).json({ message: "Role deleted successfully" });
  }
);

// ─── PATCH /roles/:id/status ──────────────────────────────────────────────────

export const updateRoleStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await checkPermission(userId, institutionId, "roles.update", supabaseAdmin);

    const id = req.params["id"] as string;
    await assertRoleOwnership(id, institutionId, supabaseAdmin);

    const { status } = req.body as UpdateRoleStatusInput;

    const { data, error } = await supabaseAdmin
      .from("roles")
      .update({ status })
      .eq("id", id)
      .select("id, status, updated_at")
      .single();

    if (error) throw new AppError(500, "Failed to update role status");

    res.status(200).json({ data });
  }
);

// ─── GET /roles/:id/share-link ────────────────────────────────────────────────

export const getRoleShareLink = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await assertRoleOwnership(id, institutionId, supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("share_link")
      .eq("id", id)
      .single();

    if (error) throw new AppError(500, "Failed to fetch share link");

    let shareLink = data.share_link as string | null;
    if (!shareLink) {
      shareLink = generateShareLink("role");
      const { error: linkError } = await supabaseAdmin
        .from("roles")
        .update({ share_link: shareLink })
        .eq("id", id);

      if (linkError) throw new AppError(500, "Failed to save share link");
    }

    res.status(200).json({ shareLink });
  }
);

// ─── PATCH /roles/:id/dna ─────────────────────────────────────────────────────

export const updateRoleDna = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    await checkPermission(userId, institutionId, "roles.update", supabaseAdmin);

    const id = req.params["id"] as string;
    await assertRoleOwnership(id, institutionId, supabaseAdmin);

    const body = req.body as UpdateRoleDnaInput;

    const patch: Record<string, unknown> = { role_id: id };
    if (body.fullForm !== undefined) patch.full_form_json = body.fullForm;
    if ((body as any).department_id !== undefined) (patch as any).department_id = (body as any).department_id;
    if ((body as any).hiring_manager_user_id !== undefined) (patch as any).hiring_manager_user_id = (body as any).hiring_manager_user_id;

    const { data, error } = await supabaseAdmin
      .from("role_dna")
      .update(patch)
      .eq("role_id", id)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to update Role DNA");

    res.status(200).json({ data });
  }
);

// ─── POST /roles/:id/evaluate ────────────────────────────────────────────────

export const evaluateRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await checkPermission(req.user!.id, institutionId, "applications.decide", supabaseAdmin);
    await assertRoleOwnership(id, institutionId, supabaseAdmin);

    const { data: updated, error } = await supabaseAdmin
      .from("applications")
      .update({ status: "ANALYSING" })
      .eq("role_id", id)
      .in("status", ["PENDING"])
      .select("id");

    if (error) throw new AppError(500, "Failed to start evaluation");

    const count = updated?.length ?? 0;
    runMatching(id, 10, reqLocale(req))
      .catch((err: unknown) => {
        console.error(`[matching] ❌ runMatching failed for role ${id}:`, err);
      });

    res.status(200).json({
      status: "EVALUATION_STARTED",
      message: `AI matching engine is processing ${count} application(s) in the background.`,
      count,
    });
  }
);

function reqLocale(req: AuthenticatedRequest): "fr" | "en" {
  return req.headers["x-locale"] === "en" ? "en" : "fr";
}

// ─── GET /roles/:id/applications ─────────────────────────────────────────────

export const getRoleApplications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const institutionId = resolveInstitutionId(req);
    if (!institutionId) throw new AppError(403, "You are not linked to any institution");

    const id = req.params["id"] as string;
    await assertRoleOwnership(id, institutionId, supabaseAdmin);

    const { page, limit, status } = (res.locals["query"] ?? req.query) as ListRoleApplicationsQuery;
    const { offset, limit: take } = paginate(page, limit, 100);

    let query = supabaseAdmin
      .from("applications")
      .select(
        `
        id, status, match_score, created_at, dna_snapshot, candidate_id,
        profiles!candidate_id(id, full_name, email),
        match_results(*)
        `,
        { count: "exact" }
      )
      .eq("role_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + take - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;

    if (error) throw new AppError(500, "Failed to fetch applications");

    const normalized = (data ?? []).map((application: Record<string, unknown>) => {
      const snapshot = application.dna_snapshot as Record<string, unknown> | undefined;
      const identity = (snapshot?.talent_identity as Record<string, unknown> | undefined) ?? {};
      const guestName = typeof identity.name === "string" ? identity.name : null;
      const guestEmail = typeof identity.email === "string" ? identity.email : null;

      return {
        ...application,
        guest_name: guestName,
        guest_email: guestEmail,
      };
    });

    res.status(200).json({
      data: normalized,
      meta: {
        total: count ?? 0,
        page: parseInt(page ?? "1", 10),
        limit: take,
      },
    });
  }
);

