import { randomBytes } from "crypto";

/**
 * generateShareLink — creates a unique share link slug for database storage.
 * Returns ONLY the slug, not a full URL.
 * Frontend will build the complete URL based on its own origin.
 * @example "role-xK8a2Lp"
 */
export const generateShareLink = (prefix: string): string => {
  const id = randomBytes(6).toString("base64url");
  return `${prefix}-${id}`;
};

/**
 * paginate — returns offset and limit from page/limit query params.
 */
export const paginate = (
  page: string | undefined,
  limit: string | undefined,
  defaultLimit = 10
): { offset: number; limit: number } => {
  const parsedLimit = Math.min(parseInt(limit ?? String(defaultLimit), 10), 100);
  const parsedPage = Math.max(parseInt(page ?? "1", 10), 1);
  return {
    offset: (parsedPage - 1) * parsedLimit,
    limit: parsedLimit,
  };
};

/**
 * asyncHandler — wraps an async Express route handler to forward errors to next().
 * Avoids try/catch boilerplate in every controller.
 */
import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
