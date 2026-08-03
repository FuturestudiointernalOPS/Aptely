import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("4000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_JWT_SECRET: z.string().min(1, "SUPABASE_JWT_SECRET is required"),

  // Gemini (Google AI Studio)
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  // Gemini model — overridden by GEMINI_MODEL in .env
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),

  // Sentry error monitoring (optional — no DSN = Sentry disabled)
  SENTRY_DSN: z.string().url().optional(),

  // Calendly interview booking link sent in VALIDATED status emails
  CALENDLY_LINK: z.string().url().optional(),

  // Resend
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_WEBHOOK_SECRET: z.string().min(1, "RESEND_WEBHOOK_SECRET is required"),
  // Cron secret (used by pg_cron → /interviews/send-reminders)
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 chars"),
  RESEND_FROM_EMAIL: z.string().email().default("noreply@aptely.com"),
  RESEND_FROM_NAME: z.string().default("Aptely"),

  // CORS
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // Rate limiting — global
  RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100"),

  // Rate limiting — auth routes (login, register)
  AUTH_RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.string().default("20"),

  // Rate limiting — AI match routes
  MATCH_RATE_LIMIT_WINDOW_MS: z.string().default("3600000"),
  MATCH_RATE_LIMIT_MAX_REQUESTS: z.string().default("30"),

  // Share link base URL
  SHARE_LINK_BASE_URL: z.string().url().default("https://aptely.com"),

  // Webhook secret encryption key — 32-byte base64 (openssl rand -base64 32)
  WEBHOOK_SECRET_KEY: z.string().optional(),

  // Body size limit for JSON payloads
  BODY_LIMIT: z
    .string()
    .transform((val) => {
      const clean = val.replace(/\0/g, "").trim();
      return /^\d+(\.\d+)?(b|kb|mb|gb|tb|pb)$/i.test(clean) ? clean : "10mb";
    })
    .default("10mb"),
});

function withTestDefaults(raw: Record<string, string | undefined>): Record<string, string> {
  // Put dummy values so unit tests that import env don't hard-fail.
  return {
    ...raw,
    SUPABASE_URL: raw.SUPABASE_URL ?? "http://localhost:54321",
    SUPABASE_ANON_KEY: raw.SUPABASE_ANON_KEY ?? "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
    SUPABASE_JWT_SECRET: raw.SUPABASE_JWT_SECRET ?? "test-jwt-secret",

    GEMINI_API_KEY: raw.GEMINI_API_KEY ?? "test-gemini-key",

    RESEND_API_KEY: raw.RESEND_API_KEY ?? "test-resend-key",
    RESEND_WEBHOOK_SECRET: raw.RESEND_WEBHOOK_SECRET ?? "test-webhook-secret",
    CRON_SECRET: raw.CRON_SECRET ?? "test-cron-secret-1234567890",
  };
}

const base = process.env as Record<string, string | undefined>;
const isTest = process.env.NODE_ENV === "test";

// In tests: never hard-crash due to missing secrets; provide dummy values.
const input = isTest ? withTestDefaults(base) : base;

const parsed = envSchema.safeParse(input);

if (!parsed.success) {
  console.error("❌ FATAL: Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);

  if (!isTest) {
    console.error("\nℹ️  Check your .env file and try again.");
    process.exit(1);
  }

  // In test mode we should never get here because we inject defaults.
  // Still: fail fast to avoid masking real problems.
  process.exit(1);
}

export const env = parsed.data;

// ─── Startup validation ─────────────────────────────────────────────────────

// Ensure critical variables are not empty (defensive, envSchema already validates)
const criticalVars: Array<{ key: keyof typeof env; value: string }> = [
  { key: "SUPABASE_URL", value: env.SUPABASE_URL },
  { key: "SUPABASE_JWT_SECRET", value: env.SUPABASE_JWT_SECRET },
  { key: "GEMINI_API_KEY", value: env.GEMINI_API_KEY },
  { key: "RESEND_API_KEY", value: env.RESEND_API_KEY },
  { key: "RESEND_WEBHOOK_SECRET", value: env.RESEND_WEBHOOK_SECRET },
];

for (const { key, value } of criticalVars) {
  if (!value || value.length === 0) {
    console.error(`❌ FATAL: Critical environment variable is empty: ${String(key)}`);
    process.exit(1);
  }
}

if (env.NODE_ENV === "production" && !env.FRONTEND_URL.includes("https")) {
  console.warn("⚠️  WARNING: FRONTEND_URL should use HTTPS in production");
}

process.stderr.write("✅ Environment variables validated successfully\n");
