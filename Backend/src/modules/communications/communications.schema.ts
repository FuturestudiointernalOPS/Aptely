import { z } from "zod";

const communicationTypeEnum = z.enum([
  "DECISION_ACCEPT",
  "DECISION_REJECT",
  "DECISION_HOLD",
]);

export const getTemplatesQuerySchema = z.object({
  type: communicationTypeEnum.optional(),
});

export const dispatchDecisionSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  decisionAction: z.enum(["ACCEPT", "REJECT", "HOLD"]),
  templateId: z.string().uuid().optional(),
  subject: z.string().max(300).optional(),
  message: z.string().max(10000).optional(),
  sendEmail: z.boolean().default(true),
});

export const communicationWebhookSchema = z.object({
  provider: z.string().default("resend"),
  providerMessageId: z.string().min(1),
  event: z.enum(["SENT", "DELIVERED", "OPENED", "CLICKED", "FAILED"]),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GetTemplatesQuery = z.infer<typeof getTemplatesQuerySchema>;
export type DispatchDecisionInput = z.infer<typeof dispatchDecisionSchema>;
export type CommunicationWebhookInput = z.infer<typeof communicationWebhookSchema>;
