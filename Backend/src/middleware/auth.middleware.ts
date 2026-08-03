import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { supabaseAdmin, createAuthenticatedClient } from "../config/supabase";
import crypto from "crypto";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    institutionId?: string;
    activeInstitutionId?: string | null;
    isSuperAdmin: boolean;
    // Legacy field kept for backward-compat with older tests/modules.
    role?: string;
  };
  db?: ReturnType<typeof createAuthenticatedClient>;
  workspace?: {
    institutionId: string | null;
    isPersonal: boolean;
    membershipStatus: "OWNER" | "ADMIN" | "ACTIVE" | "PENDING" | "SUSPENDED" | null;
    roleSpecialization:
      | "OWNER"
      | "ADMIN"
      | "HR_LEAD"
      | "HIRING_MANAGER"
      | "RECRUITER"
      | "STANDARD_HR"
      | "MEMBER"
      | "CUSTOM"
      | null;
    roleCustomLabel: string | null;
  };
}

type CachedAuthProfile = {
  institutionId?: string;
  isSuperAdmin: boolean;
  expiresAt: number;
};

const authProfileCache = new Map<string, CachedAuthProfile>();
const tokenUserCache = new Map<string, { userId: string; email: string; expiresAt: number }>();
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 2000;

// Periodic sweep: evict expired entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authProfileCache) if (v.expiresAt < now) authProfileCache.delete(k);
  for (const [k, v] of tokenUserCache) if (v.expiresAt < now) tokenUserCache.delete(k);
}, AUTH_CACHE_TTL_MS).unref();

function readCachedProfile(userId: string): CachedAuthProfile | null {
  const cached = authProfileCache.get(userId);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    authProfileCache.delete(userId);
    return null;
  }
  return cached;
}

function writeCachedProfile(userId: string, profile: Omit<CachedAuthProfile, "expiresAt">): void {
  if (authProfileCache.size >= MAX_CACHE_SIZE) {
    const firstKey = authProfileCache.keys().next().value;
    if (firstKey !== undefined) authProfileCache.delete(firstKey);
  }
  authProfileCache.set(userId, {
    ...profile,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

export function clearAuthCache(userId: string): void {
  authProfileCache.delete(userId);
}

function readCachedTokenUser(token: string): { userId: string; email: string } | null {
  const cached = tokenUserCache.get(token);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    tokenUserCache.delete(token);
    return null;
  }
  return { userId: cached.userId, email: cached.email };
}

function writeCachedTokenUser(token: string, userId: string, email: string): void {
  if (tokenUserCache.size >= MAX_CACHE_SIZE) {
    const firstKey = tokenUserCache.keys().next().value;
    if (firstKey !== undefined) tokenUserCache.delete(firstKey);
  }
  tokenUserCache.set(token, {
    userId,
    email,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  if (typeof value === "number") return value === 1;
  return false;
}

function extractClaims(payload: Record<string, unknown>): {
  institutionId?: string;
  activeInstitutionId?: string | null;
  isSuperAdmin: boolean;
} {
  const userMetadata = (payload.user_metadata as Record<string, unknown> | undefined) ?? {};
  const appMetadata = (payload.app_metadata as Record<string, unknown> | undefined) ?? {};

  const institutionId =
    (appMetadata["institution_id"] as string | undefined) ??
    (userMetadata["institution_id"] as string | undefined);
  const activeInstitutionId =
    (appMetadata["active_institution_id"] as string | null | undefined) ??
    (userMetadata["active_institution_id"] as string | null | undefined) ??
    null;
  const isSuperAdmin = parseBoolean(
    appMetadata["is_super_admin"] ?? appMetadata["isSuperAdmin"] ?? userMetadata["isSuperAdmin"]
  );

  return {
    institutionId: institutionId || undefined,
    activeInstitutionId,
    isSuperAdmin,
  };
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function verifyJwtHS256(token: string, secret: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed token");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  if (computed !== signature) {
    throw new Error("Invalid JWT signature");
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string };
  if (header.alg !== "HS256") {
    throw new Error("Unsupported JWT algorithm");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Record<string, unknown>;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = typeof payload["exp"] === "number" ? payload["exp"] : undefined;
  if (exp && exp <= nowSeconds) {
    throw new Error("Token expired");
  }

  return payload;
}

async function getLegacyProfile(
  userId: string,
  options: { bypassCache?: boolean } = {}
): Promise<{
  institutionId?: string;
  isSuperAdmin: boolean;
}> {
  if (!options.bypassCache) {
    const cached = readCachedProfile(userId);
    if (cached) {
      return {
        institutionId: cached.institutionId,
        isSuperAdmin: cached.isSuperAdmin,
      };
    }
  }

  const [profileResult, superAdminResult] = await Promise.all([
    supabaseAdmin.from("profiles").select("institution_id").eq("id", userId).single(),
    supabaseAdmin.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("User profile not found");
  }

  const resolved = {
    institutionId: profileResult.data.institution_id ?? undefined,
    isSuperAdmin: superAdminResult.data !== null,
  };

  writeCachedProfile(userId, resolved);
  return resolved;
}

async function resolveInstitutionIdFromMembership(userId: string): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin
    .from("institution_members")
    .select("institution_id, status")
    .eq("user_id", userId)
    .in("status", ["OWNER", "ADMIN", "ACTIVE"])
    .limit(1)
    .maybeSingle();

  if (error || !data) return undefined;
  return data.institution_id ?? undefined;
}

async function resolveUserFromSupabaseToken(token: string): Promise<{ userId: string; email: string }> {
  const cached = readCachedTokenUser(token);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Invalid or expired token");
  }

  const resolved = {
    userId: data.user.id,
    email: data.user.email ?? "",
  };
  writeCachedTokenUser(token, resolved.userId, resolved.email);
  return resolved;
}

/**
 * authGuard — local parsing using jose
 * Zero latency, uses Custom Claims from JWT.
 */
export const authGuard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    let userId = "";
    let email = "";
    let resolved: {
      institutionId?: string;
      activeInstitutionId?: string | null;
      isSuperAdmin: boolean;
    };

    try {
      const payload = verifyJwtHS256(token, env.SUPABASE_JWT_SECRET);
      userId = (payload.sub as string) || "";
      if (!userId) {
        throw new Error("Invalid token payload");
      }
      email = (payload.email as string) || "";

      const claims = extractClaims(payload);
      const needsLegacy = !claims.institutionId && !claims.activeInstitutionId;
      const legacy = needsLegacy ? await getLegacyProfile(userId, { bypassCache: true }) : null;
      resolved = {
        institutionId: claims.institutionId ?? legacy?.institutionId,
        activeInstitutionId: claims.activeInstitutionId ?? legacy?.institutionId ?? null,
        isSuperAdmin: claims.isSuperAdmin || legacy?.isSuperAdmin || false,
      };
    } catch {
      const tokenUser = await resolveUserFromSupabaseToken(token);
      userId = tokenUser.userId;
      email = tokenUser.email;
      const legacy = await getLegacyProfile(userId);
      resolved = { ...legacy, activeInstitutionId: legacy.institutionId ?? null };
    }

    // Legacy/back-compat: if institutionId isn't reliably derived from JWT/profiles,
    // try to resolve from institution_members (OWNER/ADMIN/ACTIVE).
    let institutionId = resolved.institutionId;
    if (!institutionId) {
      institutionId = await resolveInstitutionIdFromMembership(userId);
    }

    req.user = {
      id: userId,
      email,
      institutionId,
      activeInstitutionId: resolved.activeInstitutionId ?? (institutionId ?? null),
      isSuperAdmin: resolved.isSuperAdmin,
    };
    req.db = createAuthenticatedClient(token);

    next();
  } catch (error) {
    console.error("[AUTH] JWT verify error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const PERSONAL_VALUES = new Set(["", "individual", "personal", "null"]);

export function isPersonalWorkspaceRequest(req: AuthenticatedRequest): boolean {
  if (req.workspace) return req.workspace.isPersonal;

  const headerRaw = (req.headers["x-workspace-id"] ?? "").toString().trim().toLowerCase();
  if (PERSONAL_VALUES.has(headerRaw)) return true;
  if (headerRaw.length > 0) return false;

  const hasInstitution = Boolean(req.user?.activeInstitutionId ?? req.user?.institutionId);
  return !hasInstitution;
}

export const requirePersonalWorkspace = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isPersonalWorkspaceRequest(req)) {
    res.status(403).json({ error: "Personal workspace required" });
    return;
  }

  next();
};

export const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!req.user.isSuperAdmin) {
    res.status(403).json({ error: "Access denied. Super admin required." });
    return;
  }

  next();
};
