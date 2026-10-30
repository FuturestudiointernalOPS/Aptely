import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import { globalRateLimiter, notFound } from "./middleware/rateLimiter.middleware";
import { authRouter } from "./modules/auth/auth.router";
import { adminRouter } from "./modules/admin/admin.router";
import { rolesRouter } from "./modules/roles/roles.router";
import applicationsRouter from "./modules/applications/applications.router";
import hrDashboardRouter from "./modules/hr-dashboard/hr-dashboard.router";
import institutionRouter from "./modules/institution/institution.router";
import matchRouter from "./modules/matching/matching.router";
import interviewsRouter from "./modules/interviews/interviews.router";
import decisionsRouter from "./modules/decisions/decisions.router";
import offersRouter from "./modules/offers/offers.router";
import onboardingRouter from "./modules/onboarding/onboarding.router";
import communicationsRouter from "./modules/communications/communications.router";
import analyticsRouter from "./modules/analytics/analytics.router";
import individualsRouter from "./modules/individuals/individuals.router";
import vaultRouter from "./modules/vault/vault.router";
import prepRouter from "./modules/prep/prep.router";
import messagesRouter from "./modules/messages/messages.router";
import wavesRouter from "./modules/waves/waves.router";
import employeesRouter from "./modules/employees/employees.router";
import notificationsRouter from "./modules/notifications/notifications.router";
import leaveRouter from "./modules/leave/leave.router";
import offboardingRouter from "./modules/offboarding/offboarding.router";
import payrollRouter from "./modules/payroll/payroll.router";
import { webhooksRouter } from "./modules/webhooks/webhooks.router";
import goalsRouter from "./modules/goals/goals.router";
import retentionRouter from "./modules/retention/retention.router";
import learningRouter from "./modules/learning/learning.router";
import compensationRouter from "./modules/employees/compensation.router";
import cvStudioRouter from "./modules/cv-studio/cv-studio.router";
import { authGuard } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import {
  getCandidateInterviewHistory,
  getCandidateInterviewHistoryEnriched,
} from "./modules/interviews/interviews.controller";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
}

const app = express();

// ─── Trust proxy (requis pour Railway / Render / tout reverse-proxy) ──────────
// Sans cela, express-rate-limit voit toujours l'IP du proxy et bloque tout le monde.
// "1" = faire confiance au premier proxy dans la chaîne (load balancer cloud).
app.set("trust proxy", 1);

// ─── Security & parsing middlewares ──────────────────────────────────────────
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" },
  contentSecurityPolicy: false,
}));
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "X-Workspace-Id", "x-locale"],
  })
);
app.use(express.json({
  limit: env.BODY_LIMIT,
  verify: (req, _res, buf) => {
    (req as unknown as Record<string, unknown>)["rawBody"] = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: env.BODY_LIMIT }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(globalRateLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  const timestamp = new Date().toISOString();
  const { getEmailDeliveryStatus } = await import("./services/email.service");
  const email = getEmailDeliveryStatus();
  try {
    const { supabaseAdmin } = await import("./config/supabase");
    const start = Date.now();
    const { error } = await supabaseAdmin.from("institutions").select("id").limit(1);
    const latencyMs = Date.now() - start;
    res.json({
      status: error ? "degraded" : "ok",
      db: error ? "error" : "ok",
      latency_ms: latencyMs,
      email,
      timestamp,
    });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable", email, timestamp });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/roles", rolesRouter);
app.use("/applications", applicationsRouter);
app.use("/hr/dashboard", hrDashboardRouter);
app.use("/institution", institutionRouter);
app.use("/match", matchRouter);
app.use("/interviews", interviewsRouter);
app.use("/decisions", decisionsRouter);
app.use("/offers", offersRouter);
app.use("/onboarding", onboardingRouter);
app.use("/communications", communicationsRouter);
app.use("/analytics", analyticsRouter);
app.use("/individuals", individualsRouter);
app.use("/vault", vaultRouter);
app.use("/prep", prepRouter);
app.use("/messages", messagesRouter);
app.use("/waves", wavesRouter);
app.use("/employees", employeesRouter);
app.use("/notifications", notificationsRouter);
app.use("/leave", leaveRouter);
app.use("/offboarding-hr", offboardingRouter);
app.use("/payroll", payrollRouter);
app.use("/webhooks", webhooksRouter);
app.use("/goals", goalsRouter);
app.use("/retention", retentionRouter);
app.use("/learning", learningRouter);
app.use("/compensation", compensationRouter);
app.use("/cv-studio", cvStudioRouter);
app.get("/candidates/:candidateId/interviews/history", authGuard, requirePermission("applications.view"), getCandidateInterviewHistory);
app.get(
  "/candidates/:candidateId/interviews/history/enriched",
  authGuard,
  requirePermission("applications.view"),
  getCandidateInterviewHistoryEnriched
);

// ─── OpenAPI / Swagger UI ──────────────────────────────────────────────────────
const openapiDoc = parseYaml(readFileSync(join(__dirname, "openapi.yaml"), "utf8")) as Record<string, unknown>;
app.get("/openapi.json", (_req, res) => res.json(openapiDoc));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDoc, {
  customSiteTitle: "Aptely API Docs",
  customCss: ".swagger-ui .topbar { display: none }",
}));

// ─── 404 + Error handlers (must be last) ──────────────────────────────────────
app.use(notFound);
Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

export default app;
