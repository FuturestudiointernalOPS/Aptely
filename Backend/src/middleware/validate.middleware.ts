import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * validate — middleware factory that validates req.body against a Zod schema.
 * On failure, returns 422 with field-level error details.
 * On success, replaces req.body with the parsed + typed data.
 *
 * @example
 * router.post('/roles', authGuard, validate(createRoleSchema), createRole);
 */
export const validate =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422).json({
          error: "Validation error",
          details: err.flatten().fieldErrors,
        });
        return;
      }
      next(err);
    }
  };

/**
 * validateQuery — same as validate but for req.query params.
 *
 * NOTE: In Express 5, req.query is a read-only getter — we cannot assign to it.
 * Parsed + coerced values are stored in res.locals.query instead.
 * Controllers should read from res.locals.query (falls back to raw req.query).
 */
export const validateQuery =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Store validated query in res.locals (Express 5 compatible)
      res.locals["query"] = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(422).json({
          error: "Query validation error",
          details: err.flatten().fieldErrors,
        });
        return;
      }
      next(err);
    }
  };
