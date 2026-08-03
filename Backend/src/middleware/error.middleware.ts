import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { env } from "../config/env";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Global error handler — must be registered LAST in Express middleware chain.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      error: "Validation error",
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Multer file upload errors
  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = err.code === "LIMIT_FILE_SIZE" ? "File exceeds 10 MB limit" : `Upload error: ${err.message}`;
    res.status(status).json({ error: message });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Unknown errors
  console.error("[Unhandled Error]", err);
  res.status(500).json({
    error: "Internal server error",
    ...(env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
};
