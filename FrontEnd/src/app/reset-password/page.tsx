"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";

function AptelyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className ?? "w-full h-full"}>
      <circle cx="55" cy="45" r="30" fill="none" stroke="white" strokeWidth="10" />
      <line x1="15" y1="85" x2="35" y2="65" stroke="white" strokeWidth="12" strokeLinecap="round" />
      <path d="M55 25 L58 42 L75 45 L58 48 L55 65 L52 48 L35 45 L52 42 Z" fill="#FF6B00" />
    </svg>
  );
}
import { z } from "zod";
import { getClientLocale, t } from "@/lib/i18n";
import { apiFetch } from "@/lib/apiHelper";
import { ROUTES, authResetPasswordApi } from "@/lib/routes";

const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[0-9]/),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const tokenHashParam = searchParams.get("token_hash");
  const tokenParam = searchParams.get("token");
  // Backend expects token_hash (Supabase recovery links). Keep token fallback for legacy compatibility.
  const tokenHash = tokenHashParam ?? tokenParam;
  const tokenLooksLikeJwt = tokenHash?.split(".").length === 3;

  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tokenHash) {
      setError(
        tr(
          "auth.reset.error.invalidLink",
          "Invalid reset link. Please request a new password reset."
        )
      );
    }
  }, [tokenHash, tr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = ResetPasswordSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        errors[path] = err.message;
      });
      if (errors.password === "String must contain at least 8 character(s)") {
        errors.password = tr(
          "auth.reset.error.passwordMin",
          "Password must be at least 8 characters"
        );
      }
      if (errors.password === "Invalid") {
        errors.password = tr(
          "auth.reset.error.passwordComplexity",
          "Password must contain at least one uppercase letter and one number"
        );
      }
      if (errors.confirmPassword === "Passwords don't match") {
        errors.confirmPassword = tr(
          "auth.reset.error.passwordMismatch",
          "Passwords don't match"
        );
      }
      setFieldErrors(errors);
      return;
    }

    if (!tokenHash) {
      setError(tr("auth.reset.error.invalidLinkShort", "Invalid reset link."));
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch(authResetPasswordApi, "none", {
        method: "POST",
        // Backend accepts either { token_hash, password } or { access_token, password }
        body: JSON.stringify({
          ...(tokenLooksLikeJwt ? { access_token: tokenHash } : { token_hash: tokenHash }),
          password: result.data.password,
        }),
      });

      if (data === null) {
        setError(tr("auth.reset.error.resetFailed", "Failed to reset password. Please try again."));
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(ROUTES.login);
      }, 3000);
    } catch {
      setError(tr("auth.reset.error.server", "Unable to reach the server. Please try again later."));
    } finally {
      setLoading(false);
    }
  };

  if (!tokenHash) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/[0.06] border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-5 p-3">
              <AptelyLogo />
            </div>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-8">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
            </div>
            <h1 className="text-2xl font-display font-bold text-center text-[var(--text-primary)] mb-3">
              {tr("auth.reset.invalidLinkTitle", "Invalid link")}
            </h1>
            <p className="text-[var(--text-muted)] text-center text-sm mb-6">
              {tr(
                "auth.reset.invalidLinkDescription",
                "This password reset link is invalid or has expired."
              )}
            </p>
            <Link
              href={ROUTES.forgot}
              className="block w-full py-4 bg-aptely-orange hover:bg-aptely-orange/90 text-white font-display font-bold rounded-xl text-center transition-all text-sm"
            >
              {tr("auth.reset.requestNewLink", "Request new link")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/[0.06] border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-5 p-3">
              <AptelyLogo />
            </div>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-8 animate-fade-in">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
            </div>

            <h1 className="text-2xl font-display font-bold text-center text-[var(--text-primary)] mb-3">
              {tr("auth.reset.successTitle", "Password reset successful")}
            </h1>
            <p className="text-[var(--text-muted)] text-center text-sm mb-6">
              {tr(
                "auth.reset.successDescription",
                "Your password has been reset successfully. You'll be redirected to login shortly..."
              )}
            </p>

            <Link
              href={ROUTES.login}
              className="block w-full py-4 bg-aptely-orange hover:bg-aptely-orange/90 text-white font-display font-bold rounded-xl text-center transition-all text-sm"
            >
              {tr("auth.reset.goToLogin", "Go to login")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/[0.06] border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-5 p-3">
            <AptelyLogo />
          </div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            {tr("auth.reset.title", "Set new password")}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {tr(
              "auth.reset.subtitle",
              "Enter your new password below. Make sure it's secure and different from your previous password."
            )}
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-8 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-[var(--text-primary)]">
                {tr("auth.reset.newPassword", "New password")}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder={tr("auth.resetPasswordPlaceholder", "••••••••")}
                  className={`w-full bg-[var(--bg-deep)] border-2 rounded-xl pl-10 pr-10 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)]/40 focus:outline-none transition-colors text-sm ${
                    fieldErrors.password
                      ? "border-red-500"
                      : "border-[var(--border)] focus:border-aptely-blue"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-[var(--text-primary)]">
                {tr("auth.reset.confirmPassword", "Confirm password")}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  placeholder={tr("auth.resetPasswordPlaceholder", "••••••••")}
                  className={`w-full bg-[var(--bg-deep)] border-2 rounded-xl pl-10 pr-10 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)]/40 focus:outline-none transition-colors text-sm ${
                    fieldErrors.confirmPassword
                      ? "border-red-500"
                      : "border-[var(--border)] focus:border-aptely-blue"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-aptely-orange hover:bg-aptely-orange/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-bold rounded-xl transition-all text-sm mt-2"
            >
              {loading
                ? tr("auth.reset.resetting", "Resetting...")
                : tr("auth.reset.resetPassword", "Reset password")}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {tr("auth.reset.rememberPassword", "Remember your password?")}{" "}
              <Link href={ROUTES.login} className="text-aptely-orange hover:underline font-bold">
                {tr("auth.reset.login", "Log in")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
