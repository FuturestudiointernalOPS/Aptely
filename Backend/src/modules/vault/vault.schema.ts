import { z } from "zod";

export const addSkillProofSchema = z.discriminatedUnion("proof_type", [
  z.object({
    proof_type: z.literal("FILE"),
    skill_name: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    file_url: z.string().url("file_url must be a valid URL"),
  }),
  z.object({
    proof_type: z.literal("LINK"),
    skill_name: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    link_url: z.string().url("link_url must be a valid URL"),
  }),
]);

export type AddSkillProofInput = z.infer<typeof addSkillProofSchema>;

export const addWorkEvidenceSchema = z.object({
  skill_proof_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  problem: z.string().min(1).max(3000),
  tools: z.array(z.string().min(1).max(100)).max(20).default([]),
  result: z.string().min(1).max(3000),
  impact_score: z.number().int().min(1).max(5).optional(),
});

export type AddWorkEvidenceInput = z.infer<typeof addWorkEvidenceSchema>;

export const requestEndorsementSchema = z.object({
  endorser_email: z.string().email().max(254),
  endorser_name: z.string().max(200).optional(),
  dimension: z.string().min(1).max(200),
});

export type RequestEndorsementInput = z.infer<typeof requestEndorsementSchema>;

export const submitEndorsementSchema = z.object({
  endorser_name: z.string().max(200).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export type SubmitEndorsementInput = z.infer<typeof submitEndorsementSchema>;
