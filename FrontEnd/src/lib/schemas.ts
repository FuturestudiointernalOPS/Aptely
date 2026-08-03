/**
 * APTELY — Zod Validation Schemas
 * Central place for all input validation, mirroring backend constraints.
 * Used by forms (client-side) and middleware (server-side route protection).
 */

import { z } from "zod";

// ── Primitives ─────────────────────────────────────────────────────────────

const nonEmptyString = (max = 255) =>
    z.string().trim().min(1, "This field is required").max(max, `Max ${max} characters`);

const urlField = z
    .string()
    .trim()
    .url("Must be a valid URL (e.g. https://...)")
    .optional()
    .or(z.literal(""));

// ── Auth ───────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

// ── Institution Settings ───────────────────────────────────────────────────

export const InstitutionSettingsSchema = z.object({
    name: nonEmptyString(100),
    website: urlField,
    sector: z.string().trim().max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(150).optional(),
    teamSize: z.number().int().min(0).max(1_000_000).optional(),
    stage: z
        .enum(["Pre-Seed", "Seed", "Series A", "Series B", "Series C+", "Growth", "Public"])
        .optional(),
});

// ── Generic helper ────────────────────────────────────────────────────────

/**
 * Safely parse with Zod and return a flat error map.
 * { fieldName: "error message" }
 */
export function parseForm<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data);
    if (result.success) return { success: true, data: result.data };

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!errors[key]) errors[key] = issue.message;
    }
    return { success: false, errors };
}
