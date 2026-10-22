import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env";
import { verifiedUserIdFromRequest } from "./auth.middleware";

const globalWindowMs = parseInt(env.RATE_LIMIT_WINDOW_MS);
const authWindowMs = parseInt(env.AUTH_RATE_LIMIT_WINDOW_MS);
const matchWindowMs = parseInt(env.MATCH_RATE_LIMIT_WINDOW_MS);

const globalMax = parseInt(env.RATE_LIMIT_MAX_REQUESTS);
const globalAuthenticatedMax = parseInt(env.RATE_LIMIT_MAX_REQUESTS_AUTHENTICATED);
const authMax = parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS);
const matchMax = parseInt(env.MATCH_RATE_LIMIT_MAX_REQUESTS);

const RATE_LIMIT_USER = Symbol("rateLimitUser");

/**
 * Rate-limit identity: the verified user id when the request carries a valid token,
 * otherwise the client IP. Rate limiters run before authGuard, so req.user is never
 * set here. Keying authenticated traffic per user matters because every server-side
 * call from the Next.js frontend arrives from the same IP.
 */
function rateLimitUserId(req: Request): Promise<string | null> {
  // Memoised per request: keyGenerator and max both need it.
  const holder = req as unknown as Record<symbol, Promise<string | null> | undefined>;
  holder[RATE_LIMIT_USER] ??= verifiedUserIdFromRequest(req);
  return holder[RATE_LIMIT_USER];
}

function ipKey(req: Request): string {
  return req.ip ? ipKeyGenerator(req.ip) : "unknown";
}

async function userOrIpKey(req: Request): Promise<string> {
  const userId = await rateLimitUserId(req);
  return userId ? `user:${userId}` : ipKey(req);
}

export const globalRateLimiter = rateLimit({
  windowMs: globalWindowMs,
  max: async (req: Request) => ((await rateLimitUserId(req)) ? globalAuthenticatedMax : globalMax),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  // Session endpoints must never be starved by ordinary app traffic, otherwise a busy
  // session gets 429 on /auth/me and the frontend treats the user as logged out.
  skip: (req: Request) => req.path === "/auth/me" || req.path === "/auth/refresh",
  message: {
    error: "Too many requests, please try again later.",
  },
});

/**
 * authRateLimiter — stricter limit for unauthenticated auth flows that send emails
 * or create accounts (register, OTP, forgot/reset password). Every call counts.
 */
export const authRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
});

/**
 * credentialRateLimiter — brute-force protection for login and token refresh.
 * Only failed attempts count, so normal sign-ins and silent refreshes never lock
 * a legitimate user out.
 */
export const credentialRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
});

/**
 * matchRateLimiter — stricter limit for AI matching routes (expensive operation).
 */
export const matchRateLimiter = rateLimit({
  windowMs: matchWindowMs,
  max: matchMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "AI matching rate limit reached. Please try again later.",
  },
});

/**
 * cvStudioRateLimiter — limit CV analyses (each triggers ~11 Gemini calls).
 */
export const cvStudioRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    error: "CV analysis rate limit reached (10 per hour). Please try again later.",
  },
});

/**
 * notFound — 404 handler for unmatched routes.
 */
export const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
};
