"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiHelper";
import { offerCounterApi, offerCounterApproveApi, offerCounterRejectApi } from "@/lib/routes";
import { getOfferCounterHistory, type OfferCounterHistoryEntry } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Button from "@/components/Button";

interface OfferCounterNegotiationProps {
  offerId: string;
  currentTerms: Record<string, any>;
  status: string;
  onCounterSubmitted: () => void;
  userRole: "CANDIDATE" | "HR";
}

function DeltaBadge({ label, original, proposed }: { label: string; original: string; proposed: string }) {
  if (!proposed || original === proposed) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-rose-400 line-through">{original || "—"}</span>
        <ArrowRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
        <span className="text-sm text-emerald-400 font-medium">{proposed}</span>
      </div>
    </div>
  );
}

function CounterHistoryTimeline({ history }: { history: OfferCounterHistoryEntry[] }) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  const statusIcon = (s: OfferCounterHistoryEntry["status"]) => {
    if (s === "APPROVED") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (s === "REJECTED") return <XCircle className="w-4 h-4 text-rose-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-raised)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {tr("counterNegotiation.historyTitle", "Negotiation history ({{count}} round{{plural}})")
              .replace("{{count}}", String(history.length))
              .replace("{{plural}}", history.length !== 1 ? "s" : "")}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>

      {open && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {history.map((entry) => (
            <div key={entry.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon(entry.status)}
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    {tr("counterNegotiation.round", "Round")} {entry.round} · {entry.proposed_by === "CANDIDATE" ? tr("counterNegotiation.actorCandidate", "Candidate") : tr("counterNegotiation.actorHR", "HR")}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {entry.counter_terms.compensation !== undefined && (
                  <div className="text-xs">
                    <span className="text-[var(--text-muted)]">{tr("counterNegotiation.compensation", "Compensation")}: </span>
                    <span className="text-[var(--text-primary)] font-medium">{String(entry.counter_terms.compensation)}</span>
                  </div>
                )}
                {entry.counter_terms.startDate !== undefined && (
                  <div className="text-xs">
                    <span className="text-[var(--text-muted)]">{tr("counterNegotiation.startDate", "Start Date")}: </span>
                    <span className="text-[var(--text-primary)] font-medium">{String(entry.counter_terms.startDate)}</span>
                  </div>
                )}
                {entry.counter_terms.benefits !== undefined && (
                  <div className="text-xs">
                    <span className="text-[var(--text-muted)]">{tr("counterNegotiation.benefits", "Benefits")}: </span>
                    <span className="text-[var(--text-primary)] font-medium">{String(entry.counter_terms.benefits)}</span>
                  </div>
                )}
              </div>
              {entry.reason && (
                <p className="text-xs text-[var(--text-secondary)] italic">
                  "
                  {entry.reason === "Counter-offer approved by HR"
                    ? tr("counterNegotiation.approvedByHR", "Counter-offer approved by HR")
                    : entry.reason === "Counter-offer rejected by HR"
                    ? tr("counterNegotiation.rejectedByHR", "Counter-offer rejected by HR")
                    : entry.reason}
                  "
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OfferCounterNegotiation({
  offerId,
  currentTerms,
  status,
  onCounterSubmitted,
  userRole,
}: OfferCounterNegotiationProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState<OfferCounterHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [counterPayload, setCounterPayload] = useState({
    compensation: currentTerms.compensation || "",
    startDate: currentTerms.startDate || "",
    benefits: currentTerms.benefits || "",
  });
  const [counterMessage, setCounterMessage] = useState("");

  const fetchHistory = useCallback(async () => {
    if (userRole !== "HR") return;
    setHistoryLoading(true);
    try {
      const data = await getOfferCounterHistory(offerId);
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [offerId, userRole]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  // Compute delta: last candidate counter vs current terms
  const lastCandidateCounter = [...history]
    .reverse()
    .find((h) => h.proposed_by === "CANDIDATE" && h.status === "PENDING");

  const handleSubmitCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch(offerCounterApi(offerId), "HR", {
        method: "POST",
        body: JSON.stringify({ payload: counterPayload, message: counterMessage }),
      });
      setShowForm(false);
      onCounterSubmitted();
      void fetchHistory();
    } catch (err: any) {
      setError(err.message || tr("counterNegotiation.failedSubmit", "Failed to submit counter"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveCounter = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch(offerCounterApproveApi(offerId), "HR", {
        method: "POST",
        body: JSON.stringify({ reason: "Approved by HR" }),
      });
      onCounterSubmitted();
      void fetchHistory();
    } catch (err: any) {
      setError(err.message || tr("counterNegotiation.failedApprove", "Failed to approve counter"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectCounter = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch(offerCounterRejectApi(offerId), "HR", {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by HR" }),
      });
      onCounterSubmitted();
      void fetchHistory();
    } catch (err: any) {
      setError(err.message || tr("counterNegotiation.failedReject", "Failed to reject counter"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
      <h3 className="text-base font-display font-bold text-[var(--text-primary)]">{tr("counterNegotiation.title", "Counter-Offer Negotiation")}</h3>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* HR awaiting candidate */}
      {status === "SENT" && userRole === "HR" && (
        <p className="text-sm text-[var(--text-muted)] italic">{tr("counterNegotiation.awaitingCandidate", "Offer sent — awaiting candidate response.")}</p>
      )}

      {/* Candidate can counter */}
      {status === "SENT" && userRole === "CANDIDATE" && (
        <>
          <Button onClick={() => setShowForm(!showForm)} variant="outline" className="w-full">
            {showForm ? tr("counterNegotiation.cancel", "Cancel") : tr("counterNegotiation.makeCounter", "Make Counter Offer")}
          </Button>
          {showForm && (
            <form onSubmit={handleSubmitCounter} className="space-y-4 border-t border-[var(--border)] pt-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {tr("counterNegotiation.proposedCompensation", "Proposed Compensation")}
                </label>
                <input
                  type="text"
                  value={counterPayload.compensation}
                  onChange={(e) => setCounterPayload({ ...counterPayload, compensation: e.target.value })}
                  placeholder={tr("counterNegotiation.compensationPlaceholder", "ex: 85 000 EUR / 95,000 USD")}
                  className="glass-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {tr("counterNegotiation.desiredStartDate", "Desired Start Date")}
                </label>
                <input
                  type="date"
                  value={counterPayload.startDate}
                  onChange={(e) => setCounterPayload({ ...counterPayload, startDate: e.target.value })}
                  className="glass-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {tr("counterNegotiation.message", "Message")}
                </label>
                <textarea
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  placeholder={tr("counterNegotiation.messagePlaceholder", "Why are you proposing these changes?")}
                  rows={3}
                  className="glass-input w-full resize-none"
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full" isLoading={isLoading}>
                {tr("counterNegotiation.submitCounter", "Submit Counter Offer")}
              </Button>
            </form>
          )}
        </>
      )}

      {/* HR reviews candidate counter */}
      {status === "COUNTER_OFFERED" && userRole === "HR" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">{tr("counterNegotiation.candidateProposed", "Candidate has proposed new terms. Review and respond:")}</p>

          {/* Delta display */}
          {lastCandidateCounter && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("counterNegotiation.proposedChanges", "Proposed Changes")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <DeltaBadge
                  label={tr("counterNegotiation.compensation", "Compensation")}
                  original={String(currentTerms.compensation || "")}
                  proposed={String(lastCandidateCounter.counter_terms.compensation || "")}
                />
                <DeltaBadge
                  label={tr("counterNegotiation.startDate", "Start Date")}
                  original={String(currentTerms.startDate || "")}
                  proposed={String(lastCandidateCounter.counter_terms.startDate || "")}
                />
                <DeltaBadge
                  label={tr("counterNegotiation.benefits", "Benefits")}
                  original={String(currentTerms.benefits || "")}
                  proposed={String(lastCandidateCounter.counter_terms.benefits || "")}
                />
              </div>
              {lastCandidateCounter.reason && (
                <p className="text-xs text-[var(--text-secondary)] italic bg-[var(--accent-dim)] rounded-lg px-3 py-2">
                  "{lastCandidateCounter.reason}"
                </p>
              )}
            </div>
          )}

          {/* Salary band alert */}
          {lastCandidateCounter && (currentTerms.salaryBandMax || currentTerms.salaryBandMin) && (() => {
            const proposed = String(lastCandidateCounter.counter_terms.compensation || "");
            const num = parseFloat(proposed.replace(/[^0-9.]/g, ""));
            const max = currentTerms.salaryBandMax ? parseFloat(String(currentTerms.salaryBandMax).replace(/[^0-9.]/g, "")) : null;
            const min = currentTerms.salaryBandMin ? parseFloat(String(currentTerms.salaryBandMin).replace(/[^0-9.]/g, "")) : null;
            const outOfBand = (max !== null && !isNaN(num) && !isNaN(max) && num > max) || (min !== null && !isNaN(num) && !isNaN(min) && num < min);
            if (!outOfBand || isNaN(num)) return null;
            return (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-400">{tr("counterNegotiation.bandAlert.title", "Counter-offer exceeds salary band")}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {tr("counterNegotiation.bandAlert.desc", "Proposed")} {proposed}
                    {max !== null ? ` · ${tr("counterNegotiation.bandAlert.max", "Max")} ${currentTerms.salaryBandMax}` : ""}
                    {min !== null ? ` · ${tr("counterNegotiation.bandAlert.min", "Min")} ${currentTerms.salaryBandMin}` : ""}
                  </p>
                </div>
              </div>
            );
          })()}

          {historyLoading && !lastCandidateCounter && (
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              {tr("counterNegotiation.loadingCounter", "Loading counter details…")}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleApproveCounter} disabled={isLoading} className="flex-1" isLoading={isLoading}>
              {tr("counterNegotiation.approveCounter", "Approve Counter")}
            </Button>
            <Button onClick={handleRejectCounter} disabled={isLoading} variant="danger" className="flex-1" isLoading={isLoading}>
              {tr("counterNegotiation.rejectCounter", "Reject Counter")}
            </Button>
          </div>
        </div>
      )}

      {/* Negotiation history (HR view) */}
      {userRole === "HR" && (
        <CounterHistoryTimeline history={history} />
      )}
    </div>
  );
}
