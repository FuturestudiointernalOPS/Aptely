import { z } from "zod";

// ─── Onboarding Status Enums ──────────────────────────────────────────────────
const onboardingTaskStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"]);

// ─── Template Task Item ───────────────────────────────────────────────────────
const templateTaskItemSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  assigneeType: z.enum(["CANDIDATE", "HR"]).default("CANDIDATE"),
  position: z.number().int().min(0).optional(),
});

// ─── Create Template ──────────────────────────────────────────────────────────
export const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().max(1000).optional(),
  tasks: z.array(templateTaskItemSchema).min(1, "At least one task is required"),
});

// ─── Update Template ──────────────────────────────────────────────────────────
export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  tasks: z.array(templateTaskItemSchema).min(1).optional(),
});

// ─── Instantiate Checklist ────────────────────────────────────────────────────
export const instantiateChecklistSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  templateId: z.string().uuid("Invalid template ID"),
});

// ─── Update Task Status ───────────────────────────────────────────────────────
export const updateTaskStatusSchema = z.object({
  status: onboardingTaskStatusEnum,
});

// ─── Onboarding Documents ─────────────────────────────────────────────────────
export const presignOnboardingUploadSchema = z.object({
  checklistId: z.string().uuid("Invalid checklist ID"),
  taskId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(150),
});

export const completeOnboardingUploadSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
  storagePath: z.string().min(1),
});

export const verifyOnboardingDocumentSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  notes: z.string().max(2000).optional(),
});

// ─── List Templates Query ─────────────────────────────────────────────────────
export const listTemplatesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type InstantiateChecklistInput = z.infer<typeof instantiateChecklistSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
export type PresignOnboardingUploadInput = z.infer<typeof presignOnboardingUploadSchema>;
export type CompleteOnboardingUploadInput = z.infer<typeof completeOnboardingUploadSchema>;
export type VerifyOnboardingDocumentInput = z.infer<typeof verifyOnboardingDocumentSchema>;

// ─── Phase F — Signing chain ──────────────────────────────────────────────────

export const initSigningChainSchema = z.object({
  signers: z
    .array(
      z.object({
        signer_role: z.string().min(1).max(100),  // 'STANDARD_HR' | 'HR_LEAD' | 'OWNER' | 'CANDIDATE' | custom
        signer_user_id: z.string().uuid().optional(), // optional pre-assignment
      })
    )
    .min(1)
    .max(10),
});

export const signDocumentSchema = z.object({
  signature_meta: z
    .record(z.string(), z.unknown())
    .optional()
    .default({}),
});

export const rejectSignerStepSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export type InitSigningChainInput = z.infer<typeof initSigningChainSchema>;
export type SignDocumentInput = z.infer<typeof signDocumentSchema>;
export type RejectSignerStepInput = z.infer<typeof rejectSignerStepSchema>;
