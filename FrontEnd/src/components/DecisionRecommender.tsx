"use client";

import { useState } from "react";
import { apiSend } from "@/lib/apiHelper";
import { decisionRecommendApi } from "@/lib/routes";
import Button from "@/components/Button";
import { getClientLocale, t } from "@/lib/i18n";

interface DecisionRecommenderProps {
  applicationId: string;
  candidateName: string;
  matchScore: number | null;
  onRecommendationSubmitted: () => void;
}

export function DecisionRecommender({
  applicationId,
  candidateName,
  matchScore,
  onRecommendationSubmitted,
}: DecisionRecommenderProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<"STRONG" | "MEDIUM" | "WEAK">("STRONG");
  const [observations, setObservations] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiSend(decisionRecommendApi(applicationId), {
        method: "POST",
        body: JSON.stringify({ action: recommendation, reason: observations }),
      });
      onRecommendationSubmitted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || tr("decisionRecommender.error", "Failed to submit recommendation"));
    }
    setIsLoading(false);
  };

  const scoreDisplay = matchScore != null ? `${matchScore}%` : tr("decisionRecommender.noScore", "—");

  return (
    <div
      className="rounded-2xl p-6 space-y-4 border"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{tr("decisionRecommender.title", "Recommandation candidat")}</h3>
        <p className="text-sm text-[var(--text-muted)]">
          {candidateName}
          {" — "}
          {tr("decisionRecommender.matchScore", "Score de matching :")} {scoreDisplay}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">{tr("decisionRecommender.yourRecommendation", "Votre recommandation")}</label>
          <div className="space-y-2">
            {(["STRONG", "MEDIUM", "WEAK"] as const).map((level) => (
              <label key={level} className="flex items-center gap-3 cursor-pointer text-sm text-[var(--text-primary)]">
                <input
                  type="radio"
                  name="recommendation"
                  value={level}
                  checked={recommendation === level}
                  onChange={() => setRecommendation(level)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                <span>
                  <strong>{level.charAt(0) + level.slice(1).toLowerCase()}</strong>
                  {level === "STRONG" && ` — ${tr("decisionRecommender.strong", "Excellent profil, recommande de continuer")}`}
                  {level === "MEDIUM" && ` — ${tr("decisionRecommender.medium", "Profil adéquat, continuer avec prudence")}`}
                  {level === "WEAK" && ` — ${tr("decisionRecommender.weak", "Profil inadapté, recommande de refuser")}`}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">{tr("decisionRecommender.observations", "Observations clés")}</label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder={tr("decisionRecommender.placeholder", "Pourquoi cette recommandation ? Points positifs ou concernants ?")}
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none transition-colors"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full" isLoading={isLoading}>
          {tr("decisionRecommender.submit", "Soumettre la recommandation")}
        </Button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
