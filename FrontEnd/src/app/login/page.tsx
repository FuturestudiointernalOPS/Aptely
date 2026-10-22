"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { LoginSchema, parseForm } from "@/lib/schemas";
import { getClientLocale, t } from "@/lib/i18n";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { ROUTES } from "@/lib/routes";

function AptelyWordmark({ variant = "white" }: { variant?: "white" | "adaptive" }) {
    const stroke = variant === "adaptive" ? "var(--text-primary)" : "white";
    const textCls = variant === "adaptive" ? "text-[var(--text-primary)]" : "text-white";
    return (
        <div className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" className="w-8 h-8 flex-shrink-0" aria-hidden="true">
                <circle cx="22" cy="18" r="12" fill="none" stroke={stroke} strokeWidth="4" />
                <line x1="6" y1="34" x2="14" y2="26" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
                <path d="M22 10 L23.2 16.8 L30 18 L23.2 19.2 L22 26 L20.8 19.2 L14 18 L20.8 16.8 Z" fill="#FF6B00" />
            </svg>
            <span className={`${textCls} text-xl font-bold tracking-tight`} style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                Aptely
            </span>
        </div>
    );
}

function LoginForm() {
    const { login } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const locale = getClientLocale();
    const translate = (key: string, fallback: string) => t(locale, key, fallback);

    const [serverError, setServerError] = useState<string | null>(null);
    const [loadingStage, setLoadingStage] = useState<"idle" | "redirecting">("idle");
    void loadingStage;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError(null);
        setFieldErrors({});

        const parsed = parseForm(LoginSchema, { email, password });
        if (!parsed.success) {
            setFieldErrors(parsed.errors);
            return;
        }

        setIsSubmitting(true);
        setLoadingStage("redirecting");

        try {
            const result = await login(parsed.data.email, parsed.data.password);
            if (!result.success) {
                setServerError(result.error || translate("auth.login.failed", "Invalid email or password"));
                setLoadingStage("idle");
                setIsSubmitting(false);
                return;
            }

            const hasActiveInstitution = Boolean(result.activeInstitutionId ?? result.institutionId);
            // Platform admins without a company have no company workspace; land them on
            // the platform overview even if a stale redirect points at the candidate space.
            if (result.isSuperAdmin && !hasActiveInstitution) {
                router.push(ROUTES.admin.root);
                return;
            }

            const requestedRedirect = searchParams.get("redirect") || searchParams.get("from") || "";
            if (requestedRedirect && requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")) {
                router.push(requestedRedirect);
                return;
            }

            if (hasActiveInstitution) {
                router.push(ROUTES.company.dashboard);
            } else if (result.profileRole === "HR") {
                router.push(ROUTES.company.settings.onboarding);
            } else {
                router.push(ROUTES.candidate.dashboard);
            }
        } catch (err) {
            console.error("[LOGIN] Unexpected error:", err);
            setServerError(translate("auth.login.unexpectedError", "An unexpected error occurred"));
            setLoadingStage("idle");
            setIsSubmitting(false);
        }
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
                    <p className="text-[2.1rem] leading-[1.2] font-bold text-white" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                        {t(locale, "login.brand.tagline", "The platform that hires on proof.")}
                    </p>
                    <p className="text-white/50 text-base leading-relaxed max-w-xs">
                        {t(locale, "login.brand.taglineDesc", "Structure every step — from posting to offer — with data that drives the decision.")}
                    </p>
                </div>

                {/* Testimonial */}
                <figure className="space-y-3">
                    <blockquote className="text-white/70 text-sm leading-relaxed italic">
                        {t(locale, "auth.brand.testimonial", "“Aptely cut our shortlist by 50%. We spend less time sorting and more time meeting the right candidates.”")}
                    </blockquote>
                    <figcaption className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#FF6B00] text-xs font-bold">M</span>
                        </div>
                        <div>
                            <span className="text-white/80 text-xs font-semibold">Marie L.</span>
                            <span className="text-white/35 text-xs">{t(locale, "auth.brand.testimonialRole", " · HR Director, Series B")}</span>
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
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                            {translate("auth.login.title", "Connexion")}
                        </h1>
                        <p className="text-[var(--text-muted)] text-sm mt-1.5">
                            {translate("auth.login.subtitle", "Bienvenue. Entrez vos identifiants.")}
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
                        <div className="space-y-5">
                            {/* Server error */}
                            {serverError && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-sm">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {serverError}
                                </div>
                            )}

                            <form onSubmit={handleEmailLogin} className="space-y-4">
                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-[var(--text-primary)]">
                                        {translate("auth.login.email", "Adresse email")}
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={translate("auth.emailPlaceholder", "elon@spacex.com")}
                                        className="w-full rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none"
                                        style={{
                                            background: "var(--bg-raised)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-primary)",
                                        }}
                                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                                        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                                    />
                                    {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
                                </div>

                                {/* Password */}
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-[var(--text-primary)]">
                                        {translate("auth.login.password", "Mot de passe")}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={translate("auth.passwordPlaceholder", "••••••••")}
                                            className="w-full rounded-xl pl-4 pr-11 py-2.5 text-sm transition-colors focus:outline-none"
                                            style={{
                                                background: "var(--bg-raised)",
                                                border: "1px solid var(--border)",
                                                color: "var(--text-primary)",
                                            }}
                                            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                                            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                            style={{ color: "var(--text-muted)" }}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
                                </div>

                                {/* Forgot password */}
                                <div className="flex justify-end">
                                    <Link
                                        href={ROUTES.forgot}
                                        className="text-xs hover:opacity-80 transition-opacity"
                                        style={{ color: "var(--accent)" }}
                                    >
                                        {translate("auth.login.forgotPassword", "Mot de passe oublié ?")}
                                    </Link>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                                    style={{ background: "var(--accent)" }}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            {translate("auth.login.redirecting", "Connexion...")}
                                        </>
                                    ) : (
                                        translate("auth.login.submit", "Se connecter")
                                    )}
                                </button>
                            </form>

                            {/* Register link */}
                            <p className="text-center text-sm pt-3 border-t" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
                                {translate("auth.login.noAccount", "Pas encore de compte ?")}{" "}
                                <Link
                                    href={`/register${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
                                    className="font-semibold hover:opacity-80 transition-opacity"
                                    style={{ color: "var(--accent)" }}
                                >
                                    {translate("auth.login.createOne", "Créer un compte")}
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="mt-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                        &copy; 2026 Aptely.{" "}
                        <Link href={ROUTES.privacy} className="hover:opacity-80 transition-opacity" style={{ color: "var(--text-muted)" }}>
                            {translate("privacy.titlePre", "Privacy")} {translate("privacy.titleAccent", "Policy")}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}
