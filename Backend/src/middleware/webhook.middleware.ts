import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env";
import { AppError } from "@/middleware/error.middleware";

// RESEND_WEBHOOK_SECRET may be comma-separated for key rotation.
// Verification succeeds if ANY secret matches.
function getSecrets(): string[] {
  return env.RESEND_WEBHOOK_SECRET.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// HMAC-SHA256 of raw body. Header format: "sha256=<hex_digest>"
function verifyHmac(rawBody: Buffer, signatureHeader: string): boolean {
  for (const secret of getSecrets()) {
    const digest = crypto
      .createHmac("sha256", Buffer.from(secret, "utf8"))
      .update(rawBody)
      .digest("hex");
    const expected = `sha256=${digest}`;

    if (
      expected.length === signatureHeader.length &&
      crypto.timingSafeEqual(
        Buffer.from(expected, "utf8"),
        Buffer.from(signatureHeader, "utf8"),
      )
    ) {
      return true;
    }
  }
  return false;
}

// Fallback: plain shared-secret header (legacy, backward compat).
// Header: x-webhook-secret: <secret>
function verifySharedSecret(provided: string): boolean {
  for (const secret of getSecrets()) {
    const secretBuf = Buffer.from(secret, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (
      secretBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(secretBuf, providedBuf)
    ) {
      return true;
    }
  }
  return false;
}

export function requireWebhookSecret(req: Request, _res: Response, next: NextFunction): void {
  const hmacHeader = req.header("x-webhook-signature");
  const secretHeader = req.header("x-webhook-secret");

  if (!hmacHeader && !secretHeader) {
    next(new AppError(401, "Missing webhook secret"));
    return;
  }

  if (hmacHeader) {
    const rawBody = (req as unknown as Record<string, unknown>)["rawBody"] as Buffer | undefined;
    if (rawBody && !verifyHmac(rawBody, hmacHeader)) {
      next(new AppError(401, "Invalid webhook signature"));
      return;
    }
    // rawBody unavailable → skip HMAC, fall through to shared-secret if present
    if (!rawBody && secretHeader && !verifySharedSecret(secretHeader)) {
      next(new AppError(401, "Invalid webhook secret"));
      return;
    }
    if (!rawBody && !secretHeader) {
      next(new AppError(401, "Invalid webhook signature"));
      return;
    }
    next();
    return;
  }

  if (!verifySharedSecret(secretHeader!)) {
    next(new AppError(401, "Invalid webhook secret"));
    return;
  }
  next();
}
