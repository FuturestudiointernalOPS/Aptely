import { absoluteUrl, applyPath } from "@/lib/routes";
import type { Role } from "./api.types";

const LOCATION_PLACEHOLDER_VALUES = ["other", "autre", "other - other", "autre - autre"];

export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isLocationPlaceholder(value: unknown): boolean {
  return typeof value === "string" && LOCATION_PLACEHOLDER_VALUES.includes(value.toLowerCase().trim());
}

export function asMeaningfulLocation(value: unknown): string | null {
  const str = asNonEmptyString(value);
  return str && !isLocationPlaceholder(str) ? str : null;
}

export function safeEntityId(value: unknown): string {
  const raw = asNonEmptyString(value);
  if (!raw) return "";

  const lowered = raw.toLowerCase();
  if (lowered === "unknown" || lowered === "undefined" || lowered === "null") {
    return "";
  }

  return raw;
}

export function extractMatchScore(a: any): number | undefined {
  const raw = a.matchScore ?? a.match_score ?? a.match_results?.[0]?.final_score ?? a.match_results?.final_score ?? undefined;
  if (raw == null) return undefined;
  return raw <= 1 ? Math.round(raw * 100) : raw;
}

export function safeDateString(value: unknown): string {
  const raw = asNonEmptyString(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= 0) return "";
  return raw;
}

export function normalizeRoleFromApi(r: any): Role {
  const title = asNonEmptyString(r?.title) ?? "Role to complete";
  const location = asNonEmptyString(r?.location) ?? null;
  const type = asNonEmptyString(r?.type) ?? "UNSPECIFIED";
  const createdAt = safeDateString(r?.created_at) || new Date().toISOString();
  const endDate = safeDateString(r?.end_date);

  return {
    roleId: r.id,
    title,
    description: asNonEmptyString(r?.description) ?? undefined,
    status: r.status,
    location,
    type,
    createdAt,
    endDate,
    applicationsCount: r.applicationsCount || 0,
    metadataMissing: Boolean(r.metadata_missing),
    shareLink: r.share_link ? absoluteUrl(applyPath(r.share_link)) : absoluteUrl(applyPath(r.id)),
  };
}
