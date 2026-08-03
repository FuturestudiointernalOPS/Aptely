import { Router } from "express";
import { authGuard } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permissions.middleware";
import { validate } from "@/middleware/validate.middleware";
import { createWebhookSchema, updateWebhookSchema } from "./webhooks.schema";
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateSecret,
} from "./webhooks.controller";

const router = Router();

router.use(authGuard, requirePermission("settings.edit"));

router.get("/", listWebhooks);
router.post("/", validate(createWebhookSchema), createWebhook);
router.patch("/:id", validate(updateWebhookSchema), updateWebhook);
router.delete("/:id", deleteWebhook);
router.post("/:id/rotate-secret", rotateSecret);

export { router as webhooksRouter };
