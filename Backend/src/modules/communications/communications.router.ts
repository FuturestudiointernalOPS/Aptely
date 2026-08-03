import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate, validateQuery } from "@/middleware/validate.middleware";
import { requireWebhookSecret } from "@/middleware/webhook.middleware";
import {
  getTemplatesQuerySchema,
  dispatchDecisionSchema,
  communicationWebhookSchema,
} from "./communications.schema";
import {
  getCommunicationTemplates,
  createCommunicationTemplate,
  dispatchDecisionCommunication,
  handleCommunicationWebhook,
} from "./communications.controller";

const router = Router();

router.get(
  "/templates",
  authGuard,
  requirePermission("communications.send"),
  validateQuery(getTemplatesQuerySchema),
  getCommunicationTemplates
);

router.post(
  "/templates",
  authGuard,
  requirePermission("communications.send"),
  createCommunicationTemplate
);

router.post(
  "/dispatch/decision",
  authGuard,
  requirePermission("communications.send"),
  validate(dispatchDecisionSchema),
  dispatchDecisionCommunication
);

router.post(
  "/webhooks/resend",
  requireWebhookSecret,
  validate(communicationWebhookSchema),
  handleCommunicationWebhook
);

export default router;
