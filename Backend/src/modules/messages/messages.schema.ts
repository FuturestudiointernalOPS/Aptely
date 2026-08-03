import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  visibility: z.enum(["internal", "external"]).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
