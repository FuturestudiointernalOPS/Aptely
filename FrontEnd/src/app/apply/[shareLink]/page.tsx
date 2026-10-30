"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, apiSend } from "@/lib/apiHelper";
import { useAuth } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import {
  AlertCircle, CheckCircle, Loader2, Briefcase, MapPin, ArrowRight, Plus, Trash2, Building2, Clock, Send, FileText
} from "lucide-react";
import { ROUTES, applyPath, createAuthRedirect, applicationPublicApi, rolePublicApi, authMeApi, individualsMeApi } from "@/lib/routes";
import { CURRENCIES } from "@/lib/currencies";

const INDUSTRIES = ["Tech", "Finance", "Healthcare", "E-commerce", "Manufacturing", "Consulting", "Education", "Media"];
const CONTRACT_TYPES = ["FULL_TIME", "PART_TIME", "FREELANCE", "CONTRACT", "INTERNSHIP"];
const WORK_AUTH_OPTIONS = ["CITIZEN", "VISA_SPONSORED", "OTHER"];

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function PublicApplyPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const shareLink = params.shareLink as string;

  const [role, setRole] = useState<Record<string, unknown> | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [errorRole, setErrorRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Form State
  const [step, setStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraDocsRef = useRef<HTMLInputElement>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [extraDocFiles, setExtraDocFiles] = useState<File[]>([]);
  const [existingCvUrl, setExistingCvUrl] = useState<string | null>(null);

  // Identity / Contact
  const [identity, setIdentity] = useState({ fullName: "", email: "", linkedin: "" });
  const [gateChecked, setGateChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Show auth gate UI instead of auto-redirect
      setGateChecked(false);
      return;
    }
    setGateChecked(true);
  }, [authLoading, router, shareLink, user]);

  useEffect(() => {
    if (!gateChecked || !user) return;

    setIdentity((prev) => ({
      ...prev,
      email: user.email || prev.email,
      fullName: prev.fullName || user.fullName || user.email?.split("@")[0] || "",
    }));
  }, [gateChecked, user]);

  const [baseData, setBaseData] = useState({
    primaryRole: "", yearsExperience: 0,
    location: { country: "", city: "" },
    timezone: "UTC",
    availability: { type: "IMMEDIATELY", date: "" },
    workAuth: "CITIZEN", salaryExpectation: 0, salaryCurrency: "EUR",
    industries: [] as string[], contracts: [] as string[]
  });

  const [experiences, setExperiences] = useState([
    { company: "", role: "", period: "", achievements: [""], proofEmail: "", proofDocument: "" },
  ]);

  const [skills, setSkills] = useState([
    { skillName: "", yearsUsed: 0, ownership: "", proofEmail: "", proofDocument: "" },
  ]);

  const [evidence, setEvidence] = useState([
    { projectName: "", problemSolved: "", personalContribution: "", result: "", proofEmail: "", proofLink: "", proofDocument: "" },
  ]);

  const [style, setStyle] = useState({
    chaosVsStructure: 50, speedVsQuality: 50, autonomyVsGuidance: 50, depthVsVariety: 50, pressureComfort: 50,
  });

  const [motivation, setMotivation] = useState({
    growthGoals: "", excitementTriggers: "", threeYearVision: "",
  });

  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  // Prefill from what the candidate already saved elsewhere in the app
  // (account name, profile links/headline/location) — only fills fields still empty.
  useEffect(() => {
    if (!gateChecked || !user) return;
    const prefill = async () => {
      const [me, individual] = await Promise.all([
        apiFetch(authMeApi, "HR", { method: "GET" }).catch(() => null),
        apiFetch(individualsMeApi, "HR", { method: "GET" }).catch(() => null),
      ]);
      const fullNameFromApi = (me as Record<string, unknown> | null)?.full_name as string | undefined;
      const fullNameFromAuth = user.fullName;
      const linkedin = (individual as Record<string, unknown> | null)?.linkedin_url as string | undefined;
      const headline = (individual as Record<string, unknown> | null)?.headline as string | undefined;
      const profileLocation = (individual as Record<string, unknown> | null)?.location as string | undefined;
      const cvUrl = (individual as Record<string, unknown> | null)?.cv_url as string | undefined;
      const resolvedFullName = fullNameFromApi || fullNameFromAuth;
      if (resolvedFullName || linkedin) {
        setIdentity((prev) => ({
          ...prev,
          fullName: prev.fullName || resolvedFullName || "",
          linkedin: prev.linkedin || linkedin || "",
        }));
      }
      if (headline || profileLocation) {
        setBaseData((prev) => ({
          ...prev,
          primaryRole: prev.primaryRole || headline || "",
          location: {
            country: prev.location.country,
            city: prev.location.city || profileLocation || "",
          },
        }));
      }
      // Pre-fill CV: mark that candidate already has a CV on file
      if (cvUrl && !cvFile) {
        setExistingCvUrl(cvUrl);
      }
    };
    void prefill();
  }, [gateChecked, user]);

  useEffect(() => {
    if (!shareLink || !gateChecked) return;
    const fetchRole = async () => {
      try {
        const roleData = await apiFetch(rolePublicApi(shareLink), "none") as Record<string, unknown> | null;

        if (roleData === null) {
          setErrorRole(tr("apply.public.error.roleNotFound", "Role not found. The link might be invalid or expired."));
          return;
        }

        const roleIsOpen =
          roleData?.is_open_for_applications === true || roleData?.status === "ACTIVE";

        if (!roleIsOpen) {
          setErrorRole(tr("apply.public.error.roleClosed", "This role is not open for applications anymore."));
          return;
        }

        setRole(roleData);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : tr("apply.public.error.loadRole", "Failed to load the role. The link might be invalid or expired.");
        setErrorRole(message);
      } finally {
        setLoadingRole(false);
      }
    };
    fetchRole();
  }, [shareLink, gateChecked]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      router.push(ROUTES.candidate.dashboard);
    }, 3000);
    return () => clearTimeout(timer);
  }, [success, router]);

  const handleSubmit = async () => {
    setError(null);
    if (!identity.fullName) {
      setError(tr("apply.public.error.nameRequired", "Name is required on step 1."));
      return;
    }
    if (!isValidEmail(identity.email)) {
      setError(tr("apply.public.error.emailInvalid", "Veuillez saisir une adresse e-mail valide."));
      return;
    }
    // Motivation fields are optional (they help matching but can be in CV)
    // No longer block submission

    setSubmitting(true);
    const formData = new FormData();

    if (cvFile) {
      formData.append("cv", cvFile);
    }

    for (const doc of extraDocFiles) {
      formData.append("documents", doc);
    }

    formData.append("fullName", identity.fullName);
    formData.append("email", identity.email);
    formData.append("linkedin", identity.linkedin);

    const dnaPayload = {
      talent_identity: {
        name: identity.fullName,
        email: identity.email,
        links: { linkedin: identity.linkedin }
      },
      foundation: baseData,
      experience: experiences.filter(e => e.company !== ""),
      skills: skills.filter(s => s.skillName !== ""),
      evidence: evidence.filter(e => e.projectName !== ""),
      work_style: { ...style },
      motivation: motivation
    };

    formData.append("formDna", JSON.stringify(dnaPayload));
    if (Object.keys(customAnswers).length > 0) {
      formData.append("answers", JSON.stringify(customAnswers));
    }

    try {
      const apiPath = applicationPublicApi(shareLink as string);
      console.log("[apply] submitting to:", apiPath, "shareLink:", shareLink);
      await apiSend(apiPath, {
        method: "POST",
        body: formData as unknown as BodyInit,
        headers: {},
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tr("apply.public.error.submitFailed", "Failed to submit application");
      setError(message);
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setError(null);

    if (step === 1) {
      if (!identity.fullName.trim()) {
        setError(tr("apply.public.error.nameRequired", "Full name is required."));
        return;
      }
      if (!isValidEmail(identity.email)) {
        setError(tr("apply.public.error.emailInvalid", "Veuillez saisir une adresse e-mail valide."));
        return;
      }
      if (!cvFile && !existingCvUrl) {
        setError(tr("apply.public.error.cvRequired", "Please upload your CV before continuing."));
        return;
      }
    }

    if (step === 2) {
      if (!baseData.primaryRole.trim()) {
        setError(tr("apply.public.error.primaryRoleRequired", "Primary role is required."));
        return;
      }
      if (!baseData.location.country.trim()) {
        setError(tr("apply.public.error.countryRequired", "Country is required."));
        return;
      }
    }

    if (step === 6) {
      // Values & Alignment is optional — skip validation
    }

    setStep((s) => s + 1);
  };
  const handleBack = () => setStep((s) => s - 1);

  const roleApplicationForm = (role?.application_form as Array<{ id?: string; label: string; required?: boolean }> | undefined) ?? [];

  /* ── Loading / gate states ── */

  // Auth gate must come before loadingRole check — anonymous users never trigger role fetch
  if (!user && !authLoading) {
    const redirectPath = applyPath(shareLink);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)] p-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 max-w-sm w-full text-center space-y-5 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">{tr("apply.public.applyTo", "Postuler pour")}</p>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{role?.title ? String(role.title) : tr("apply.public.thisRole", "ce poste")}</h1>
            {!!role && 'institutionName' in role && (role as any).institutionName ? (
              <p className="text-sm text-[var(--text-secondary)] mt-1">{String((role as any).institutionName)}</p>
            ) : null}
          </div>
          <p className="text-sm text-[var(--text-muted)]">{tr("apply.public.needAccount", "Vous devez avoir un compte pour postuler.")}</p>
          <div className="flex flex-col gap-3">
            <a
              href={`${ROUTES.register}?redirect=${encodeURIComponent(redirectPath)}`}
              className="w-full py-3 bg-[var(--accent)] text-white font-bold rounded-xl text-sm hover:opacity-90 transition-all text-center block"
            >
              {tr("apply.public.createAccount", "Créer un compte")}
            </a>
            <a
              href={createAuthRedirect(redirectPath)}
              className="w-full py-3 border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-primary)] font-semibold rounded-xl text-sm hover:border-[var(--accent)] transition-all text-center block"
            >
              {tr("apply.public.alreadyAccount", "J'ai déjà un compte")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!gateChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)]">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  if (loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)]">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 max-w-sm w-full text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin mx-auto" />
          <p className="text-sm text-[var(--text-muted)]">{tr("apply.public.loadingRole", "Loading role details…")}</p>
        </div>
      </div>
    );
  }

  if (errorRole && !role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg-deep)]">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{tr("common.error", "Something went wrong")}</h2>
            <p className="text-sm text-[var(--text-muted)] mt-2">{errorRole}</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{tr("apply.public.success.title", "Application received!")}</h2>
            <p className="text-sm text-gray-500 mt-2 max-w-[38ch] mx-auto">
              {tr("apply.public.success.description", "Thank you for applying for")}{" "}
              <span className="font-semibold text-gray-800">{role?.title as string}</span>{" "}
              {tr("apply.public.success.at", "at")}{" "}
              <span className="font-semibold text-gray-800">{(role?.institution as { name?: string })?.name}</span>.{" "}
              {tr("apply.public.success.followup", "We will review your profile and get back to you.")}
            </p>
            <p className="text-xs text-gray-400 mt-3">{tr("apply.public.success.redirecting", "Redirecting to your dashboard…")}</p>
          </div>
          <button
            onClick={() => router.push(ROUTES.candidate.dashboard)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            {tr("apply.public.goToDashboard", "Go to my dashboard")}
          </button>
        </div>
      </div>
    );
  }

  /* ── Job Details Landing Page ── */
  if (!showForm && role) {
    const institution = role?.institution as { name?: string; logo_url?: string } | undefined;
    const roleLocation = (role?.location as string) || "";
    const roleType = (role?.type as string) || "";
    const roleDescription = (role?.description as string) || (role?.full_form_json as any)?.mission90Day || "";
    const roleDepartment = (role?.department as string) || "";
    const roleSuccess6 = (role?.full_form_json as any)?.success6Month || "";
    // The role form saves its empty default rows too: keep only named skills, otherwise
    // the "required skills" section renders blank pills.
    const roleSkills = (((role?.full_form_json as any)?.skills || []) as any[]).filter((s: any) =>
      String(typeof s === "string" ? s : s?.name ?? "").trim().length > 0,
    );
    const roleSalary = (role?.full_form_json as any)?.salaryMin && (role?.full_form_json as any)?.salaryMax 
      ? `${(role?.full_form_json as any).salaryMin} - ${(role?.full_form_json as any).salaryMax} ${(role?.full_form_json as any).salaryCurrency || 'EUR'}` 
      : "";
    const roleRemote = (role?.full_form_json as any)?.remotePolicy || "";
    const roleTeamSize = (role?.full_form_json as any)?.teamSize || "";
    const roleReportsTo = (role?.full_form_json as any)?.reportsTo || "";

    const typeLabel = (t: string) => {
      const map: Record<string, string> = {
        FULL_TIME: tr("apply.public.type.fullTime", "Temps plein"),
        PART_TIME: tr("apply.public.type.partTime", "Temps partiel"),
        FREELANCE: tr("apply.public.type.freelance", "Freelance"),
        CONTRACT: tr("apply.public.type.contract", "CDD"),
        INTERNSHIP: tr("apply.public.type.internship", "Stage"),
      };
      return map[t] || t;
    };

    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl w-full space-y-6">
          {/* Company Logo + Name */}
          <div className="text-center space-y-3">
            {institution?.logo_url ? (
              <img
                src={institution.logo_url}
                alt={institution?.name || "Company logo"}
                className="w-20 h-20 rounded-2xl object-contain bg-[var(--bg-surface)] border border-[var(--border)] p-2 mx-auto shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-[var(--accent)]" />
              </div>
            )}
            {institution?.name && (
              <p className="text-sm font-semibold text-[var(--text-secondary)] tracking-wide uppercase">
                {institution.name}
              </p>
            )}
          </div>

          {/* Job Title Card */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                {tr("apply.public.weAreHiring", "Nous recrutons")}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight">
                {role?.title as string}
              </h1>
            </div>

            {/* Key Details Pills */}
            <div className="flex flex-wrap gap-2">
              {roleLocation && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                  {roleLocation}
                </span>
              )}
              {roleType && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  {typeLabel(roleType)}
                </span>
              )}
              {roleDepartment && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <Briefcase className="w-3.5 h-3.5 text-[var(--accent)]" />
                  {roleDepartment}
                </span>
              )}
            </div>

            {/* Description */}
            {roleDescription && (
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
                  {tr("apply.public.description", "Description du poste")}
                </h3>
                <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                  {roleDescription}
                </div>
              </div>
            )}

            {/* Mission 90 jours */}
            {roleSuccess6 && (
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
                  {tr("apply.public.success6", "Réussite à 6 mois")}
                </h3>
                <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                  {roleSuccess6}
                </div>
              </div>
            )}

            {/* Skills */}
            {roleSkills.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">
                  {tr("apply.public.skills", "Compétences requises")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(roleSkills as any[]).map((s: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-dim)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                      {typeof s === 'string' ? s : s.name}
                      {s.importance === 'Essentiel' && ' ⭐'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Détails supplémentaires */}
            {(roleSalary || roleRemote || roleTeamSize || roleReportsTo) && (
              <div className="grid grid-cols-2 gap-3">
                {roleSalary && (
                  <div className="bg-[var(--bg-raised)] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("apply.public.salary", "Salaire")}</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{roleSalary}</p>
                  </div>
                )}
                {roleRemote && (
                  <div className="bg-[var(--bg-raised)] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("apply.public.remote", "Télétravail")}</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{roleRemote}</p>
                  </div>
                )}
                {roleTeamSize && (
                  <div className="bg-[var(--bg-raised)] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("apply.public.teamSize", "Taille équipe")}</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{roleTeamSize}</p>
                  </div>
                )}
                {roleReportsTo && (
                  <div className="bg-[var(--bg-raised)] rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("apply.public.reportsTo", "Rattachement")}</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{roleReportsTo}</p>
                  </div>
                )}
              </div>
            )}

            {/* Before applying: what happens to the application */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {tr("apply.public.beforeApplying.title", "Avant de postuler")}
              </p>
              <ul className="mt-3 space-y-2.5 text-sm text-[var(--text-secondary)]">
                {[
                  tr("apply.public.beforeApplying.review", "Votre candidature est examinée par l'équipe de recrutement."),
                  tr("apply.public.beforeApplying.accuracy", "Des informations précises et complètes facilitent l'étude de votre dossier."),
                  tr("apply.public.beforeApplying.prefill", "Si vous disposez d'un profil Aptely ou d'un CV, le formulaire est pré-rempli."),
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Apply Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-8 py-3.5 text-base font-bold text-white hover:opacity-90 transition-all shadow-sm"
              >
                <Send className="w-5 h-5" />
                {tr("apply.public.applyNow", "Postuler pour ce poste")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form input helpers ── */
  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-orange-400";
  const labelCls = "block text-sm font-medium text-gray-600 mb-1.5";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        {/* Role Header */}
        <div className="bg-white rounded-2xl overflow-hidden mb-6 shadow-sm border border-gray-100">
          <div className="bg-orange-500 px-6 py-5 text-white flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {(role?.institution as { logo_url?: string })?.logo_url && (
              <img
                src={(role?.institution as { logo_url?: string }).logo_url}
                alt={tr("apply.public.logoAlt", "Institution logo")}
                className="w-14 h-14 rounded-lg bg-white/10 p-1.5 object-contain flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{role?.title as string}</h1>
              <p className="text-white/75 text-sm mt-0.5">{(role?.institution as { name?: string })?.name}</p>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 mb-12 border border-gray-100 shadow-sm">
          {/* Steps Progress */}
          {(() => {
            const totalSteps = roleApplicationForm.length > 0 ? 7 : 6;
            const stepLabels = [
              tr("apply.public.steps.contactCv", "Contact & CV"),
              tr("apply.public.steps.profile", "Profile"),
              tr("apply.public.steps.experience", "Experience"),
              tr("apply.public.steps.skills", "Skills"),
              tr("apply.public.steps.evidence", "Evidence"),
              tr("apply.public.steps.alignment", "Alignment"),
              ...(roleApplicationForm.length > 0 ? [tr("apply.public.steps.custom", "Custom")] : []),
            ];
            return (
              <div className="mb-8 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-bold text-orange-500">{stepLabels[step - 1]}</span>
                  <span>{step} / {totalSteps}</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1 rounded-full transition-colors ${i < step ? "bg-orange-500" : "bg-gray-200"}`}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {error && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Step 1: Contact & CV */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-100 pb-3">{tr("apply.public.step1.title", "Contact & documents")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelCls}>{tr("apply.public.step1.fullName", "Full name")} <span className="text-red-400">*</span></label>
                  <input type="text" value={identity.fullName} onChange={e => setIdentity({...identity, fullName: e.target.value})} className={inputCls} placeholder={tr("apply.public.step1.fullNamePlaceholder", "John Doe")} required />
                </div>
                <div>
                  <label className={labelCls}>{tr("apply.public.step1.email", "Email")} <span className="text-red-400">*</span></label>
                  <input type="email" value={identity.email} onChange={e => setIdentity({...identity, email: e.target.value})} className={inputCls} placeholder={tr("apply.public.step1.emailPlaceholder", "john@example.com")} autoComplete="email" required />
                  <p className="mt-1 text-xs text-gray-400">{tr("apply.public.step1.emailHint", "Adresse utilisée pour vous contacter au sujet de cette candidature.")}</p>
                </div>
              </div>
              <div>
                <label className={labelCls}>{tr("apply.public.step1.linkedin", "LinkedIn profile (optional)")}</label>
                <input type="url" value={identity.linkedin} onChange={e => setIdentity({...identity, linkedin: e.target.value})} className={inputCls} placeholder={tr("apply.public.step1.linkedinPlaceholder", "https://linkedin.com/...")} />
              </div>

              <div className="p-6 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
                <label className="block text-sm font-bold text-gray-800 mb-2">{tr("apply.public.step1.primaryCv", "Primary CV / Resume (PDF/Word)")} <span className="text-red-400">*</span></label>
                {existingCvUrl && !cvFile && (
                  <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm text-emerald-700">{tr("apply.public.step1.cvAlreadyUploaded", "CV déjà présent dans votre profil")}</span>
                    <a href={existingCvUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" />{tr("apply.public.step1.previewCv", "Aperçu")}
                    </a>
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files?.[0] ?? null)} className="block w-full text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer text-sm" required={!existingCvUrl} />
                {cvFile && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      {cvFile.name}
                    </p>
                    <a
                      href={URL.createObjectURL(cvFile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                    >
                      <FileText className="w-3 h-3" />
                      {tr("apply.public.step1.previewCv", "Preview CV")}
                    </a>
                  </div>
                )}
              </div>
              <div className="p-6 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
                <label className="block text-sm font-bold text-gray-800 mb-2">{tr("apply.public.step1.otherDocs", "Other proof documents (certificates, recommendations)")}</label>
                <p className="text-xs text-gray-400 mb-4">{tr("apply.public.step1.otherDocsHint", "You can upload multiple files at once.")}</p>
                <input type="file" ref={extraDocsRef} multiple onChange={e => setExtraDocFiles(e.target.files ? Array.from(e.target.files) : [])} className="block w-full text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer text-sm" />
                {extraDocFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {extraDocFiles.map((f, i) => (
                      <li key={i} className="text-sm text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Base Profile */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-100 pb-3">{tr("apply.public.step2.title", "Professional profile overview")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{tr("apply.public.step2.primaryRole", "Primary role")} <span className="text-red-400">*</span></label>
                  <input type="text" value={baseData.primaryRole} onChange={e => setBaseData({...baseData, primaryRole: e.target.value})} className={inputCls} placeholder={tr("apply.public.step2.primaryRolePlaceholder", "Software Engineer")} required />
                </div>
                <div>
                  <label className={labelCls}>{tr("apply.public.step2.yearsExperience", "Years of experience")}</label>
                  <input type="number" value={baseData.yearsExperience} onChange={e => setBaseData({...baseData, yearsExperience: parseInt(e.target.value) || 0})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr("apply.public.step2.country", "Country")} <span className="text-red-400">*</span></label>
                  <input type="text" value={baseData.location.country} onChange={e => setBaseData({...baseData, location: { ...baseData.location, country: e.target.value }})} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>{tr("apply.public.step2.city", "City")}</label>
                  <input type="text" value={baseData.location.city} onChange={e => setBaseData({...baseData, location: { ...baseData.location, city: e.target.value }})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr("apply.public.step2.expectedSalary", "Expected salary (annual)")}</label>
                  <div className="flex items-center gap-2">
                    <select value={baseData.salaryCurrency} onChange={e => setBaseData({...baseData, salaryCurrency: e.target.value})} className="w-24 shrink-0 px-2 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm appearance-none">
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                    <input type="number" value={baseData.salaryExpectation || ""} onChange={e => setBaseData({...baseData, salaryExpectation: parseInt(e.target.value) || 0})} placeholder={tr("apply.public.step2.expectedSalaryPlaceholder", "e.g. 80,000")} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{tr("apply.public.step2.availability", "Availability")}</label>
                  <select value={baseData.availability.type} onChange={e => setBaseData({...baseData, availability: { ...baseData.availability, type: e.target.value }})} className={inputCls}>
                    <option value="IMMEDIATELY">{tr("apply.public.step2.availability.immediately", "Immediately")}</option>
                    <option value="NOTICE_PERIOD">{tr("apply.public.step2.availability.noticePeriod", "Notice period")}</option>
                    <option value="SPECIFIC_DATE">{tr("apply.public.step2.availability.specificDate", "Specific date")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{tr("apply.public.step2.workAuthorization", "Work authorization")}</label>
                  <select value={baseData.workAuth} onChange={e => setBaseData({...baseData, workAuth: e.target.value})} className={inputCls}>
                    {WORK_AUTH_OPTIONS.map(opt => <option key={opt} value={opt}>{tr(`apply.public.step2.workAuth.${opt.toLowerCase()}`, opt)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Experience */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-100 pb-3">{tr("apply.public.step3.title", "Work experience")}</h2>
              <p className="text-sm text-gray-400">{tr("apply.public.step3.cvNote", "Si ces informations figurent déjà dans votre CV, vous pouvez passer cette étape.")}</p>
              {experiences.map((exp, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">{tr("apply.public.step3.job", "Job")} {idx + 1}</h3>
                    {experiences.length > 1 && <button onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="text" placeholder={tr("apply.public.step3.companyName", "Company name")} value={exp.company} onChange={e => { const n = [...experiences]; n[idx].company = e.target.value; setExperiences(n); }} className={inputCls} />
                    <input type="text" placeholder={tr("apply.public.step3.roleTitle", "Role/Title")} value={exp.role} onChange={e => { const n = [...experiences]; n[idx].role = e.target.value; setExperiences(n); }} className={inputCls} />
                    <input type="text" placeholder={tr("apply.public.step3.periodPlaceholder", "Period (e.g. 2021-2023)")} value={exp.period} onChange={e => { const n = [...experiences]; n[idx].period = e.target.value; setExperiences(n); }} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{tr("apply.public.step3.achievements", "Achievements (separate by line)")}</label>
                    <textarea placeholder={tr("apply.public.step3.achievementsPlaceholder", "Built API...")} value={exp.achievements.join('\n')} onChange={e => { const n = [...experiences]; n[idx].achievements = e.target.value.split('\n'); setExperiences(n); }} className={`${inputCls} h-24 resize-none`} />
                  </div>
                </div>
              ))}
              <button onClick={() => setExperiences([...experiences, { company: "", role: "", period: "", achievements: [""], proofEmail: "", proofDocument: "" }])} className="text-orange-500 font-bold flex items-center gap-1 text-sm hover:text-orange-600"><Plus className="w-4 h-4"/> {tr("apply.public.step3.addJob", "Add job")}</button>
            </div>
          )}

          {/* Step 4: Skills */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-100 pb-3">{tr("apply.public.step4.title", "Skill profiles")}</h2>
              <p className="text-sm text-gray-400 mb-2">{tr("apply.public.step4.cvNote", "Si ces compétences figurent déjà dans votre CV, vous pouvez passer cette étape.")}</p>
              {skills.map((skill, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">{tr("apply.public.step4.skill", "Skill")}</label>
                    <input type="text" placeholder={tr("apply.public.step4.skillPlaceholder", "e.g. React, Python")} value={skill.skillName} onChange={e => { const n = [...skills]; n[idx].skillName = e.target.value; setSkills(n); }} className={inputCls} />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500 mb-1 block">{tr("apply.public.step4.years", "Years")}</label>
                    <input type="number" min="0" value={skill.yearsUsed} onChange={e => { const n = [...skills]; n[idx].yearsUsed = parseInt(e.target.value)||0; setSkills(n); }} className={inputCls} />
                  </div>
                  {skills.length > 1 && <button onClick={() => setSkills(skills.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-2"><Trash2 className="w-5 h-5" /></button>}
                </div>
              ))}
              <button onClick={() => setSkills([...skills, { skillName: "", yearsUsed: 0, ownership: "", proofEmail: "", proofDocument: "" }])} className="text-orange-500 font-bold flex items-center gap-1 text-sm hover:text-orange-600"><Plus className="w-4 h-4"/> {tr("apply.public.step4.addSkill", "Add skill")}</button>
            </div>
          )}

          {/* Step 5: Evidence */}
          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-100 pb-3">{tr("apply.public.step5.title", "Portfolio / evidence")}</h2>
              <p className="text-sm text-gray-400">{tr("apply.public.step5.cvNote", "Si ces preuves figurent déjà dans votre CV, vous pouvez passer cette étape.")}</p>
              {evidence.map((ev, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">{tr("apply.public.step5.project", "Project")} {idx + 1}</h3>
                    {evidence.length > 1 && <button onClick={() => setEvidence(evidence.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>}
                  </div>
                  <input type="text" placeholder={tr("apply.public.step5.projectName", "Project name")} value={ev.projectName} onChange={e => { const n = [...evidence]; n[idx].projectName = e.target.value; setEvidence(n); }} className={inputCls} />
                  <textarea placeholder={tr("apply.public.step5.problemSolved", "What problem was solved? (Be extremely specific)")} value={ev.problemSolved} onChange={e => { const n = [...evidence]; n[idx].problemSolved = e.target.value; setEvidence(n); }} className={`${inputCls} h-20 resize-none`} />
                  <textarea placeholder={tr("apply.public.step5.personalContribution", "Your exact personal contribution")} value={ev.personalContribution} onChange={e => { const n = [...evidence]; n[idx].personalContribution = e.target.value; setEvidence(n); }} className={`${inputCls} h-20 resize-none`} />
                  <textarea placeholder={tr("apply.public.step5.result", "Quantifiable results (e.g. increased conversion by 15%)")} value={ev.result} onChange={e => { const n = [...evidence]; n[idx].result = e.target.value; setEvidence(n); }} className={`${inputCls} h-20 resize-none`} />
                  <input type="url" placeholder={tr("apply.public.step5.proofLink", "Proof link (GitHub, live site, article)")} value={ev.proofLink} onChange={e => { const n = [...evidence]; n[idx].proofLink = e.target.value; setEvidence(n); }} className={inputCls} />
                </div>
              ))}
              <button onClick={() => setEvidence([...evidence, { projectName: "", problemSolved: "", personalContribution: "", result: "", proofEmail: "", proofLink: "", proofDocument: "" }])} className="text-orange-500 font-bold flex items-center gap-1 text-sm hover:text-orange-600"><Plus className="w-4 h-4"/> {tr("apply.public.step5.addProject", "Add project")}</button>
            </div>
          )}

          {/* Step 6: Alignment (Optional) */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <h2 className="text-2xl font-bold text-gray-900">{tr("apply.public.step6.title", "Values & alignment")}</h2>
                <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-0.5 rounded-full">{tr("apply.public.optional", "Optional")}</span>
              </div>
              <p className="text-sm text-gray-400">{tr("apply.public.step6.optionalHint", "Ces informations sont facultatives. Si elles figurent déjà dans votre CV, vous pouvez passer.")}</p>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">{tr("apply.public.step6.flexibilityVsStructure", "Flexibility vs Structure")}: {style.chaosVsStructure}</label>
                <input type="range" min="0" max="100" value={style.chaosVsStructure} onChange={e => setStyle({...style, chaosVsStructure: parseInt(e.target.value)})} className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">{tr("apply.public.step6.speedVsQuality", "Speed vs Quality")}: {style.speedVsQuality}</label>
                <input type="range" min="0" max="100" value={style.speedVsQuality} onChange={e => setStyle({...style, speedVsQuality: parseInt(e.target.value)})} className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mt-6 mb-2">{tr("apply.public.step6.whatExcites", "What excites you?")}</label>
                <textarea value={motivation.excitementTriggers} onChange={e => setMotivation({...motivation, excitementTriggers: e.target.value})} placeholder={tr("apply.public.step6.whatExcitesPlaceholder", "Solving hard problems...")} className={`${inputCls} h-20 resize-none`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">{tr("apply.public.step6.growthGoals", "What are your growth goals?")}</label>
                <textarea value={motivation.growthGoals} onChange={e => setMotivation({...motivation, growthGoals: e.target.value})} placeholder={tr("apply.public.step6.growthGoalsPlaceholder", "Mastering specialized systems architectures...")} className={`${inputCls} h-20 resize-none`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">{tr("apply.public.step6.threeYearVision", "Where do you see yourself in 3 years?")}</label>
                <textarea value={motivation.threeYearVision} onChange={e => setMotivation({...motivation, threeYearVision: e.target.value})} placeholder={tr("apply.public.step6.threeYearVisionPlaceholder", "Leading an autonomous feature team...")} className={`${inputCls} h-20 resize-none`} />
              </div>
            </div>
          )}

          {step === 7 && roleApplicationForm.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-100 pb-3">{tr("apply.public.step7.title", "Custom questions")}</h2>
              <p className="text-sm text-gray-500 mb-6">{tr("apply.public.step7.subtitle", "The HR team has provided a few specific questions for this role.")}</p>

              {roleApplicationForm.map((question, index) => (
                <div key={question.id || index}>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {question.label}
                    {question.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <textarea
                    value={customAnswers[question.label] || ""}
                    onChange={e => setCustomAnswers({ ...customAnswers, [question.label]: e.target.value })}
                    className={`${inputCls} h-24 resize-none`}
                    placeholder={tr("apply.public.step7.answerPlaceholder", "Your detailed answer...")}
                    required={question.required}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex gap-4 mt-10">
            {step > 1 && (
              <button type="button" onClick={handleBack} disabled={submitting} className="px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 flex-1 md:flex-none text-sm">
                {tr("common.back", "Back")}
              </button>
            )}
            {step < (roleApplicationForm.length > 0 ? 7 : 6) ? (
              <button type="button" onClick={handleNext} className="flex-1 md:flex-none px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 flex items-center justify-center gap-2 text-sm">
                {tr("apply.public.nextStep", "Next step")} <ArrowRight className="w-5 h-5"/>
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting} className={`flex-1 md:flex-none px-8 py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-sm ${submitting ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}>
                {submitting ? tr("apply.public.submitting", "Submitting application...") : tr("apply.public.submitFinal", "Submit final application")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
