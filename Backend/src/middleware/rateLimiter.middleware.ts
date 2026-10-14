import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env";

const globalWindowMs = parseInt(env.RATE_LIMIT_WINDOW_MS);
const authWindowMs = parseInt(env.AUTH_RATE_LIMIT_WINDOW_MS);
const matchWindowMs = parseInt(env.MATCH_RATE_LIMIT_WINDOW_MS);

const globalMax = parseInt(env.RATE_LIMIT_MAX_REQUESTS);
const authMax = parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS);
const matchMax = parseInt(env.MATCH_RATE_LIMIT_MAX_REQUESTS);

function tenantAwareKey(req: Request): string {
  const ip = req.ip ? ipKeyGenerator(req.ip) : "unknown";
  const user = (req as unknown as Record<string, unknown>).user as
    | { institutionId?: string }
    | undefined;
  return user?.institutionId ? `${ip}:${user.institutionId}` : ip;
}

export const globalRateLimiter = rateLimit({
  windowMs: globalWindowMs,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: tenantAwareKey,
  message: {
    error: "Too many requests, please try again later.",
  },
});

/**
 * authRateLimiter — stricter limit for auth routes (login, register).
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
  keyGenerator: tenantAwareKey,
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
