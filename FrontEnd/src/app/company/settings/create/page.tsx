"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { apiCall } from "@/lib/apiHelper";
import { withTimeout } from "@/lib/retryApi";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, institutionCreateApi, authMeApi } from "@/lib/routes";


type CreateStep = "form" | "loading" | "success";

export default function CreateInstitutionPage() {
  const router = useRouter();
  const locale = getClientLocale();
  const translate = (key: string, fallback: string) => t(locale, key, fallback);
  const { setInstitutionId } = useAuth();
  const [step, setStep] = useState<CreateStep>("form");
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    sector: "",
    teamSize: "",
    stage: "",
    location: "",
    description: "",
    ownerRoleLabel: "",
  });
  const [successData, setSuccessData] = useState<{
    institutionId: string;
    institutionName: string;
  } | null>(null);
  const [error, setError] = useState("");

  // Auto-redirect to integrations page when success (after 5 seconds)
  useEffect(() => {
    if (step === "success") {
      const timer = setTimeout(() => {
        router.push(ROUTES.company.calendar);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const missing: string[] = [];
    if (!formData.sector?.trim()) missing.push("Sector");
    if (!formData.location?.trim()) missing.push("Location");
    if (!formData.description?.trim()) missing.push("Description");
    if (missing.length > 0) {
      setError(`Please fill in required fields: ${missing.join(", ")}`);
      return;
    }

    setStep("loading");

    try {
      const safeResponse = await withTimeout(
        apiCall(
          institutionCreateApi,
          {
            method: "POST",
            body: JSON.stringify({
              name: formData.name,
              website: formData.website || undefined,
              sector: formData.sector || undefined,
              teamSize: formData.teamSize || undefined,
              stage: formData.stage || undefined,
              location: formData.location || undefined,
              description: formData.description || undefined,
              ownerRoleLabel: formData.ownerRoleLabel?.trim() || undefined,
            }),
          },
          {
            requireAuth: true,
          }
        ),
        12000,
        translate("institution.create.timeout.create", "Institution creation is taking too long. Please retry.")
      );

      if (!safeResponse.institutionId) {
        throw new Error("Backend did not return institutionId after creation");
      }
      
      // Save institutionId to auth context and localStorage
      setInstitutionId(safeResponse.institutionId);
      const authMeResponse = await withTimeout(
        apiCall(authMeApi, { method: "GET" }, { requireAuth: true }),
        10000,
        translate("institution.create.timeout.verify", "Account verification timed out. Please retry.")
      );
      if (!authMeResponse?.institutionId) {
        throw new Error(translate("institution.create.syncFailed", "Institution sync failed. Please retry synchronization."));
      }
      
      setSuccessData(safeResponse);
      setStep("success");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create institution";
      console.error("[INSTITUTION CREATE] Error:", errorMsg);
      setError(errorMsg);
      setStep("form");
    }
  };

  if (step === "success" && successData) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full animate-fade-in-up">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-[var(--text-primary)] mb-2">
                {translate("institution.create.success.title", "Institution created!")}
              </h1>
              <p className="text-[var(--text-secondary)]">
                {translate("institution.create.success.subtitle", "Your institution is ready to go. Share the join code with your team members.")}
              </p>
            </div>

            <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-4 sm:p-6 mb-8">
              <p className="text-sm text-emerald-400 mb-2">
                <strong>{translate("institution.create.success.nameLabel", "Institution name:")}</strong>
              </p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400 mb-4">
                {successData.institutionName}
              </p>

              <p className="text-xs text-emerald-400 mt-4 italic">
                {translate("institution.create.success.ownerInfo", "You are now the owner of this institution and have full access.")}
              </p>
            </div>

            <div className="text-center text-[var(--text-muted)] text-sm mb-6">
              {translate("institution.create.success.redirecting", "Redirecting to dashboard in 5 seconds...")}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push(ROUTES.company.calendar)}
                className="w-full px-6 py-3 bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent)]-soft transition-colors"
              >
                {translate("institution.create.success.cta", "Go to dashboard now")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full animate-fade-in-up">
        <Link href={ROUTES.company.settings.onboarding} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm mb-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          {translate("common.back", "Back")}
        </Link>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 shadow-2xl">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-[var(--text-primary)] mb-2">{translate("institution.create.title", "Create your institution")}</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            {translate("institution.create.subtitle", "Fill in the details below to create your institution and set up your workspace.")}
          </p>

          {error && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-400">
                <strong>{translate("common.error", "Error:")}</strong> {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Institution Name */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.name", "Institution name *")}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder={translate("institution.create.form.namePlaceholder", "e.g., Acme Corporation")}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {translate("institution.create.form.nameHint", "The official name of your organization")}
              </p>
            </div>

            {/* Owner role label */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.ownerRoleLabel", "Votre titre dans l'équipe (optionnel)")}
              </label>
              <input
                type="text"
                name="ownerRoleLabel"
                value={formData.ownerRoleLabel}
                onChange={handleChange}
                maxLength={80}
                placeholder={translate("institution.create.form.ownerRoleLabelPlaceholder", "ex: Directeur RH, Head of People, Talent Acquisition Lead…")}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {translate("institution.create.form.ownerRoleLabelHint", "Ce titre remplacera \"Propriétaire\" dans votre interface. Vous pourrez le modifier plus tard.")}
              </p>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.website", "Website (optional)")}
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder={translate("institution.create.form.websitePlaceholder", "e.g., https://acme.com")}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition"
              />
            </div>

            {/* Sector */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.sector", "Sector *")}
              </label>
              <select
              name="sector"
              value={formData.sector}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition"
            >
              <option value="" disabled>{translate("institution.create.form.sectorPlaceholder", "Select a sector")}</option>
                <option value="Technology">{translate("institution.create.form.sector.technology", "Technology")}</option>
                <option value="Finance">{translate("institution.create.form.sector.finance", "Finance")}</option>
                <option value="Healthcare">{translate("institution.create.form.sector.healthcare", "Healthcare")}</option>
                <option value="Retail">{translate("institution.create.form.sector.retail", "Retail")}</option>
                <option value="Manufacturing">{translate("institution.create.form.sector.manufacturing", "Manufacturing")}</option>
                <option value="Education">{translate("institution.create.form.sector.education", "Education")}</option>
                <option value="Other">{translate("institution.create.form.sector.other", "Other")}</option>
              </select>
            </div>

            {/* Team Size */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.teamSize", "Team size (optional)")}
              </label>
              <select
                name="teamSize"
                value={formData.teamSize}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition"
              >
                <option value="">{translate("institution.create.form.teamSizePlaceholder", "Select team size")}</option>
                <option value="1-10">{translate("institution.create.form.teamSize.1_10", "1-10 people")}</option>
                <option value="11-50">{translate("institution.create.form.teamSize.11_50", "11-50 people")}</option>
                <option value="51-200">{translate("institution.create.form.teamSize.51_200", "51-200 people")}</option>
                <option value="201-500">{translate("institution.create.form.teamSize.201_500", "201-500 people")}</option>
                <option value="500+">{translate("institution.create.form.teamSize.500_plus", "500+ people")}</option>
              </select>
            </div>

            {/* Stage */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.stage", "Company stage (optional)")}
              </label>
              <select
                name="stage"
                value={formData.stage}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition"
              >
                <option value="">{translate("institution.create.form.stagePlaceholder", "Select stage")}</option>
                <option value="Startup">{translate("institution.create.form.stage.startup", "Startup")}</option>
                <option value="Series A">{translate("institution.create.form.stage.seriesA", "Series A")}</option>
                <option value="Series B">{translate("institution.create.form.stage.seriesB", "Series B")}</option>
                <option value="Series C+">{translate("institution.create.form.stage.seriesC", "Series C+")}</option>
                <option value="Established">{translate("institution.create.form.stage.established", "Established")}</option>
                <option value="Public">{translate("institution.create.form.stage.public", "Public")}</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.location", "Location *")}
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                placeholder={translate("institution.create.form.locationPlaceholder", "e.g., San Francisco, CA")}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                {translate("institution.create.form.description", "Description *")}
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder={translate("institution.create.form.descriptionPlaceholder", "Tell us about your institution...")}
                rows={4}
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={step === "loading"}
              className="w-full px-6 py-3 bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent)]-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {step === "loading" && <Loader2 className="w-5 h-5 animate-spin" />}
              {step === "loading" ? translate("institution.create.creating", "Creating...") : translate("institution.create.submit", "Create institution")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
