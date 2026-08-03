import { z } from "zod";

// ─── Register ─────────────────────────────────────────────────────────────────

export const requestOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must not exceed 72 characters"),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters")
    .trim(),
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric").optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Login ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Refresh ──────────────────────────────────────────────────────────────────

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

// ─── Logout ───────────────────────────────────────────────────────────────────
// Logout uses the Bearer token from the Authorization header — no body needed.
// No schema required.

// ─── Forgot Password ──────────────────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    token_hash: z.string().min(1, "Token is required").optional(),
    access_token: z.string().min(1, "Token is required").optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.token_hash || data.access_token, {
    message: "Token is required",
    path: ["token_hash"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Delete My Account ───────────────────────────────────────────────────────

export const deleteMyAccountSchema = z.object({
  confirm: z.literal(true),
});

export type DeleteMyAccountInput = z.infer<typeof deleteMyAccountSchema>;
