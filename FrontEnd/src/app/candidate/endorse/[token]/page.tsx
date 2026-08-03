"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Star, CheckCircle2, AlertCircle } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import { apiFetch } from "@/lib/apiHelper";
import { vaultEndorseApi } from "@/lib/routes";

interface EndorsementData {
  id: string;
  dimension: string;
  endorser_name?: string;
  requester_name: string;
  expires_at: string;
}

type PageState = "loading" | "ready" | "submitted" | "error";

export default function EndorsePage() {
  const locale = getClientLocale();
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [endorsement, setEndorsement] = useState<EndorsementData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [endorserName, setEndorserName] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch(vaultEndorseApi(token), "none")
      .then((data) => {
        if (data) {
          const endorsementData = data as EndorsementData;
          setEndorsement(endorsementData);
          if (endorsementData.endorser_name) setEndorserName(endorsementData.endorser_name);
          setState("ready");
        } else {
          setErrorMsg(t(locale, "individual.endorse.defaultError", "This endorsement link is invalid or has expired."));
          setState("error");
        }
      })
      .catch(() => {
        setErrorMsg(t(locale, "individual.endorse.networkError", "Could not load the endorsement. Please check the link."));
        setState("error");
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      const data = await apiFetch(vaultEndorseApi(token), "none", {
        method: "POST",
        body: JSON.stringify({
          endorser_name: endorserName || undefined,
          rating,
          comment: comment || undefined,
        }),
      });
      if (data) {
        setState("submitted");
      } else {
        setErrorMsg(t(locale, "individual.endorse.submitFailed", "Failed to submit endorsement."));
        setState("error");
      }
    } catch {
      setErrorMsg(t(locale, "individual.endorse.networkError", "Could not load the endorsement. Please check the link."));
      setState("error");
    }
    setSubmitting(false);
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-surface)]">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 text-sm text-[var(--text-muted)]">{t(locale, "individual.endorse.loading", "Loading endorsement...")}</div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-surface)] px-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 max-w-md w-full text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-sm font-bold text-[var(--text-primary)]">{t(locale, "individual.endorse.errorTitle", "Unable to load endorsement")}</p>
          <p className="text-xs text-[var(--text-muted)]">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-surface)] px-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, "individual.endorse.thankYou", "Thank you!")}</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {t(locale, "individual.endorse.submittedDesc", "Your endorsement for")} <span className="font-semibold text-[var(--text-primary)]">{endorsement?.requester_name}</span> {" has been submitted."}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{t(locale, "individual.endorse.submittedClose", "You can now close this page.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-surface)] px-4 py-12">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">{t(locale, "individual.endorse.sectionLabel", "Aptely Endorsement")}</p>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            {t(locale, "individual.endorse.endorse", "Endorse")} {endorsement?.requester_name}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {t(locale, "individual.endorse.dimension", "Dimension:")} <span className="font-semibold text-[var(--text-secondary)]">{endorsement?.dimension}</span>
          </p>
        </div>

        {/* Your name */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[var(--text-muted)]">{t(locale, "individual.endorse.yourName", "Your name (optional)")}</label>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            placeholder={t(locale, "individual.endorse.yourNamePlaceholder", "e.g. Jane Smith")}
            value={endorserName}
            onChange={(e) => setEndorserName(e.target.value)}
          />
        </div>

        {/* Rating */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[var(--text-muted)]">{t(locale, "individual.endorse.rating", "Rating *")}</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition-colors ${
                  rating >= s
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                }`}
              >
                <Star className={`w-4 h-4 ${rating >= s ? "fill-[var(--accent)]" : ""}`} />
                <span className="text-[10px] font-bold">{s}</span>
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center">
              {["", t(locale, "individual.endorse.ratingPoor", "Poor"), t(locale, "individual.endorse.ratingBelowAverage", "Below average"), t(locale, "individual.endorse.ratingAverage", "Average"), t(locale, "individual.endorse.ratingGood", "Good"), t(locale, "individual.endorse.ratingExcellent", "Excellent")][rating]}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[var(--text-muted)]">{t(locale, "individual.endorse.comment", "Comment (optional)")}</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
            placeholder={t(locale, "individual.endorse.commentPlaceholder", "Share your honest feedback...")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !rating}
          className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-white hover:bg-[var(--accent)]/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? t(locale, "individual.endorse.submitting", "Submitting...") : t(locale, "individual.endorse.submit", "Submit endorsement")}
        </button>

        <p className="text-[10px] text-[var(--text-muted)] text-center">
          {t(locale, "individual.endorse.expiresPrefix", "This link expires")} {endorsement ? new Date(endorsement.expires_at).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR") : ""}.
          {t(locale, "individual.endorse.expiresSuffix", "Your feedback helps build a verified professional record.")}
        </p>
      </div>
    </div>
  );
}
