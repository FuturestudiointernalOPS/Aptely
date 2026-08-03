import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

const waveStatusEnum = z.enum(["DRAFT", "ACTIVE", "CLOSED", "CANCELLED"]);
const waveCandidateStatusEnum = z.enum(["INVITED", "BOOKED", "NO_SHOW", "PASSED", "FAILED", "WITHDRAWN"]);

// ─── POST /waves — Create wave ────────────────────────────────────────────────

export const createWaveSchema = z.object({
  roleId: z.string().uuid("Invalid role ID"),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  waveOrder: z.number().int().min(1).optional().default(1),
  templateId: z.string().uuid().optional(),
  bookingOpenAt: z.string().datetime().optional(),
  bookingCloseAt: z.string().datetime().optional(),
  autoPlaceOnMatch: z.boolean().optional().default(false),
  autoPlaceThreshold: z.number().min(0).max(100).optional(),
  prerequisiteWaveId: z.string().uuid().optional(),
  forceAddAllowed: z.boolean().optional().default(true),
});
export type CreateWaveInput = z.infer<typeof createWaveSchema>;

// ─── PATCH /waves/:id — Update wave ──────────────────────────────────────────

export const updateWaveSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  status: waveStatusEnum.optional(),
  waveOrder: z.number().int().min(1).optional(),
  bookingOpenAt: z.string().datetime().optional().nullable(),
  bookingCloseAt: z.string().datetime().optional().nullable(),
  autoPlaceOnMatch: z.boolean().optional(),
  autoPlaceThreshold: z.number().min(0).max(10).optional().nullable(),
  prerequisiteWaveId: z.string().uuid().optional().nullable(),
  forceAddAllowed: z.boolean().optional(),
});
export type UpdateWaveInput = z.infer<typeof updateWaveSchema>;

// ─── POST /waves/:id/slots/generate — Batch-generate slots ───────────────────

export const generateWaveSlotsSchema = z.object({
  startDate: z.string().datetime("Invalid ISO datetime"),
  endDate: z.string().datetime("Invalid ISO datetime"),
  slotDurationMinutes: z.number().int().min(15).max(480).default(60),
  capacity: z.number().int().min(1).max(100).default(1),
  workingHoursStart: z.number().min(0).max(23).default(9),
  workingHoursEnd: z.number().min(1).max(24).default(18),
  meetingProvider: z.enum(["GOOGLE_MEET", "TEAMS", "MANUAL"]).default("MANUAL"),
  meetingLocation: z.string().max(300).optional(),
  interviewerIds: z.array(z.string().uuid()).optional().default([]),
});
export type GenerateWaveSlotsInput = z.infer<typeof generateWaveSlotsSchema>;

// ─── POST /waves/:id/slots — Create single slot ───────────────────────────────

export const createWaveSlotSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().min(1).max(100).default(1),
  meetingProvider: z.enum(["GOOGLE_MEET", "TEAMS", "MANUAL"]).default("MANUAL"),
  meetingLink: z.string().url().optional().nullable(),
  meetingLocation: z.string().max(300).optional().nullable(),
  interviewerIds: z.array(z.string().uuid()).optional().default([]),
});
export type CreateWaveSlotInput = z.infer<typeof createWaveSlotSchema>;

// ─── POST /waves/:id/candidates/invite — Invite candidates to wave ───────────

export const inviteCandidatesSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).max(500),
  forceAdd: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(true),
});
export type InviteCandidatesInput = z.infer<typeof inviteCandidatesSchema>;

// ─── POST /waves/booking/:token/confirm — Public booking confirm ─────────────

export const confirmWaveBookingSchema = z.object({
  slotId: z.string().uuid("Invalid slot ID"),
});
export type ConfirmWaveBookingInput = z.infer<typeof confirmWaveBookingSchema>;

// ─── PATCH /waves/:id/candidates/:waveApplicationId/status ───────────────────

export const updateWaveCandidateStatusSchema = z.object({
  status: waveCandidateStatusEnum,
  notes: z.string().max(2000).optional().nullable(),
});
export type UpdateWaveCandidateStatusInput = z.infer<typeof updateWaveCandidateStatusSchema>;

// ─── POST /waves/templates — Create template ─────────────────────────────────

export const createWaveTemplateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  defaultDurationMinutes: z.number().int().min(15).max(480).default(60),
  defaultSlotCapacity: z.number().int().min(1).max(100).default(1),
  criteriaJson: z.record(z.string(), z.unknown()).optional(),
});
export type CreateWaveTemplateInput = z.infer<typeof createWaveTemplateSchema>;
