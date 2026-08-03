"use client";

import { useState } from "react";
import { apiSend } from "@/lib/apiHelper";
import { decisionRatifyApi } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";
import { CheckCircle2, RotateCcw, Loader2 } from "lucide-react";

interface DecisionRatifierProps {
  applicationId: string;
  decisionId: string;
  candidateName: string;
  decision: {
    action: "ACCEPT" | "REJECT" | "HOLD";
    reason?: string;
  };
  onRatificationSubmitted: () => void;
}

const ACTION_STYLE: Record<string, string> = {
  ACCEPT: "text-emerald-400",
  REJECT: "text-rose-400",
  HOLD: "text-amber-400",
};

export function DecisionRatifier({
  applicationId,
  decisionId,
  candidateName,
  decision,
  onRatificationSubmitted,
}: DecisionRatifierProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");

  const handleRatify = async (approvalStatus: "APPROVED" | "REJECTED") => {
    setIsLoading(true);
    setError(null);
    try {
      await apiSend(decisionRatifyApi(applicationId), {
        method: "POST",
        body: JSON.stringify({
          decisionId,
          status: approvalStatus === "APPROVED" ? "APPROVED" : "REQUEST_REVIEW",
          reason: approvalStatus === "REJECTED" ? reviewReason : undefined,
        }),
      });
      onRatificationSubmitted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || tr("decisionRatifier.error", "Failed to ratify decision"));
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-[var(--text-primary)] font-bold text-sm">
          {tr("decisionRatifier.title", "Ratification directeur")}
        </h3>
        <p className="text-[var(--text-muted)] text-xs mt-0.5">{candidateName}</p>
      </div>

      {/* Decision summary */}
      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-1">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold">
          {tr("decisionRatifier.managerDecision", "Décision du manager")}
          {" "}<span className={`${ACTION_STYLE[decision.action]} normal-case tracking-normal font-bold`}>{decision.action}</span>
        </p>
        {decision.reason && (
          <p className="text-sm text-[var(--text-secondary)]">{decision.reason}</p>
        )}
      </div>

      {/* Ratification actions */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          {tr("decisionRatifier.yourRatification", "Votre ratification")}
        </p>

        <button
          onClick={() => handleRatify("APPROVED")}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {tr("decisionRatifier.approve", "Approuver la décision")}
        </button>

        <div className="space-y-2">
          <textarea
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            placeholder={tr("decisionRatifier.reviewPlaceholder", "Motif de la demande de révision...")}
            rows={2}
            className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-rose-400"
          />
          <button
            onClick={() => handleRatify("REJECTED")}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-400/40 bg-rose-400/10 text-rose-400 font-bold text-sm hover:bg-rose-400/20 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {tr("decisionRatifier.requestReview", "Demander une révision")}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
