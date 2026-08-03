"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, Mail, ArrowLeft } from "lucide-react";

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
import { ROUTES, authForgotPasswordApi } from "@/lib/routes";

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export default function ForgotPasswordPage() {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = ForgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message || tr("auth.forgot.error.invalidEmail", "Invalid email"));
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch(authForgotPasswordApi, "none", {
        method: "POST",
        body: JSON.stringify({ email: result.data.email }),
      });

      if (data === null) {
        setError(tr("auth.forgot.error.sendFailed", "Failed to send reset email. Please try again."));
        return;
      }

      setSubmitted(true);
    } catch {
      setError(tr("auth.forgot.error.server", "Unable to reach the server. Please try again later."));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/[0.06] border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 p-3">
              <AptelyLogo />
            </div>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

            <h1 className="text-2xl font-bold text-center text-[var(--text-primary)] mb-3">{tr("auth.forgot.checkEmailTitle", "Check your email")}</h1>
          <p className="text-[var(--text-secondary)] text-center mb-6">
              {tr("auth.forgot.checkEmailDescriptionPrefix", "We've sent a password reset link to")} <strong>{email}</strong>. {tr("auth.forgot.checkEmailDescriptionSuffix", "Click the link in the email to reset your password.")}
          </p>

          <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-400">
                <strong>{tr("auth.forgot.tip", "Tip")}:</strong> {tr("auth.forgot.tipDescription", "Check your spam folder if you don't see the email in a few minutes.")}
            </p>
          </div>

          <Link
            href={ROUTES.login}
            className="flex items-center justify-center gap-2 w-full py-3 bg-aptely-orange hover:bg-aptely-orange/90 text-white font-display font-bold rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            {tr("auth.forgot.backToLogin", "Back to login")}
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
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">{tr("auth.forgot.title", "Reset your password")}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {tr("auth.forgot.subtitle", "Enter your email address and we'll send you a link to reset your password.")}
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-[var(--text-primary)]">{tr("auth.forgot.emailLabel", "Email address")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr("auth.forgot.emailPlaceholder", "your@email.com")}
                  className="w-full bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)]/40 focus:outline-none focus:border-aptely-blue transition-colors text-sm"
                />
              </div>
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
              {loading ? tr("auth.forgot.sending", "Sending...") : tr("auth.forgot.sendLink", "Send reset link")}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {tr("auth.forgot.rememberPassword", "Remember your password?")}{" "}
              <Link href={ROUTES.login} className="text-aptely-orange hover:underline font-bold">
                {tr("auth.forgot.login", "Log in")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
