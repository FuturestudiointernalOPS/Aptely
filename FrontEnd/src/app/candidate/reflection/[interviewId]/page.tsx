"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Star, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, reflectionApi } from "@/lib/routes";

interface Reflection {
  id: string;
  overall_rating: number;
  strengths_displayed?: string;
  areas_to_improve?: string;
  key_takeaways?: string;
  follow_up_actions?: string;
  created_at: string;
}

export default function ReflectionPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { interviewId } = useParams<{ interviewId: string }>();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();

  const [existing, setExisting] = useState<Reflection | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [rating, setRating] = useState(0);
  const [strengths, setStrengths] = useState("");
  const [areas, setAreas] = useState("");
  const [takeaways, setTakeaways] = useState("");
  const [followUp, setFollowUp] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(ROUTES.login); return; }
    if (!isPersonal) { router.replace(ROUTES.company.dashboard); return; }

    apiFetch(reflectionApi(interviewId), "HR", { method: "GET", cache: "no-store" }).then((res) => {
      if (res?.id) {
        const r = res as Reflection;
        setExisting(r);
        setRating(r.overall_rating ?? 0);
        setStrengths(r.strengths_displayed ?? "");
        setAreas(r.areas_to_improve ?? "");
        setTakeaways(r.key_takeaways ?? "");
        setFollowUp(r.follow_up_actions ?? "");
      }
      setFetching(false);
    });
  }, [loading, router, user, interviewId, isPersonal]);

  const handleSave = async () => {
    if (!rating) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    const res = await apiFetch(reflectionApi(interviewId), "HR", {
      method: "POST",
      body: JSON.stringify({
        overall_rating:      rating,
        strengths_displayed: strengths || undefined,
        areas_to_improve:    areas || undefined,
        key_takeaways:       takeaways || undefined,
        follow_up_actions:   followUp || undefined,
      }),
    });
    if (res?.id) {
      setExisting(res as Reflection);
      setSaved(true);
    } else {
      setSaveError(t(locale, "individual.reflection.saveFailed", "Failed to save. Please try again."));
    }
    setSaving(false);
  };

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 text-sm text-[var(--text-muted)]">{t(locale, "individual.reflection.loading", "Loading...")}</div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.reflection.sectionLabel", "Post-interview")}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mt-1">{t(locale, "individual.reflection.title", "Interview reflection")}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t(locale, "individual.reflection.subtitle", "Capture what went well, what to improve, and your next steps.")}
            {existing && <span className="ml-2 text-emerald-400 font-semibold">{t(locale, "individual.reflection.savedOn", "Saved")} {new Date(existing.created_at).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")}</span>}
          </p>
        </div>

        {/* Overall rating */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.reflection.howDidItGo", "How did it go? *")}</p>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${
                  rating >= s
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                }`}
              >
                <Star className={`w-5 h-5 ${rating >= s ? "fill-[var(--accent)]" : ""}`} />
                <span className="text-[10px] font-bold">{s}</span>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center">
              {["", t(locale, "individual.reflection.rating.veryPoor", "Very poor"), t(locale, "individual.reflection.rating.belowAverage", "Below average"), t(locale, "individual.reflection.rating.average", "Average"), t(locale, "individual.reflection.rating.good", "Good"), t(locale, "individual.reflection.rating.excellent", "Excellent")][rating]}
            </p>
          )}
        </div>

        {/* Text fields */}
        {[
          { label: t(locale, "individual.reflection.strengths.label", "What strengths did you demonstrate?"), value: strengths, setter: setStrengths, placeholder: t(locale, "individual.reflection.strengths.placeholder", "e.g. Strong problem-solving, clear communication under pressure...") },
          { label: t(locale, "individual.reflection.areas.label", "Areas to improve"), value: areas, setter: setAreas, placeholder: t(locale, "individual.reflection.areas.placeholder", "e.g. Need to be more concise, better examples for system design questions...") },
          { label: t(locale, "individual.reflection.takeaways.label", "Key takeaways"), value: takeaways, setter: setTakeaways, placeholder: t(locale, "individual.reflection.takeaways.placeholder", "e.g. They care deeply about ownership and autonomy, focus on impact not output...") },
          { label: t(locale, "individual.reflection.followUp.label", "Follow-up actions"), value: followUp, setter: setFollowUp, placeholder: t(locale, "individual.reflection.followUp.placeholder", "e.g. Send thank-you email, research their tech stack, prepare references...") },
        ].map(({ label, value, setter, placeholder }) => (
          <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 space-y-2">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">{label}</label>
            <textarea
              rows={3}
              value={value}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none placeholder:text-[var(--text-muted)]/50"
            />
          </div>
        ))}

        {/* Save */}
        <div className="space-y-2">
          {saveError && <p className="text-xs text-red-400 text-center">{saveError}</p>}
          {saved && (
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              {t(locale, "individual.reflection.savedSuccess", "Reflection saved successfully.")}
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !rating}
            className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-white hover:bg-[var(--accent)]/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? t(locale, "individual.reflection.saving", "Saving…") : existing ? t(locale, "individual.reflection.update", "Update reflection") : t(locale, "individual.reflection.save", "Save reflection")}
          </button>
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {t(locale, "individual.reflection.back", "← Back")}
        </button>
      </div>
    </div>
  );
}
