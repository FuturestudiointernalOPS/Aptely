import { z } from "zod";

// ─── POST /institution/create ─────────────────────────────────────────────────

export const createInstitutionSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  website: z.string().url("Invalid URL").optional(),
  sector: z.string().max(100).optional(),
  teamSize: z.string().max(20).optional(), // "1-10", "51-200", etc.
  stage: z.string().max(50).optional(), // "Seed", "Series A", etc.
  location: z.string().max(200).optional(),
  description: z.string().trim().min(1, "Description is required").max(1000),
  ownerRoleLabel: z.string().max(80).optional(), // Founder's custom role title (e.g. "Directeur RH")
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;

// ─── POST /institution/join ───────────────────────────────────────────────────

export const joinInstitutionSchema = z.object({
  institutionId: z.string().uuid("Invalid institution ID"),
});

export type JoinInstitutionInput = z.infer<typeof joinInstitutionSchema>;

// ─── PATCH /institution ───────────────────────────────────────────────────────

export const updateInstitutionSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    website: z.string().url("Must be a valid URL").optional().nullable(),
    sector: z.string().max(100).optional().nullable(),
    teamSize: z.string().max(20).optional().nullable(), // "1-10", "51-200", etc.
    stage: z.string().max(50).optional().nullable(), // "Seed", "Series A", etc.
    location: z.string().max(200).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    logoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  })
  .strict();

// ─── PATCH /institution/join-requests/:userId ─────────────────────────────────

export const joinRequestActionSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"]),
});

export const updateMemberStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "ACTIVE"]),
});

// ─── POST /institution/transfer-ownership ─────────────────────────────────────

export const transferOwnershipSchema = z.object({
  newOwnerUserId: z.string().uuid("Invalid user ID"),
});

// ─── Custom roles ─────────────────────────────────────────────────────────────

export const createCustomRoleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name too long"),
  rank: z.number().int().min(1).max(99).optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateCustomRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    rank: z.number().int().min(1).max(99).optional(),
    permissions: z.array(z.string()).optional(),
  })
  .refine((d) => d.name !== undefined || d.rank !== undefined || d.permissions !== undefined, {
    message: "Provide a name, rank and/or permissions to update",
  });

// ─── PATCH /institution/members/:userId/role-specialization ───────────────────

export const updateMemberRoleSpecializationSchema = z.object({
  roleSpecialization: z.enum([
    "OWNER",
    "ADMIN",
    "HR_LEAD",
    "HIRING_MANAGER",
    "RECRUITER",
    "STANDARD_HR",
    "MEMBER",
    "CUSTOM",
  ]),
  customRoleId: z.string().uuid("Invalid custom role ID").optional(),
});

// ─── GET/PATCH /institution/personal-settings ───────────────────────────────

export const personalSettingsSchema = z
  .object({
    timezone: z.string().min(1).max(100),
    language: z.enum(["fr", "en", "de", "pt"]),
    emailNotifications: z.boolean(),
    inAppNotifications: z.boolean(),
    interviewReminders: z.boolean(),
    defaultInterviewDuration: z.union([
      z.literal(30),
      z.literal(45),
      z.literal(60),
      z.literal(90),
    ]),
    interviewBufferMinutes: z.union([
      z.literal(0),
      z.literal(10),
      z.literal(15),
      z.literal(30),
    ]),
    workdayStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    workdayEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    calcomLink: z.string().max(200).optional(),
  })
  .strict();

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type JoinRequestActionInput = z.infer<typeof joinRequestActionSchema>;
export type PersonalSettingsInput = z.infer<typeof personalSettingsSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
