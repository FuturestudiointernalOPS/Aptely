"use client";

import { useState } from "react";
import { apiSend } from "@/lib/apiHelper";
import { decisionDecideApi } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

interface DecisionMakerProps {
  applicationId: string;
  candidateName: string;
  recommendation?: {
    recommendation: "STRONG" | "MEDIUM" | "WEAK";
    observations?: string;
  };
  onDecisionSubmitted: () => void;
}

const DECISION_STYLES: Record<string, { selected: string; label: string }> = {
  ACCEPT: { selected: "border-emerald-400 bg-emerald-400/10 text-emerald-400", label: "✓ Accepter — Passer à l'étape offre" },
  REJECT: { selected: "border-rose-400 bg-rose-400/10 text-rose-400", label: "✗ Refuser — Clôturer la candidature" },
  HOLD:   { selected: "border-amber-400 bg-amber-400/10 text-amber-400",  label: "⏸ En attente — Demander plus d'infos" },
};

export function DecisionMaker({
  applicationId,
  candidateName,
  recommendation,
  onDecisionSubmitted,
}: DecisionMakerProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"ACCEPT" | "REJECT" | "HOLD">("ACCEPT");
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiSend(decisionDecideApi(applicationId), {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      onDecisionSubmitted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || tr("decisionMaker.error", "Impossible d'enregistrer la décision"));
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-[var(--text-primary)] font-bold text-sm">
          {tr("decisionMaker.title", "Décision de recrutement")}
        </h3>
        <p className="text-[var(--text-muted)] text-xs mt-0.5">{candidateName}</p>
      </div>

      {recommendation && (
        <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold">
            {tr("decisionMaker.recommendation", "Recommandation du recruteur :")}
            {" "}<span className="text-[var(--text-primary)] normal-case tracking-normal font-bold">{recommendation.recommendation}</span>
          </p>
          {recommendation.observations && (
            <p className="text-sm text-[var(--text-secondary)]">{recommendation.observations}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            {tr("decisionMaker.decision", "Décision")}
          </p>
          {(["ACCEPT", "REJECT", "HOLD"] as const).map((btn) => {
            const style = DECISION_STYLES[btn];
            const isSelected = action === btn;
            return (
              <button
                key={btn}
                type="button"
                onClick={() => setAction(btn)}
                className={`w-full px-4 py-3 rounded-xl border text-left text-sm font-semibold transition-all ${
                  isSelected
                    ? style.selected
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                }`}
              >
                {tr(`decisionMaker.${btn.toLowerCase()}`, style.label)}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            {tr("decisionMaker.reason", "Motif de la décision")}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr("decisionMaker.placeholder", "Expliquez brièvement votre décision...")}
            rows={3}
            className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {tr("decisionMaker.submit", "Enregistrer la décision")}
        </button>
      </form>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
