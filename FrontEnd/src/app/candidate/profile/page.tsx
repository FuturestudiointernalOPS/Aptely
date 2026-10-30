"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User2,
  MapPin,
  Globe,
  Linkedin,
  Github,
  Clock,
  Plus,
  Trash2,
  Save,
  FileUp,
  FileText,
  Upload,
  Check,
  Loader,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch, apiSend } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import {
  ROUTES,
  createAuthRedirect,
  individualsMeApi,
  individualsUploadCvApi,
  individualsDeleteCvApi,
  vaultMyScoreApi,
} from "@/lib/routes";
import { AvatarUploader } from "@/components/ui/AvatarUploader";

/** Maps vault nudge i18n keys → in-page anchors (or Vault for proof/endorsement). */
const NUDGE_HREF: Record<string, string> = {
  "individual.profile.nudge.headline": "#bio",
  "individual.profile.nudge.bio": "#bio",
  "individual.profile.nudge.skills": "#skills",
  "individual.profile.nudge.experience": "#experience",
  "individual.profile.nudge.skill_proofs": ROUTES.candidate.vault,
  "individual.profile.nudge.endorsements": ROUTES.candidate.vault,
  "individual.profile.nudge.links": "#links",
  "individual.profile.nudge.location": "#bio",
};

type Availability = "IMMEDIATE" | "ONE_MONTH" | "THREE_MONTHS" | "NOT_LOOKING";
type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
type LanguageLevel =
  "BASIC" | "CONVERSATIONAL" | "PROFESSIONAL" | "FLUENT" | "NATIVE";

interface Skill {
  name: string;
  level?: SkillLevel;
  years?: number;
}
interface Experience {
  title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date?: string;
  current: boolean;
  description?: string;
}
interface Education {
  degree: string;
  institution: string;
  field?: string;
  start_year: number;
  end_year?: number;
  current: boolean;
}
interface Certification {
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}
interface Language {
  name: string;
  level: LanguageLevel;
}

interface IndividualProfile {
  headline?: string;
  bio?: string;
  location?: string;
  website_url?: string;
  linkedin_url?: string;
  github_url?: string;
  availability?: Availability;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  languages: Language[];
}

const AVAILABILITY_LABEL_KEYS: Record<Availability, string> = {
  IMMEDIATE: "individual.profile.availability.immediate",
  ONE_MONTH: "individual.profile.availability.oneMonth",
  THREE_MONTHS: "individual.profile.availability.threeMonths",
  NOT_LOOKING: "individual.profile.availability.notLooking",
};
const AVAILABILITY_FALLBACKS: Record<Availability, string> = {
  IMMEDIATE: "Immediately available",
  ONE_MONTH: "Available in 1 month",
  THREE_MONTHS: "Available in 3 months",
  NOT_LOOKING: "Not looking",
};

const SKILL_LEVELS: SkillLevel[] = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "EXPERT",
];
const SKILL_LEVEL_KEYS: Record<SkillLevel, string> = {
  BEGINNER: "individual.profile.skillLevel.beginner",
  INTERMEDIATE: "individual.profile.skillLevel.intermediate",
  ADVANCED: "individual.profile.skillLevel.advanced",
  EXPERT: "individual.profile.skillLevel.expert",
};
const SKILL_LEVEL_FALLBACKS: Record<SkillLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};
const LANG_LEVELS: LanguageLevel[] = [
  "BASIC",
  "CONVERSATIONAL",
  "PROFESSIONAL",
  "FLUENT",
  "NATIVE",
];
const LANG_LEVEL_KEYS: Record<LanguageLevel, string> = {
  BASIC: "individual.profile.languageLevel.basic",
  CONVERSATIONAL: "individual.profile.languageLevel.conversational",
  PROFESSIONAL: "individual.profile.languageLevel.professional",
  FLUENT: "individual.profile.languageLevel.fluent",
  NATIVE: "individual.profile.languageLevel.native",
};
const LANG_LEVEL_FALLBACKS: Record<LanguageLevel, string> = {
  BASIC: "Beginner",
  CONVERSATIONAL: "Conversational",
  PROFESSIONAL: "Professional",
  FLUENT: "Fluent",
  NATIVE: "Native",
};
const AVAILABILITIES: Availability[] = [
  "IMMEDIATE",
  "ONE_MONTH",
  "THREE_MONTHS",
  "NOT_LOOKING",
];

interface VaultScoreUi {
  score: number;
  nudges: string[];
}

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  const locale = getClientLocale();
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-80"
      >
        <Plus className="w-3.5 h-3.5" /> {t(locale, "common.add", "Add")}
      </button>
    </div>
  );
}

export default function IndividualProfilePage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // Auto-upload CV when selected
  useEffect(() => {
    if (!cvFile || !user) return;
    const upload = async () => {
      setUploadingCv(true);
      try {
        const formData = new FormData();
        formData.append("file", cvFile);
        // Must use apiSend for proper headers (X-Workspace-Id, auth, etc.)
        const res = await apiSend(individualsUploadCvApi, {
          method: "POST",
          body: formData as unknown as BodyInit,
          headers: {},
        });
        if (res) {
          const data = res as { cv_url?: string };
          if (data.cv_url) {
            setCvFileName(cvFile.name);
            setCvFile(null);
          }
        }
      } catch (err) {
        console.warn("CV upload failed:", err);
      } finally {
        setUploadingCv(false);
      }
    };
    upload();
  }, [cvFile, user]);

  const deleteCv = async () => {
    setCvFile(null);
    setCvFileName(null);
    if (cvInputRef.current) cvInputRef.current.value = "";
    try {
      await apiSend(individualsDeleteCvApi, { method: "DELETE", headers: {} });
    } catch (err) {
      console.warn("CV delete failed:", err);
    }
  };
  const [profile, setProfile] = useState<IndividualProfile>({
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
  });
  // Single source of truth with dashboard — GET /vault/me/score
  const [vaultScore, setVaultScore] = useState<VaultScoreUi | null>(null);

  const refreshVaultScore = async () => {
    const scoreRes = await apiFetch(vaultMyScoreApi, "HR", {
      method: "GET",
      cache: "no-store",
    });
    if (scoreRes && typeof scoreRes.score === "number") {
      setVaultScore({
        score: scoreRes.score,
        nudges: Array.isArray(scoreRes.nudges) ? scoreRes.nudges : [],
      });
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(createAuthRedirect(ROUTES.candidate.profile));
      return;
    }
    if (!isPersonal) {
      router.replace(ROUTES.company.dashboard);
      return;
    }

    const load = async () => {
      setFetching(true);
      const [res] = await Promise.all([
        apiFetch(individualsMeApi, "HR", {
          method: "GET",
          cache: "no-store",
        }),
        refreshVaultScore(),
      ]);
      if (res && typeof res === "object" && !Array.isArray(res)) {
        setProfile({
          headline: res.headline ?? "",
          bio: res.bio ?? "",
          location: res.location ?? "",
          website_url: res.website_url ?? "",
          linkedin_url: res.linkedin_url ?? "",
          github_url: res.github_url ?? "",
          availability: res.availability ?? undefined,
          skills: res.skills ?? [],
          experience: res.experience ?? [],
          education: res.education ?? [],
          certifications: res.certifications ?? [],
          languages: res.languages ?? [],
        });
        // CV already uploaded elsewhere in the app (e.g. a public application) —
        // show it as saved instead of asking for the file again.
        if (res.cv_url && typeof res.cv_url === "string") {
          try {
            const pathname = new URL(res.cv_url).pathname;
            setCvFileName(decodeURIComponent(pathname.split("/").pop() || "CV.pdf"));
          } catch {
            setCvFileName("CV.pdf");
          }
        }
      }
      setFetching(false);
    };
    load();
  }, [loading, router, user, isPersonal]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    setSkippedCount(0);
    const filtered = {
      skills: profile.skills.filter((s) => s.name.trim().length > 0),
      experience: profile.experience.filter(
        (e) =>
          e.title.trim() &&
          e.company.trim() &&
          /^\d{4}-\d{2}$/.test(e.start_date),
      ),
      education: profile.education.filter(
        (e) => e.degree.trim() && e.institution.trim() && e.start_year > 0,
      ),
      certifications: profile.certifications.filter(
        (c) => c.name.trim().length > 0,
      ),
      languages: profile.languages.filter((l) => l.name.trim().length > 0),
    };
    const skipped =
      profile.skills.length -
      filtered.skills.length +
      (profile.experience.length - filtered.experience.length) +
      (profile.education.length - filtered.education.length) +
      (profile.certifications.length - filtered.certifications.length) +
      (profile.languages.length - filtered.languages.length);
    const payload: IndividualProfile = { ...profile, ...filtered };
    const res = await apiFetch(individualsMeApi, "HR", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res) {
      setSaved(true);
      if (skipped > 0) setSkippedCount(skipped);
      void refreshVaultScore();
      setTimeout(() => {
        setSaved(false);
        setSkippedCount(0);
      }, 3500);
    } else {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
  };

  const set = <K extends keyof IndividualProfile>(
    key: K,
    val: IndividualProfile[K],
  ) => setProfile((p) => ({ ...p, [key]: val }));

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 text-sm text-[var(--text-muted)]">
          {t(locale, "individual.profile.loading", "Loading profile...")}
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.profile.sectionLabel",
                  "Capability Record",
                )}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mt-1">
                {t(locale, "individual.profile.title", "My profile")}
              </h1>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving
                  ? t(locale, "individual.profile.saving", "Saving...")
                  : saved
                    ? t(locale, "individual.profile.saved", "Saved!")
                    : saveError
                      ? t(locale, "individual.profile.error", "Error — retry")
                      : t(locale, "individual.profile.save", "Save")}
              </button>
            </div>
          </div>
          {skippedCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
              <p className="text-xs text-amber-400 font-medium">
                {skippedCount} incomplete{" "}
                {skippedCount === 1 ? "entry was" : "entries were"} skipped —
                fill required fields (name, title, company, start date YYYY-MM)
                to save them.
              </p>
            </div>
          )}
        </div>

        {/* Profile completeness — same score as dashboard (GET /vault/me/score) */}
        {vaultScore && (() => {
          const { score, nudges } = vaultScore;
          const color =
            score >= 80
              ? "bg-emerald-400"
              : score >= 50
                ? "bg-amber-400"
                : "bg-red-400";
          return (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {t(
                    locale,
                    "individual.profile.completeness.label",
                    "Profile completeness",
                  )}
                </p>
                <span
                  className={`text-sm font-bold tabular-nums ${score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"}`}
                >
                  {score}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--bg-raised)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              {nudges.length > 0 && (
                <ul className="space-y-1">
                  {nudges.slice(0, 3).map((key) => (
                    <li key={key}>
                      <a
                        href={NUDGE_HREF[key] ?? ROUTES.candidate.vault}
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                      >
                        <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] shrink-0" />
                        {t(locale, key, key)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}

        {/* Basics */}
        <div
          id="bio"
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4"
        >
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {t(locale, "individual.profile.basicInfo", "Basic info")}
          </h2>
          <AvatarUploader />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
                <User2 className="w-3.5 h-3.5" />{" "}
                {t(locale, "individual.profile.headline", "Headline")}
              </label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder={t(
                  locale,
                  "individual.profile.headlinePlaceholder",
                  "e.g. Senior Full-Stack Engineer",
                )}
                value={profile.headline ?? ""}
                onChange={(e) => set("headline", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{" "}
                {t(locale, "individual.profile.location", "Location")}
              </label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder={t(
                  locale,
                  "individual.profile.locationPlaceholder",
                  "Paris, France",
                )}
                value={profile.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t(locale, "individual.profile.bio", "Bio")}
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                placeholder={t(
                  locale,
                  "individual.profile.bioPlaceholder",
                  "Tell recruiters about yourself...",
                )}
                value={profile.bio ?? ""}
                onChange={(e) => set("bio", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Links & Availability */}
        <div
          id="links"
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4"
        >
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            {t(
              locale,
              "individual.profile.linksAvailability",
              "Links & availability",
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />{" "}
                {t(locale, "individual.profile.website", "Website")}
              </label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder={t(
                  locale,
                  "individual.profile.websitePlaceholder",
                  "https://...",
                )}
                value={profile.website_url ?? ""}
                onChange={(e) => set("website_url", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
                <Linkedin className="w-3.5 h-3.5" /> LinkedIn
              </label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder={t(
                  locale,
                  "individual.profile.linkedinPlaceholder",
                  "https://linkedin.com/in/...",
                )}
                value={profile.linkedin_url ?? ""}
                onChange={(e) => set("linkedin_url", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
                <Github className="w-3.5 h-3.5" /> GitHub
              </label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder={t(
                  locale,
                  "individual.profile.githubPlaceholder",
                  "https://github.com/...",
                )}
                value={profile.github_url ?? ""}
                onChange={(e) => set("github_url", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />{" "}
              {t(
                locale,
                "individual.profile.availabilityLabel",
                "Availability",
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITIES.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => set("availability", av)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    profile.availability === av
                      ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  {t(
                    locale,
                    AVAILABILITY_LABEL_KEYS[av],
                    AVAILABILITY_FALLBACKS[av],
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CV Upload */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--accent)]" />
            {t(locale, "individual.profile.cvSection", "CV / Resume")}
          </h2>
          <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-6 text-center space-y-3">
            {uploadingCv ? (
              <div className="space-y-2">
                <Loader className="w-8 h-8 text-[var(--accent)] animate-spin mx-auto" />
                <p className="text-sm font-semibold text-[var(--accent)]">
                  {t(locale, "individual.profile.uploadingCv", "Uploading CV...")}
                </p>
              </div>
            ) : cvFile ? (
              <div className="space-y-2">
                <FileUp className="w-8 h-8 text-[var(--accent)] mx-auto" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">{cvFile.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{(cvFile.size / 1024 / 1024).toFixed(1)} MB</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => cvInputRef.current?.click()}
                    className="rounded-lg border border-[var(--accent)] bg-[var(--accent-dim)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:opacity-80"
                  >
                    {t(locale, "individual.profile.replaceCv", "Replace")}
                  </button>
                  <button
                    type="button"
                    onClick={deleteCv}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-red-400 hover:text-red-400"
                  >
                    {t(locale, "individual.profile.removeCv", "Remove")}
                  </button>
                </div>
              </div>
            ) : cvFileName ? (
              <div className="space-y-2">
                <FileUp className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">{cvFileName}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  <Check className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
                  {t(locale, "individual.profile.cvSaved", "CV saved")}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => cvInputRef.current?.click()}
                    className="rounded-lg border border-[var(--accent)] bg-[var(--accent-dim)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:opacity-80"
                  >
                    {t(locale, "individual.profile.replaceCv", "Replace")}
                  </button>
                  <button
                    type="button"
                    onClick={deleteCv}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-red-400 hover:text-red-400"
                  >
                    {t(locale, "individual.profile.removeCv", "Remove")}
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="cursor-pointer space-y-2"
                onClick={() => cvInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  {t(locale, "individual.profile.uploadCvHint", "Upload your CV (PDF or Word)")}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t(locale, "individual.profile.uploadCvFormats", "PDF, DOC, DOCX — max 10 MB")}
                </p>
              </div>
            )}
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCvFile(f);
                  setCvFileName(f.name);
                }
              }}
            />
          </div>
        </div>

        {/* Skills */}
        <div
          id="skills"
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6"
        >
          <SectionHeader
            title={t(locale, "individual.profile.skills", "Skills")}
            onAdd={() =>
              set("skills", [
                ...profile.skills,
                { name: "", level: "INTERMEDIATE" },
              ])
            }
          />
          {profile.skills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.profile.noSkills",
                  "No skills added yet. Click Add to list your technical and soft skills.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {profile.skills.map((skill, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={t(
                      locale,
                      "individual.profile.skillNamePlaceholder",
                      "Skill name",
                    )}
                    value={skill.name}
                    onChange={(e) => {
                      const s = [...profile.skills];
                      s[i] = { ...s[i], name: e.target.value };
                      set("skills", s);
                    }}
                  />
                  <select
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-2 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    value={skill.level ?? "INTERMEDIATE"}
                    onChange={(e) => {
                      const s = [...profile.skills];
                      s[i] = { ...s[i], level: e.target.value as SkillLevel };
                      set("skills", s);
                    }}
                  >
                    {SKILL_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {t(
                          locale,
                          SKILL_LEVEL_KEYS[l],
                          SKILL_LEVEL_FALLBACKS[l],
                        )}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "skills",
                        profile.skills.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Experience */}
        <div
          id="experience"
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6"
        >
          <SectionHeader
            title={t(locale, "individual.profile.experience", "Experience")}
            onAdd={() =>
              set("experience", [
                ...profile.experience,
                { title: "", company: "", start_date: "", current: false },
              ])
            }
          />
          {profile.experience.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.profile.noExperience",
                  "No experience added yet. Click Add to list your work history.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {profile.experience.map((exp, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder={t(
                          locale,
                          "individual.profile.jobTitlePlaceholder",
                          "Job title",
                        )}
                        value={exp.title}
                        onChange={(e) => {
                          const x = [...profile.experience];
                          x[i] = { ...x[i], title: e.target.value };
                          set("experience", x);
                        }}
                      />
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder={t(
                          locale,
                          "individual.profile.companyPlaceholder",
                          "Company",
                        )}
                        value={exp.company}
                        onChange={(e) => {
                          const x = [...profile.experience];
                          x[i] = { ...x[i], company: e.target.value };
                          set("experience", x);
                        }}
                      />
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder={t(
                          locale,
                          "individual.profile.startDatePlaceholder",
                          "Start date (YYYY-MM)",
                        )}
                        value={exp.start_date}
                        onChange={(e) => {
                          const x = [...profile.experience];
                          x[i] = { ...x[i], start_date: e.target.value };
                          set("experience", x);
                        }}
                      />
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-40"
                        placeholder={t(
                          locale,
                          "individual.profile.endDatePlaceholder",
                          "End date (YYYY-MM)",
                        )}
                        disabled={exp.current}
                        value={exp.end_date ?? ""}
                        onChange={(e) => {
                          const x = [...profile.experience];
                          x[i] = { ...x[i], end_date: e.target.value };
                          set("experience", x);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "experience",
                          profile.experience.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300 mt-2" />
                    </button>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exp.current}
                      onChange={(e) => {
                        const x = [...profile.experience];
                        x[i] = {
                          ...x[i],
                          current: e.target.checked,
                          end_date: e.target.checked
                            ? undefined
                            : x[i].end_date,
                        };
                        set("experience", x);
                      }}
                    />
                    {t(
                      locale,
                      "individual.profile.currentPosition",
                      "Current position",
                    )}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Education */}
        <div
          id="education"
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6"
        >
          <SectionHeader
            title={t(locale, "individual.profile.education", "Education")}
            onAdd={() =>
              set("education", [
                ...profile.education,
                {
                  degree: "",
                  institution: "",
                  start_year: new Date().getFullYear(),
                  current: false,
                },
              ])
            }
          />
          {profile.education.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.profile.noEducation",
                  "No education added yet. Click Add to list your degrees and schools.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {profile.education.map((edu, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder={t(
                          locale,
                          "individual.profile.degreePlaceholder",
                          "Degree",
                        )}
                        value={edu.degree}
                        onChange={(e) => {
                          const x = [...profile.education];
                          x[i] = { ...x[i], degree: e.target.value };
                          set("education", x);
                        }}
                      />
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder={t(
                          locale,
                          "individual.profile.institutionPlaceholder",
                          "Institution",
                        )}
                        value={edu.institution}
                        onChange={(e) => {
                          const x = [...profile.education];
                          x[i] = { ...x[i], institution: e.target.value };
                          set("education", x);
                        }}
                      />
                      <input
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder={t(
                          locale,
                          "individual.profile.fieldPlaceholder",
                          "Field of study",
                        )}
                        value={edu.field ?? ""}
                        onChange={(e) => {
                          const x = [...profile.education];
                          x[i] = { ...x[i], field: e.target.value };
                          set("education", x);
                        }}
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          placeholder={t(
                            locale,
                            "individual.profile.startYearPlaceholder",
                            "Start year",
                          )}
                          value={edu.start_year}
                          onChange={(e) => {
                            const x = [...profile.education];
                            x[i] = {
                              ...x[i],
                              start_year:
                                parseInt(e.target.value) ||
                                new Date().getFullYear(),
                            };
                            set("education", x);
                          }}
                        />
                        <input
                          type="number"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-40"
                          placeholder={t(
                            locale,
                            "individual.profile.endYearPlaceholder",
                            "End year",
                          )}
                          disabled={edu.current}
                          value={edu.end_year ?? ""}
                          onChange={(e) => {
                            const x = [...profile.education];
                            x[i] = {
                              ...x[i],
                              end_year: parseInt(e.target.value) || undefined,
                            };
                            set("education", x);
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "education",
                          profile.education.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300 mt-2" />
                    </button>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edu.current}
                      onChange={(e) => {
                        const x = [...profile.education];
                        x[i] = {
                          ...x[i],
                          current: e.target.checked,
                          end_year: e.target.checked
                            ? undefined
                            : x[i].end_year,
                        };
                        set("education", x);
                      }}
                    />
                    {t(
                      locale,
                      "individual.profile.currentlyEnrolled",
                      "Currently enrolled",
                    )}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Languages */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <SectionHeader
            title={t(locale, "individual.profile.languages", "Languages")}
            onAdd={() =>
              set("languages", [
                ...profile.languages,
                { name: "", level: "CONVERSATIONAL" },
              ])
            }
          />
          {profile.languages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.profile.noLanguages",
                  "No languages added yet.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {profile.languages.map((lang, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={t(
                      locale,
                      "individual.profile.languagePlaceholder",
                      "Language",
                    )}
                    value={lang.name}
                    onChange={(e) => {
                      const l = [...profile.languages];
                      l[i] = { ...l[i], name: e.target.value };
                      set("languages", l);
                    }}
                  />
                  <select
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-2 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    value={lang.level}
                    onChange={(e) => {
                      const l = [...profile.languages];
                      l[i] = {
                        ...l[i],
                        level: e.target.value as LanguageLevel,
                      };
                      set("languages", l);
                    }}
                  >
                    {LANG_LEVELS.map((lv) => (
                      <option key={lv} value={lv}>
                        {t(
                          locale,
                          LANG_LEVEL_KEYS[lv],
                          LANG_LEVEL_FALLBACKS[lv],
                        )}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "languages",
                        profile.languages.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Certifications */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <SectionHeader
            title={t(
              locale,
              "individual.profile.certifications",
              "Certifications",
            )}
            onAdd={() =>
              set("certifications", [...profile.certifications, { name: "" }])
            }
          />
          {profile.certifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.profile.noCertifications",
                  "No certifications added yet.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {profile.certifications.map((cert, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    className="flex-1 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={t(
                      locale,
                      "individual.profile.certNamePlaceholder",
                      "Certification name",
                    )}
                    value={cert.name}
                    onChange={(e) => {
                      const c = [...profile.certifications];
                      c[i] = { ...c[i], name: e.target.value };
                      set("certifications", c);
                    }}
                  />
                  <input
                    className="w-32 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={t(
                      locale,
                      "individual.profile.certIssuerPlaceholder",
                      "Issuer",
                    )}
                    value={cert.issuer ?? ""}
                    onChange={(e) => {
                      const c = [...profile.certifications];
                      c[i] = { ...c[i], issuer: e.target.value };
                      set("certifications", c);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "certifications",
                        profile.certifications.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save button (bottom) */}
        <div className="flex justify-end pb-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving
              ? t(locale, "individual.profile.saving", "Saving...")
              : saved
                ? t(locale, "individual.profile.saved", "Saved!")
                : saveError
                  ? t(locale, "individual.profile.error", "Error — retry")
                  : t(locale, "individual.profile.saveProfile", "Save profile")}
          </button>
        </div>
      </div>
    </div>
  );
}
