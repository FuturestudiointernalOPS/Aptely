import { z } from "zod";
import { WEBHOOK_EVENTS } from "./webhooks.service";

export const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(20),
  description: z.string().max(200).optional(),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().max(500).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(20).optional(),
  description: z.string().max(200).optional(),
  is_active: z.boolean().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
