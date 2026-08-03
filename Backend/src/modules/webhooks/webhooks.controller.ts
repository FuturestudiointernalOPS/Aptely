import { Response } from "express";
import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import { asyncHandler } from "@/utils/helpers";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { generateSecret, encryptWebhookSecret } from "./webhooks.service";
import { CreateWebhookInput, UpdateWebhookInput } from "./webhooks.schema";

function resolveInstitutionId(req: AuthenticatedRequest): string {
  const id = req.workspace?.institutionId ?? req.headers["x-workspace-id"];
  if (!id || typeof id !== "string") throw new AppError(400, "Missing institution context");
  return id;
}

export const listWebhooks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = resolveInstitutionId(req);
  const { data, error } = await supabaseAdmin
    .from("institution_webhooks")
    .select("id, url, events, description, is_active, created_at")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });
  if (error) throw new AppError(500, "Failed to fetch webhooks");
  res.json({ data: data ?? [] });
});

export const createWebhook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = resolveInstitutionId(req);
  const { url, events, description } = req.body as CreateWebhookInput;
  const plainSecret = generateSecret();
  const encryptedSecret = encryptWebhookSecret(plainSecret);

  const { data, error } = await supabaseAdmin
    .from("institution_webhooks")
    .insert({
      institution_id: institutionId,
      url,
      events,
      description: description ?? null,
      secret: encryptedSecret,
      created_by: req.user!.id,
    })
    .select("id, url, events, description, is_active, created_at")
    .single();

  if (error || !data) throw new AppError(500, "Failed to create webhook");
  // Return the plain secret once — never stored in plain form again
  res.status(201).json({ data: { ...data, secret: plainSecret } });
});

export const updateWebhook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = resolveInstitutionId(req);
  const webhookId = req.params.id as string;
  const input = req.body as UpdateWebhookInput;

  const { data: existing } = await supabaseAdmin
    .from("institution_webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("institution_id", institutionId)
    .single();
  if (!existing) throw new AppError(404, "Webhook not found");

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.url !== undefined) update.url = input.url;
  if (input.events !== undefined) update.events = input.events;
  if (input.description !== undefined) update.description = input.description;
  if (input.is_active !== undefined) update.is_active = input.is_active;

  const { data, error } = await supabaseAdmin
    .from("institution_webhooks")
    .update(update)
    .eq("id", webhookId)
    .select("id, url, events, description, is_active, updated_at")
    .single();

  if (error || !data) throw new AppError(500, "Failed to update webhook");
  res.json({ data });
});

export const deleteWebhook = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = resolveInstitutionId(req);
  const webhookId = req.params.id as string;

  const { error } = await supabaseAdmin
    .from("institution_webhooks")
    .delete()
    .eq("id", webhookId)
    .eq("institution_id", institutionId);

  if (error) throw new AppError(500, "Failed to delete webhook");
  res.status(204).send();
});

export const rotateSecret = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const institutionId = resolveInstitutionId(req);
  const webhookId = req.params.id as string;

  const { data: existing } = await supabaseAdmin
    .from("institution_webhooks")
    .select("id")
    .eq("id", webhookId)
    .eq("institution_id", institutionId)
    .single();
  if (!existing) throw new AppError(404, "Webhook not found");

  const plainSecret = generateSecret();
  const encryptedSecret = encryptWebhookSecret(plainSecret);
  const { error } = await supabaseAdmin
    .from("institution_webhooks")
    .update({ secret: encryptedSecret, updated_at: new Date().toISOString() })
    .eq("id", webhookId);

  if (error) throw new AppError(500, "Failed to rotate secret");
  res.json({ secret: plainSecret });
});
