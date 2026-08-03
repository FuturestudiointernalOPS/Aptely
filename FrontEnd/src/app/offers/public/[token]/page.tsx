"use client";

import { use, useEffect, useState } from "react";
import {
  getPublicOfferByToken,
  publicAcceptOffer,
  publicRejectOffer,
  publicCounterOffer,
} from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";
import { FileText, Loader2, CheckCircle2, XCircle, Send, AlertTriangle } from "lucide-react";


type PublicOffer = {
  id: string;
  status: string;
  expiresAt: string;
  roleTitle?: string;
  institution?: { name?: string };
  candidate?: { full_name?: string; email?: string };
  latestVersion?: {
    payload?: {
      position?: string;
      compensation?: string;
      startDate?: string;
      benefits?: string;
      notes?: string;
    };
  };
};

export default function PublicOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [counterMessage, setCounterMessage] = useState("");
  const [counterCompensation, setCounterCompensation] = useState("");
  const [counterStartDate, setCounterStartDate] = useState("");
  const [counterBenefits, setCounterBenefits] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const statusLabel = (status: string | undefined) => {
    if (!status) return tr("common.empty", "—");
    const normalized = status.toUpperCase();
    if (normalized === "PENDING") return tr("offers.public.status.pending", "Pending");
    if (normalized === "ACCEPTED") return tr("offers.public.status.accepted", "Accepted");
    if (normalized === "REJECTED") return tr("offers.public.status.rejected", "Rejected");
    if (normalized === "COUNTERED") return tr("offers.public.status.countered", "Countered");
    if (normalized === "EXPIRED") return tr("offers.public.status.expired", "Expired");
    return status;
  };

  const fetchOffer = async () => {
    setLoading(true);
    const data = await getPublicOfferByToken(token);
    setOffer(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOffer();
  }, [token]);

  const handleAccept = async () => {
    setProcessing(true);
    const ok = await publicAcceptOffer(token);
    setFeedback(ok ? tr("offers.public.feedback.acceptSuccess", "Offer accepted successfully.") : tr("offers.public.feedback.acceptError", "Unable to accept offer."));
    await fetchOffer();
    setProcessing(false);
  };

  const handleReject = async () => {
    setProcessing(true);
    const ok = await publicRejectOffer(token);
    setFeedback(ok ? tr("offers.public.feedback.rejectSuccess", "Offer rejected.") : tr("offers.public.feedback.rejectError", "Unable to reject offer."));
    await fetchOffer();
    setProcessing(false);
  };

  const handleCounter = async () => {
    const payload: Record<string, unknown> = {};
    if (counterCompensation.trim()) payload.compensation = counterCompensation.trim();
    if (counterStartDate.trim()) payload.startDate = counterStartDate.trim();
    if (counterBenefits.trim()) payload.benefits = counterBenefits.trim();

    if (Object.keys(payload).length === 0 && !counterMessage.trim()) {
      setFeedback(tr("offers.public.feedback.counterRequired", "Please provide at least one counter term or message."));
      return;
    }

    setProcessing(true);
    const ok = await publicCounterOffer(token, payload, counterMessage || undefined);
    setFeedback(ok ? tr("offers.public.feedback.counterSuccess", "Counter-offer sent.") : tr("offers.public.feedback.counterError", "Unable to send counter-offer."));
    await fetchOffer();
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-24 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
        <p className="text-sm text-[var(--text-muted)]">{tr("offers.public.loading", "Loading offer...")}</p>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="max-w-3xl mx-auto py-24 bg-[var(--bg-surface)] border border-[var(--border)] p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-rose-400" />
        <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">{tr("offers.public.unavailableTitle", "Offer unavailable")}</h1>
        <p className="text-sm text-[var(--text-muted)]">{tr("offers.public.unavailableDescription", "This offer link is invalid, expired, or no longer accessible.")}</p>
      </div>
    );
  }

  const payload = offer.latestVersion?.payload;
  const isTerminal = ["ACCEPTED", "REJECTED", "EXPIRED"].includes((offer.status || "").toUpperCase());
  const isSent = (offer.status || "").toUpperCase() === "SENT";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent)/80] flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">{tr("offers.public.title", "Offer Letter")}</h1>
            <p className="text-sm text-[var(--text-muted)]">{offer.institution?.name || tr("offers.public.institutionFallback", "Institution")} · {offer.roleTitle || tr("offers.public.roleFallback", "Role")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.fields.candidate", "Candidate")}</p>
            <p className="text-[var(--text-primary)] font-medium">{offer.candidate?.full_name || offer.candidate?.email || tr("common.empty", "—")}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.fields.status", "Status")}</p>
            <p className="text-[var(--text-primary)] font-medium">{statusLabel(offer.status)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.fields.compensation", "Compensation")}</p>
            <p className="text-[var(--text-primary)] font-medium">{payload?.compensation || tr("common.empty", "—")}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.fields.startDate", "Start Date")}</p>
            <p className="text-[var(--text-primary)] font-medium">{payload?.startDate || tr("common.empty", "—")}</p>
          </div>
        </div>

        {payload?.benefits && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{tr("offers.public.fields.benefits", "Benefits")}</p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{payload.benefits}</p>
          </div>
        )}

        {payload?.notes && (
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{tr("offers.public.fields.notes", "Notes")}</p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{payload.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
        <h2 className="text-base font-display font-bold text-[var(--text-primary)]">{tr("offers.public.responseTitle", "Your Response")}</h2>

        {isTerminal ? (
          <div className="rounded-xl border border-[var(--border)] p-4 text-center space-y-2">
            {(offer.status || "").toUpperCase() === "ACCEPTED" && (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-[var(--text-primary)] font-semibold">{tr("offers.public.feedback.alreadyAccepted", "You have accepted this offer.")}</p>
                <p className="text-[var(--text-muted)] text-sm">{tr("offers.public.feedback.alreadyAcceptedSub", "Your team has been notified. Welcome aboard!")}</p>
              </>
            )}
            {(offer.status || "").toUpperCase() === "REJECTED" && (
              <>
                <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p className="text-[var(--text-primary)] font-semibold">{tr("offers.public.feedback.alreadyRejected", "You have declined this offer.")}</p>
              </>
            )}
            {(offer.status || "").toUpperCase() === "EXPIRED" && (
              <>
                <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-[var(--text-primary)] font-semibold">{tr("offers.public.feedback.expired", "This offer has expired.")}</p>
                <p className="text-[var(--text-muted)] text-sm">{tr("offers.public.feedback.expiredSub", "Please contact the recruiter if you have questions.")}</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={handleAccept}
                disabled={processing}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {tr("offers.public.actions.accept", "Accept")}
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="btn-glass flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                {tr("offers.public.actions.reject", "Reject")}
              </button>
              {isSent && (
                <button
                  onClick={handleCounter}
                  disabled={processing}
                  className="btn-glass flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {tr("offers.public.actions.counter", "Counter")}
                </button>
              )}
            </div>

            {isSent && (
              <div className="space-y-2">
                <label htmlFor="counter-compensation" className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.counter.expectedCompensation", "Expected compensation")}</label>
                <input
                  id="counter-compensation"
                  name="counter-compensation"
                  value={counterCompensation}
                  onChange={(e) => setCounterCompensation(e.target.value)}
                  placeholder={tr("offers.public.counter.expectedCompensationPlaceholder", "ex: 85k EUR / 95k USD")}
                  className="glass-input w-full"
                />

                <label htmlFor="counter-start-date" className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.counter.preferredStartDate", "Preferred start date")}</label>
                <input
                  id="counter-start-date"
                  name="counter-start-date"
                  type="date"
                  value={counterStartDate}
                  onChange={(e) => setCounterStartDate(e.target.value)}
                  className="glass-input w-full"
                />

                <label htmlFor="counter-benefits" className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.counter.benefitsAdjustment", "Benefits adjustment")}</label>
                <textarea
                  id="counter-benefits"
                  name="counter-benefits"
                  value={counterBenefits}
                  onChange={(e) => setCounterBenefits(e.target.value)}
                  className="glass-input w-full h-20 resize-none"
                  placeholder={tr("offers.public.counter.benefitsAdjustmentPlaceholder", "Optional benefits changes")}
                />

                <label htmlFor="counter-message" className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{tr("offers.public.counter.messageOptional", "Message (optional)")}</label>
                <textarea
                  id="counter-message"
                  name="counter-message"
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  className="glass-input w-full h-20 resize-none"
                />
              </div>
            )}
          </>
        )}

        {feedback && <p className="text-sm text-[var(--text-muted)]">{feedback}</p>}
      </div>
    </div>
  );
}
