"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, institutionCreateApi, createAuthRedirect } from "@/lib/routes";

const SECTORS = ["Tech", "Finance", "Healthcare", "Education", "Retail", "Manufacturing", "Other"];
const TEAM_SIZES = ["1-10", "10-50", "50-200", "200-1000", "1000+"];

interface CreateInstitutionForm {
  name: string;
  sector: string;
  teamSize: string;
  website: string;
  location: string;
  description: string;
}

export default function CreateWorkspacePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { refresh, switchTo } = useWorkspace();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const [form, setForm] = useState<CreateInstitutionForm>({
    name: "",
    sector: "",
    teamSize: "",
    website: "",
    location: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(createAuthRedirect(ROUTES.workspaces.new));
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(tr("workspace.create.nameRequired", "Institution name is required."));
      return;
    }

    setSubmitting(true);
    const res = await apiFetch(institutionCreateApi, "HR", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        sector: form.sector || undefined,
        teamSize: form.teamSize || undefined,
        website: form.website.trim() || undefined,
        location: form.location.trim() || undefined,
        description: form.description.trim() || undefined,
      }),
    });
    setSubmitting(false);

    if (res?.institutionId) {
      // Refresh memberships + switch active workspace.
      await refresh();
      await switchTo(res.institutionId);
      router.push(ROUTES.company.dashboard);
    } else {
      setError(res?.error || tr("workspace.create.createFailed", "Failed to create institution. Please try again."));
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-aptely-orange" />
      </div>
    );
  }

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {tr("workspace.create.back", "Back")}
        </button>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-aptely-orange/10 border border-aptely-orange/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-aptely-orange" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">{tr("workspace.create.title", "Create your institution")}</h1>
              <p className="text-xs text-[var(--text-muted)]">{tr("workspace.create.subtitle", "You become OWNER. Invite teammates afterwards from settings.")}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex items-start gap-2 border border-red-400/20 bg-red-400/5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-primary)]">
              {tr("workspace.create.nameLabel", "Institution name")} <span className="text-aptely-orange">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={tr("workspace.create.namePlaceholder", "Acme Corp")}
              className="w-full bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/40 focus:outline-none focus:border-aptely-blue transition-colors"
              required
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--text-primary)]">{tr("workspace.create.sectorLabel", "Sector")}</label>
              <select
                value={form.sector}
                onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                className="w-full bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-aptely-blue"
              >
                <option value="">—</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--text-primary)]">{tr("workspace.create.teamSizeLabel", "Team size")}</label>
              <select
                value={form.teamSize}
                onChange={(e) => setForm((f) => ({ ...f, teamSize: e.target.value }))}
                className="w-full bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-aptely-blue"
              >
                <option value="">—</option>
                {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-primary)]">{tr("workspace.create.websiteLabel", "Website")}</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder={tr("workspace.create.websitePlaceholder", "https://example.com")}
              className="w-full bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/40 focus:outline-none focus:border-aptely-blue"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-primary)]">{tr("workspace.create.locationLabel", "Location")}</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder={tr("workspace.create.locationPlaceholder", "Paris, France")}
              className="w-full bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/40 focus:outline-none focus:border-aptely-blue"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--text-primary)]">{tr("workspace.create.descriptionLabel", "Description")}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={tr("workspace.create.descriptionPlaceholder", "Briefly describe what your institution does.")}
              rows={3}
              className="w-full bg-[var(--bg-deep)] border-2 border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/40 focus:outline-none focus:border-aptely-blue resize-none"
              maxLength={500}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !form.name.trim()}
            className="w-full inline-flex items-center justify-center gap-2 py-3 bg-aptely-orange hover:bg-aptely-orange/90 text-white font-bold rounded-xl transition-all shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {tr("workspace.create.creating", "Creating...")}</> : tr("workspace.create.submit", "Create institution")}
          </button>
        </form>
      </div>
    </div>
  );
}
