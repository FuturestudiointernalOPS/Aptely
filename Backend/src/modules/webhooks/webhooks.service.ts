import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { supabaseAdmin } from "@/config/supabase";
import { env } from "@/config/env";

export const WEBHOOK_EVENTS = [
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
  "OFFER_SIGNED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "DECISION_ACCEPTED",
  "DECISION_REJECTED",
  "EMPLOYEE_HIRED",
  "ONBOARDING_TASK_COMPLETED",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

// ─── Secret encryption (AES-256-GCM) ──────────────────────────────────────────
// Format stored in DB: "iv_hex:authTag_hex:ciphertext_hex"
// Falls back to plain storage if WEBHOOK_SECRET_KEY not set (dev/migration period).

function getEncKey(): Buffer | null {
  if (!env.WEBHOOK_SECRET_KEY) return null;
  const key = Buffer.from(env.WEBHOOK_SECRET_KEY, "base64");
  if (key.length !== 32) {
    console.error("[Webhooks] WEBHOOK_SECRET_KEY must be a base64-encoded 32-byte key");
    return null;
  }
  return key;
}

function encryptSecret(plain: string): string {
  const key = getEncKey();
  if (!key) return plain; // no key configured — store plain (backward compat)

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function decryptSecret(stored: string): string {
  const key = getEncKey();
  if (!key) return stored; // no key — treat as plain

  // If not in expected format, it was stored plain (before encryption was added)
  const parts = stored.split(":");
  if (parts.length !== 3) return stored;

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const ciphertext = Buffer.from(ciphertextHex!, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

export function encryptWebhookSecret(plain: string): string {
  return encryptSecret(plain);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function dispatchWebhook(
  institutionId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const { data: hooks } = await supabaseAdmin
    .from("institution_webhooks")
    .select("url, secret")
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (!hooks || hooks.length === 0) return;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  for (const hook of hooks) {
    const plainSecret = decryptSecret(hook.secret as string);
    const sig = createHmac("sha256", plainSecret)
      .update(body)
      .digest("hex");
    void fetch(hook.url as string, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Aptely-Signature": sig,
        "X-Aptely-Event": event,
      },
      body,
    }).catch(() => {});
  }
}
