import { Request, Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import { deriveRoleFieldsFromFullForm } from "./role-form.mapper";

const PAGE_SIZE = 20;

export const discoverRoles = asyncHandler(async (req: Request, res: Response) => {
  const q        = typeof req.query.q        === "string" ? req.query.q.trim()        : "";
  const location = typeof req.query.location === "string" ? req.query.location.trim() : "";
  const type     = typeof req.query.type     === "string" ? req.query.type.trim()     : "";
  const page     = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const offset   = (page - 1) * PAGE_SIZE;

  // Fetch ACTIVE roles with their DNA and institution
  const { data: rows, error, count } = await supabaseAdmin
    .from("roles")
    .select("id, share_link, created_at, role_dna(full_form_json), institution:institutions(name, logo_url)", { count: "exact" })
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw new AppError(500, "Failed to fetch roles");

  // Derive fields and filter in-memory (full_form_json lives in JSONB)
  let results = (rows ?? []).map((row: any) => {
    const roleDna  = Array.isArray(row.role_dna) ? row.role_dna[0] : row.role_dna;
    const fullForm = roleDna?.full_form_json ?? {};
    const derived  = deriveRoleFieldsFromFullForm(fullForm);
    const inst     = Array.isArray(row.institution) ? row.institution[0] : row.institution;
    return {
      id:               row.id,
      share_link:       row.share_link,
      created_at:       row.created_at,
      title:            derived.title,
      description:      derived.description,
      location:         derived.location,
      type:             derived.type,
      institution_name: inst?.name ?? null,
      institution_logo: inst?.logo_url ?? null,
    };
  });

  // Client-side filtering on derived fields
  if (q) {
    const lower = q.toLowerCase();
    results = results.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        (r.description ?? "").toLowerCase().includes(lower) ||
        (r.institution_name ?? "").toLowerCase().includes(lower)
    );
  }
  if (location) {
    const lower = location.toLowerCase();
    results = results.filter((r) => (r.location ?? "").toLowerCase().includes(lower));
  }
  if (type) {
    const lower = type.toLowerCase();
    results = results.filter((r) => (r.type ?? "").toLowerCase().includes(lower));
  }

  res.status(200).json({
    data: results,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
});

export const getPublicRole = asyncHandler(async (req: Request, res: Response) => {
  const { shareLink } = req.params;

  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("*, role_dna(full_form_json), institution:institutions(name, logo_url)")
    .eq("share_link", shareLink)
    .single();

  if (error || !data) {
    throw new AppError(404, "Role not found or invalid link");
  }

  const roleDna = Array.isArray((data as any).role_dna) ? (data as any).role_dna[0] : (data as any).role_dna;
  const fullForm = roleDna?.full_form_json || {};
  const derived = deriveRoleFieldsFromFullForm(fullForm);
  const isOpenForApplications = data.status === "ACTIVE";

  res.status(200).json({
    status: "success",
    data: {
      ...data,
      is_open_for_applications: isOpenForApplications,
      title: derived.title,
      description: derived.description,
      location: derived.location,
      type: derived.type,
      end_date: derived.endDate,
      application_form: derived.applicationForm,
      full_form_json: fullForm,
      role_dna: undefined,
    },
  });
});
