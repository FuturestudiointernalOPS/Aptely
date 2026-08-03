"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Mail,
  Building2,
  User,
} from "lucide-react";
import { ROUTES, PROXY_API, loginWithError } from "@/lib/routes";

function AptelyWordmark({
  variant = "white",
}: {
  variant?: "white" | "adaptive";
}) {
  const stroke = variant === "adaptive" ? "var(--text-primary)" : "white";
  const textCls =
    variant === "adaptive" ? "text-[var(--text-primary)]" : "text-white";
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 40 40"
        className="w-8 h-8 flex-shrink-0"
        aria-hidden="true"
      >
        <circle
          cx="22"
          cy="18"
          r="12"
          fill="none"
          stroke={stroke}
          strokeWidth="4"
        />
        <line
          x1="6"
          y1="34"
          x2="14"
          y2="26"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M22 10 L23.2 16.8 L30 18 L23.2 19.2 L22 26 L20.8 19.2 L14 18 L20.8 16.8 Z"
          fill="#FF6B00"
        />
      </svg>
      <span
        className={`${textCls} text-xl font-bold tracking-tight`}
        style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
      >
        Aptely
      </span>
    </div>
  );
}

function createRegisterSchema(
  translate: (key: string, fallback: string) => string,
) {
  return z
    .object({
      fullName: z
        .string()
        .min(
          2,
          translate(
            "auth.register.validation.fullNameMin",
            "Full name must be at least 2 characters",
          ),
        )
        .max(80),
      email: z
        .string()
        .email(
          translate(
            "auth.register.validation.email",
            "Please enter a valid email address",
          ),
        ),
      password: z
        .string()
        .min(
          8,
          translate(
            "auth.register.validation.passwordMin",
            "Password must be at least 8 characters",
          ),
        )
        .regex(
          /[A-Z]/,
          translate(
            "auth.register.validation.passwordUpper",
            "Must contain at least one uppercase letter",
          ),
        )
        .regex(
          /[0-9]/,
          translate(
            "auth.register.validation.passwordNumber",
            "Must contain at least one number",
          ),
        ),
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: translate(
        "auth.register.validation.passwordMatch",
        "Les mots de passe ne correspondent pas",
      ),
      path: ["confirmPassword"],
    });
}

type RegisterFields = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type AccountType = "company" | "candidate" | null;
type Step = "choose" | "form" | "otp";

function RegisterForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = getClientLocale();
  const translate = (key: string, fallback: string) => t(locale, key, fallback);
  const RegisterSchema = createRegisterSchema(translate);
  const redirect =
    searchParams.get("redirect") || searchParams.get("from") || "";
  const inviteToken = searchParams.get("token") || "";
  const isSafeInternalRedirect =
    redirect.startsWith("/") && !redirect.startsWith("//");

  const [step, setStep] = useState<Step>(inviteToken ? "form" : "choose");
  const [accountType, setAccountType] = useState<AccountType>(
    inviteToken ? "company" : null,
  );
  const [form, setForm] = useState<RegisterFields>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const validate = RegisterSchema.safeParse(form);
    if (!validate.success) {
      const errors: Record<string, string> = {};
      for (const issue of validate.error.issues) {
        const key = issue.path.join(".");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(PROXY_API.authRegisterRequestOtp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      if (!res.ok) {
        let errorMsg = translate("auth.register.failed", "Failed to send code");
        try {
          const err = await res.json();
          if (err.error) errorMsg = err.error;
        } catch {
          /* ignore parse failure */
        }
        setServerError(errorMsg);
        return;
      }
      setStep("otp");
      setResendCooldown(60);
    } catch {
      setServerError(
        translate(
          "auth.register.unexpectedError",
          "An unexpected error occurred",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (idx: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[idx] = value.slice(-1);
    setOtp(next);
    if (value && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const handleCompleteRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const code = otp.join("");
    if (code.length < 6) {
      setServerError(
        translate("auth.register.otp.incomplete", "Enter the 6-digit code"),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(PROXY_API.authRegister, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, otp: code }),
      });
      if (!res.ok) {
        let errorMsg = translate(
          "auth.register.failed",
          "Failed to create account",
        );
        try {
          const err = await res.json();
          if (err.error) {
            errorMsg = err.error;
            // Provide a more user-friendly message for common OTP errors
            if (err.error === "Incorrect verification code") {
              errorMsg = translate(
                "auth.register.otp.wrong",
                "Le code est incorrect. Vérifiez et réessayez.",
              );
            } else if (err.error === "Invalid or expired verification code") {
              errorMsg = translate(
                "auth.register.otp.invalid",
                "Le code est invalide ou expiré. Demandez-en un nouveau.",
              );
            } else if (err.error === "Verification code has expired") {
              errorMsg = translate(
                "auth.register.otp.expired",
                "Le code a expiré. Demandez-en un nouveau.",
              );
            } else if (err.error === "Verification code is required") {
              errorMsg = translate(
                "auth.register.otp.required",
                "Le code de vérification est requis.",
              );
            }
          }
        } catch {
          /* ignore parse failure */
        }
        setServerError(errorMsg);
        setIsSubmitting(false);
        return;
      }

      const result = await res.json();
      const data = result.data !== undefined ? result.data : result;

      // Clear any stale HR session before logging in as the new account
      await fetch("/api/auth/clear-cookies", { method: "POST" }).catch(
        () => {},
      );
      if (typeof window !== "undefined") {
        localStorage.removeItem("aptely_active_workspace");
        localStorage.removeItem("user_institutionId");
      }

      const loginRes = await login(form.email, form.password);
      if (!loginRes.success) {
        router.push(loginWithError("auto_login_failed"));
        return;
      }

      if (isSafeInternalRedirect && redirect) {
        router.push(redirect);
        return;
      }

      // Redirect based on account type chosen at registration
      if (accountType === "company") {
        if (inviteToken) {
          router.push(`${ROUTES.join}/${inviteToken}`);
        } else {
          // Send to onboarding page (create or join) — user has no institution yet
          router.push(ROUTES.company.settings.onboarding);
        }
      } else {
        router.push(ROUTES.candidate.dashboard);
      }
    } catch {
      setServerError(
        translate(
          "auth.register.unexpectedError",
          "An unexpected error occurred",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setServerError(null);
    try {
      const res = await fetch(PROXY_API.authRegisterRequestOtp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      if (res.ok) {
        setOtp(["", "", "", "", "", ""]);
        setResendCooldown(60);
        otpRefs.current[0]?.focus();
      } else {
        let errorMsg = translate(
          "auth.register.resendFailed",
          "Échec du renvoi du code",
        );
        try {
          const err = await res.json();
          if (err.error) errorMsg = err.error;
        } catch {
          /* ignore parse failure */
        }
        setServerError(errorMsg);
      }
    } catch {
      /* silent */
    }
  };

  const inputStyle = {
    background: "var(--bg-raised)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--accent)";
  };
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--border)";
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel — always dark ── */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between p-12 flex-shrink-0"
        style={{ background: "oklch(14% 0.025 255)" }}
      >
        {/* Logo */}
        <AptelyWordmark />

        {/* Center: tagline */}
        <div className="space-y-6">
          <p
            className="text-[2.1rem] leading-[1.2] font-bold text-white"
            style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
          >
            {t(
              locale,
              "register.brand.tagline",
              "Create your account. Start hiring.",
            )}
          </p>
          <p className="text-white/50 text-base leading-relaxed max-w-xs">
            {t(
              locale,
              "register.brand.taglineDesc",
              "One account is enough — personal or organization. Join teams structuring their hiring on data.",
            )}
          </p>
        </div>

        {/* Testimonial */}
        <figure className="space-y-3">
          <blockquote className="text-white/70 text-sm leading-relaxed italic">
            {t(
              locale,
              "auth.brand.testimonial",
              "“Aptely cut our shortlist by 50%. We spend less time sorting and more time meeting the right candidates.”",
            )}
          </blockquote>
          <figcaption className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/40 flex items-center justify-center flex-shrink-0">
              <span className="text-[#FF6B00] text-xs font-bold">M</span>
            </div>
            <div>
              <span className="text-white/80 text-xs font-semibold">
                Marie L.
              </span>
              <span className="text-white/35 text-xs">
                {t(
                  locale,
                  "auth.brand.testimonialRole",
                  " · HR Director, Series B",
                )}
              </span>
            </div>
          </figcaption>
        </figure>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[var(--bg-deep)]">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <AptelyWordmark variant="adaptive" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1
              className="text-2xl font-bold text-[var(--text-primary)] tracking-tight"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              {step === "choose"
                ? translate("auth.register.chooseTitle", "Créer un compte")
                : step === "form"
                  ? translate("auth.register.title", "Vos informations")
                  : translate("auth.register.otp.title", "Vérifiez vos emails")}
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1.5">
              {step === "choose"
                ? translate(
                    "auth.register.chooseSubtitle",
                    "Comment souhaitez-vous utiliser Aptely ?",
                  )
                : step === "form"
                  ? translate("auth.register.subtitle", "Rejoignez Aptely")
                  : `Code envoyé à ${form.email}`}
            </p>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-7 border"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
            }}
          >
            {/* ── Step 0: Choose account type ── */}
            {step === "choose" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType("company");
                    setStep("form");
                  }}
                  className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-dim)] transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent)]/20">
                    <Building2 className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {translate(
                        "auth.register.typeCompany",
                        "Je suis une entreprise",
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {translate(
                        "auth.register.typeCompanyDesc",
                        "Recrutez, planifiez des entretiens, gérez vos équipes.",
                      )}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountType("candidate");
                    setStep("form");
                  }}
                  className="w-full flex items-start gap-4 p-5 rounded-xl border-2 border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-dim)] transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent)]/20">
                    <User className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {translate(
                        "auth.register.typeCandidate",
                        "Je suis un candidat",
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {translate(
                        "auth.register.typeCandidateDesc",
                        "Postulez, suivez vos candidatures, gérez votre profil.",
                      )}
                    </p>
                  </div>
                </button>

                <p className="text-xs text-[var(--text-muted)] text-center pt-2">
                  {translate("auth.register.alreadyHave", "Déjà un compte ?")}{" "}
                  <Link
                    href={
                      redirect
                        ? `${ROUTES.login}?redirect=${encodeURIComponent(redirect)}`
                        : ROUTES.login
                    }
                    className="text-[var(--accent)] font-semibold hover:opacity-80 transition-opacity"
                  >
                    {translate("auth.login.signIn", "Se connecter")}
                  </Link>
                </p>
              </div>
            )}

            {/* ── Step 1: Registration form ── */}
            {step === "form" && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                {/* Account type badge + back */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/20">
                    {accountType === "company" ? (
                      <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[var(--accent)]" />
                    )}
                    <span className="text-xs font-semibold text-[var(--accent)]">
                      {accountType === "company"
                        ? translate("auth.register.typeCompany", "Entreprise")
                        : translate("auth.register.typeCandidate", "Candidat")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    {translate("common.back", "Modifier")}
                  </button>
                </div>

                {serverError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {serverError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[var(--text-primary)]">
                    {translate("auth.register.fullName", "Nom complet")}
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, fullName: e.target.value }))
                    }
                    placeholder={translate("auth.namePlaceholder", "Elon Musk")}
                    className="w-full rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none"
                    style={inputStyle}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                  {fieldErrors.fullName && (
                    <p className="text-red-400 text-xs mt-1">
                      {fieldErrors.fullName}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[var(--text-primary)]">
                    {translate("auth.register.email", "Adresse email")}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder={translate(
                      "auth.emailPlaceholder",
                      "elon@spacex.com",
                    )}
                    className="w-full rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none"
                    style={inputStyle}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                  {fieldErrors.email && (
                    <p className="text-red-400 text-xs mt-1">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[var(--text-primary)]">
                    {translate("auth.register.password", "Mot de passe")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder={translate(
                        "auth.passwordPlaceholder",
                        "••••••••",
                      )}
                      className="w-full rounded-xl pl-4 pr-11 py-2.5 text-sm transition-colors focus:outline-none"
                      style={inputStyle}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-red-400 text-xs mt-1">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[var(--text-primary)]">
                    {translate(
                      "auth.register.confirmPassword",
                      "Confirmer le mot de passe",
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          confirmPassword: e.target.value,
                        }))
                      }
                      placeholder={translate(
                        "auth.passwordPlaceholder",
                        "••••••••",
                      )}
                      className="w-full rounded-xl pl-4 pr-11 py-2.5 text-sm transition-colors focus:outline-none"
                      style={inputStyle}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <p
                  className="text-xs leading-relaxed pt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {translate(
                    "auth.register.intro",
                    "Un compte. Un espace personnel. Rejoignez ou créez une institution à tout moment.",
                  )}
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                  style={{ background: "var(--accent)" }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {translate(
                        "auth.register.sendingCode",
                        "Envoi en cours...",
                      )}
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      {translate(
                        "auth.register.continueWithEmail",
                        "Continuer avec l'email",
                      )}
                    </>
                  )}
                </button>

                <p
                  className="text-center text-sm pt-3 border-t"
                  style={{
                    color: "var(--text-muted)",
                    borderColor: "var(--border)",
                  }}
                >
                  {translate("auth.register.hasAccount", "Déjà un compte ?")}{" "}
                  <Link
                    href={`/login${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
                    className="font-semibold hover:opacity-80 transition-opacity"
                    style={{ color: "var(--accent)" }}
                  >
                    {translate("auth.register.signIn", "Se connecter")}
                  </Link>
                </p>
              </form>
            )}

            {/* ── Step 2: OTP verification ── */}
            {step === "otp" && (
              <form onSubmit={handleCompleteRegister} className="space-y-5">
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setServerError(null);
                    setOtp(["", "", "", "", "", ""]);
                  }}
                  className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {translate("auth.register.otp.back", "Retour")}
                </button>

                {serverError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {serverError}
                  </div>
                )}

                <div>
                  <label
                    className="block text-sm font-semibold mb-3 text-center"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {translate(
                      "auth.register.otp.label",
                      "Entrez le code à 6 chiffres",
                    )}
                  </label>
                  <div
                    className="flex gap-2 justify-center"
                    onPaste={handleOtpPaste}
                  >
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-11 h-13 text-center text-lg font-bold rounded-xl focus:outline-none transition-colors"
                        style={{
                          background: "var(--bg-raised)",
                          border: digit
                            ? "1px solid var(--accent)"
                            : "1px solid var(--border)",
                          color: "var(--text-primary)",
                          height: "3.25rem",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otp.join("").length < 6}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--accent)" }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {translate(
                        "auth.register.creating",
                        "Création du compte...",
                      )}
                    </>
                  ) : (
                    translate(
                      "auth.register.otp.verify",
                      "Vérifier et créer le compte",
                    )
                  )}
                </button>

                <p
                  className="text-center text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {translate("auth.register.otp.noCode", "Pas reçu ?")}{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="font-semibold hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: "var(--accent)" }}
                  >
                    {resendCooldown > 0
                      ? t(locale, "register.resendIn", "Resend in {{s}}s", {
                          s: resendCooldown,
                        })
                      : translate("auth.register.otp.resend", "Resend code")}
                  </button>
                </p>
              </form>
            )}
          </div>

          {/* Footer */}
          <p
            className="mt-8 text-center text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            &copy; 2026 Aptely.{" "}
            <Link
              href={ROUTES.privacy}
              className="hover:opacity-80 transition-opacity"
              style={{ color: "var(--text-muted)" }}
            >
              Politique de confidentialité
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
