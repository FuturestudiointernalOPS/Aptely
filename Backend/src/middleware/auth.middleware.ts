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
// Key: `${userId}:${institutionId}` — short TTL so removals/suspensions apply quickly.
const activeMembershipCache = new Map<string, { active: boolean; expiresAt: number }>();
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const MEMBERSHIP_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_SIZE = 2000;

// Periodic sweep: evict expired entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authProfileCache) if (v.expiresAt < now) authProfileCache.delete(k);
  for (const [k, v] of tokenUserCache) if (v.expiresAt < now) tokenUserCache.delete(k);
  for (const [k, v] of activeMembershipCache) if (v.expiresAt < now) activeMembershipCache.delete(k);
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
  for (const key of activeMembershipCache.keys()) {
    if (key.startsWith(`${userId}:`)) activeMembershipCache.delete(key);
  }
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

  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);
  if (computedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(computedBuf, signatureBuf)) {
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

/**
 * Verifies an ES256 JWT (Supabase asymmetric signing keys). `resolveKey` maps the
 * token's `kid` to a public key; exported for unit tests.
 */
export async function verifyJwtES256(
  token: string,
  resolveKey: (kid: string | undefined) => Promise<crypto.KeyObject | null>
): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [encodedHeader, encodedPayload, signature] = parts;

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string; kid?: string };
  if (header.alg !== "ES256") throw new Error("Unsupported JWT algorithm");

  const key = await resolveKey(header.kid);
  if (!key) throw new Error("Unknown signing key");

  const valid = crypto.verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    { key, dsaEncoding: "ieee-p1363" },
    Buffer.from(signature, "base64url")
  );
  if (!valid) throw new Error("Invalid JWT signature");

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Record<string, unknown>;
  const exp = typeof payload["exp"] === "number" ? payload["exp"] : undefined;
  if (exp && exp <= Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return payload;
}

// Supabase public signing keys (JWKS), cached; refetched on an unknown kid.
const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_FAILURE_TTL_MS = 30 * 1000;
let jwksCache: { keys: Map<string, crypto.KeyObject>; expiresAt: number } | null = null;
let jwksInflight: Promise<Map<string, crypto.KeyObject>> | null = null;
let jwksFetchedAt = 0;

async function fetchSigningKeys(): Promise<Map<string, crypto.KeyObject>> {
  jwksFetchedAt = Date.now();
  const keys = new Map<string, crypto.KeyObject>();
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
    if (!res.ok) throw new Error(`JWKS HTTP ${res.status}`);
    const body = (await res.json()) as {
      keys?: Array<{ kid?: string; alg?: string; kty?: string; crv?: string; x?: string; y?: string }>;
    };
    for (const jwk of body.keys ?? []) {
      if (jwk.alg !== "ES256" || !jwk.kid) continue;
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
    }
    jwksCache = { keys, expiresAt: Date.now() + JWKS_TTL_MS };
  } catch (e) {
    console.warn("[AUTH] Failed to load Supabase JWKS:", e);
    jwksCache = { keys, expiresAt: Date.now() + JWKS_FAILURE_TTL_MS };
  }
  return keys;
}

async function resolveSupabaseSigningKey(kid: string | undefined): Promise<crypto.KeyObject | null> {
  if (!kid) return null;
  const now = Date.now();
  const known = jwksCache?.keys.get(kid);
  if (jwksCache && jwksCache.expiresAt >= now && known) return known;
  // Unknown kid on a fresh cache: allow a refetch (key rotation) at most every
  // JWKS_FAILURE_TTL_MS, so forged kids can't make every request hit Supabase.
  if (jwksCache && jwksCache.expiresAt >= now && now - jwksFetchedAt < JWKS_FAILURE_TTL_MS) return null;
  jwksInflight ??= fetchSigningKeys().finally(() => { jwksInflight = null; });
  return (await jwksInflight).get(kid) ?? null;
}

/**
 * Returns the user id of a request carrying a valid (signature + expiry checked)
 * Bearer token, or null. Used before authGuard runs (e.g. rate limiting) so a
 * forged token can never pick its own key. Supports the legacy HS256 secret and
 * Supabase's asymmetric ES256 keys.
 */
export async function verifiedUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  let payload: Record<string, unknown>;
  try {
    payload = verifyJwtHS256(token, env.SUPABASE_JWT_SECRET);
  } catch {
    try {
      payload = await verifyJwtES256(token, resolveSupabaseSigningKey);
    } catch {
      return null;
    }
  }
  return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
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

const PERSONAL_WORKSPACE_VALUES = new Set(["", "individual", "personal", "null"]);

/** Institution id named by X-Workspace-Id, or null for the personal workspace / no header. */
function requestedWorkspaceId(req: Request): string | null {
  const raw = (req.headers["x-workspace-id"] ?? "").toString().trim().toLowerCase();
  return PERSONAL_WORKSPACE_VALUES.has(raw) ? null : raw;
}

async function isActiveMember(userId: string, institutionId: string): Promise<boolean> {
  const key = `${userId}:${institutionId}`;
  const cached = activeMembershipCache.get(key);
  if (cached && cached.expiresAt >= Date.now()) return cached.active;

  const { data, error } = await supabaseAdmin
    .from("institution_members")
    .select("status")
    .eq("user_id", userId)
    .eq("institution_id", institutionId)
    .in("status", ["OWNER", "ADMIN", "ACTIVE"])
    .maybeSingle();

  // Invalid UUIDs make Postgres error out — treat as "not a member".
  const active = !error && !!data;
  if (activeMembershipCache.size >= MAX_CACHE_SIZE) {
    const firstKey = activeMembershipCache.keys().next().value;
    if (firstKey !== undefined) activeMembershipCache.delete(firstKey);
  }
  activeMembershipCache.set(key, { active, expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS });
  return active;
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
    // The JWT claim (and legacy profile column) can outlive the membership: a member
    // who was removed or suspended kept their old institution until the token was
    // refreshed — still reading its data and unable to accept a new invite. Only
    // keep it if the membership is still active.
    if (institutionId && !(await isActiveMember(userId, institutionId))) {
      institutionId = undefined;
    }
    if (!institutionId) {
      institutionId = await resolveInstitutionIdFromMembership(userId);
    }
    // Single workspace per request: permissions (requirePermission) and data scoping
    // (controllers reading req.user.institutionId) must target the same institution.
    // The workspace the client selected (X-Workspace-Id, else the JWT active claim)
    // wins, but only if the user is an active member of it — never trust the header.
    const requestedWorkspace = requestedWorkspaceId(req) ?? resolved.activeInstitutionId ?? null;
    if (
      requestedWorkspace &&
      requestedWorkspace !== institutionId &&
      (await isActiveMember(userId, requestedWorkspace))
    ) {
      institutionId = requestedWorkspace;
    }

    req.user = {
      id: userId,
      email,
      institutionId,
      activeInstitutionId: institutionId ?? null,
      isSuperAdmin: resolved.isSuperAdmin,
    };
    req.db = createAuthenticatedClient(token);

    next();
  } catch (error) {
    console.error("[AUTH] JWT verify error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export function isPersonalWorkspaceRequest(req: AuthenticatedRequest): boolean {
  if (req.workspace) return req.workspace.isPersonal;

  const headerRaw = (req.headers["x-workspace-id"] ?? "").toString().trim().toLowerCase();
  if (PERSONAL_WORKSPACE_VALUES.has(headerRaw)) return true;
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
