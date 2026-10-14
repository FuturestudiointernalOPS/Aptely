"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, CheckCircle2, XCircle, MessageSquare, ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, createAuthRedirect, myOfferApi, offerAcceptApi, offerRejectApi, offerCounterApi, individualsMyOffersApi } from "@/lib/routes";
import { EmptyState } from "@/components/ui/EmptyState";

interface OfferPayload {
  position?: string;
  compensation?: string;
  startDate?: string;
  benefits?: string;
  notes?: string;
}

interface Offer {
  id: string;
  status: "SENT" | "ACCEPTED" | "REJECTED" | "COUNTER_OFFERED";
  application_id: string | null;
  role_title: string;
  institution_name: string | null;
  payload: OfferPayload;
  created_at: string;
  updated_at: string;
}

interface Negotiation {
  id: string;
  actor_type: "HR" | "CANDIDATE";
  proposed_payload_json: OfferPayload;
  message: string | null;
  status: string;
  created_at: string;
}

const STATUS_CFG: Record<string, { labelKey: string; cls: string }> = {
  SENT:           { labelKey: "individual.offers.status.awaitingResponse", cls: "bg-amber-400/10 text-amber-400" },
  COUNTER_OFFERED:{ labelKey: "individual.offers.status.counterOfferSent", cls: "bg-blue-400/10 text-blue-400" },
  ACCEPTED:       { labelKey: "individual.offers.status.accepted",         cls: "bg-emerald-400/10 text-emerald-400" },
  REJECTED:       { labelKey: "individual.offers.status.rejected",         cls: "bg-red-400/10 text-red-400" },
};

export default function OffersPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [acting, setActing] = useState<"accept" | "reject" | "counter" | null>(null);
  const [counterMsg, setCounterMsg] = useState("");
  const [counterPayload, setCounterPayload] = useState<OfferPayload>({});
  const [showCounter, setShowCounter] = useState(false);
  const [actionError, setActionError] = useState("");

  const openOffer = async (offerId: string, offer?: Offer) => {
    if (selectedId === offerId) return;
    setSelectedId(offerId);
    setNegotiations([]);
    setShowCounter(false);
    setActionError("");
    const src = offer ?? offers.find((o) => o.id === offerId);
    if (src) setCounterPayload({ ...src.payload });
    setLoadingDetail(true);
    const res = await apiFetch(myOfferApi(offerId), "HR", { method: "GET", cache: "no-store" });
    const negs = (res?.offer_negotiations ?? []) as Negotiation[];
    setNegotiations(negs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    setLoadingDetail(false);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(createAuthRedirect(ROUTES.candidate.offers)); return; }
    if (!isPersonal) { router.replace(ROUTES.company.dashboard); return; }

    apiFetch(individualsMyOffersApi, "HR", { method: "GET", cache: "no-store" }).then((res) => {
      const rows: Offer[] = Array.isArray(res) ? res : [];
      setOffers(rows);
      setFetching(false);
      if (rows.length === 1) openOffer(rows[0].id, rows[0]);
    });
  }, [loading, router, user, isPersonal]);

  const handleAccept = async () => {
    if (!selectedId || acting) return;
    setActing("accept");
    setActionError("");
    const res = await apiFetch(offerAcceptApi(selectedId), "HR", { method: "POST" });
    if (res?.id || res?.status === "ACCEPTED") {
      setOffers((prev) => prev.map((o) => o.id === selectedId ? { ...o, status: "ACCEPTED" } : o));
    } else {
      setActionError(t(locale, "individual.offers.acceptFailed", "Failed to accept offer. Please try again."));
    }
    setActing(null);
  };

  const handleReject = async () => {
    if (!selectedId || acting) return;
    setActing("reject");
    setActionError("");
    const res = await apiFetch(offerRejectApi(selectedId), "HR", { method: "POST" });
    if (res?.id || res?.status === "REJECTED") {
      setOffers((prev) => prev.map((o) => o.id === selectedId ? { ...o, status: "REJECTED" } : o));
    } else {
      setActionError(t(locale, "individual.offers.rejectFailed", "Failed to reject offer. Please try again."));
    }
    setActing(null);
  };

  const handleCounter = async () => {
    if (!selectedId || acting) return;
    setActing("counter");
    setActionError("");
    const res = await apiFetch(offerCounterApi(selectedId), "HR", {
      method: "POST",
      body: JSON.stringify({
        payload: counterPayload,
        message: counterMsg || undefined,
      }),
    });
    if (res?.id) {
      setNegotiations((prev) => [...prev, res as Negotiation]);
      setOffers((prev) => prev.map((o) => o.id === selectedId ? { ...o, status: "COUNTER_OFFERED" } : o));
      setShowCounter(false);
      setCounterMsg("");
    } else {
      setActionError(t(locale, "individual.offers.counterFailed", "Failed to send counter-offer. Please try again."));
    }
    setActing(null);
  };

  const selectedOffer = offers.find((o) => o.id === selectedId);

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 text-sm text-[var(--text-muted)]">{t(locale, "individual.offers.loading", "Loading offers...")}</div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.offers.sectionLabel", "Decisions")}</p>
          <h1 className="text-page-title text-[var(--text-primary)] mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[var(--accent)]" />
            {t(locale, "individual.offers.title", "Offer & Decision Hub")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t(locale, "individual.offers.subtitle", "Review, negotiate and accept your offers in one place.")}</p>
        </div>

        {offers.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title={t(locale, "individual.offers.noOffers.title", "No offers yet")}
              description={t(locale, "individual.offers.noOffers.subtitle", "Offers from institutions will appear here once sent.")}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Offer list */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] px-1">{t(locale, "individual.offers.yourOffers", "Your offers")}</p>
              {offers.map((o) => {
                const cfg = STATUS_CFG[o.status] ?? { labelKey: "", cls: "bg-[var(--bg-raised)] text-[var(--text-muted)]" };
                const offerStatusLabel = cfg.labelKey ? t(locale, cfg.labelKey, o.status) : o.status;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => openOffer(o.id, o)}
                    className={`w-full text-left bg-[var(--bg-surface)] border rounded-xl p-4 space-y-2 transition-colors ${
                      selectedId === o.id
                        ? "border-[var(--accent)]"
                        : "border-[var(--border)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{o.role_title}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{o.institution_name ?? "—"}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${cfg.cls}`}>{offerStatusLabel}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{new Date(o.updated_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Offer detail */}
            <div className="md:col-span-2 space-y-4">
              {!selectedId && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center">
                  <FileText className="w-10 h-10 text-[var(--text-muted)]/30" />
                  <p className="text-sm text-[var(--text-muted)]">{t(locale, "individual.offers.selectPrompt", "Select an offer to review the terms and take action.")}</p>
                </div>
              )}

              {selectedId && loadingDetail && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 md:p-8 flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t(locale, "individual.offers.loading", "Loading offers...")}
                </div>
              )}

              {selectedOffer && !loadingDetail && (
                <>
                  {/* Offer terms */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.offers.offerTerms", "Offer terms")}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${STATUS_CFG[selectedOffer.status]?.cls ?? ""}`}>
                        {STATUS_CFG[selectedOffer.status]?.labelKey ? t(locale, STATUS_CFG[selectedOffer.status].labelKey, selectedOffer.status) : selectedOffer.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: t(locale, "individual.offers.field.position", "Position"),      value: selectedOffer.payload.position },
                        { label: t(locale, "individual.offers.field.compensation", "Compensation"),  value: selectedOffer.payload.compensation },
                        { label: t(locale, "individual.offers.field.startDate", "Start date"),    value: selectedOffer.payload.startDate },
                        { label: t(locale, "individual.offers.field.benefits", "Benefits"),      value: selectedOffer.payload.benefits },
                      ].filter((f) => f.value).map(({ label, value }) => (
                        <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] p-3 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                          <p className="text-sm text-[var(--text-primary)]">{value}</p>
                        </div>
                      ))}
                    </div>
                    {selectedOffer.payload.notes && (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] p-3 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.offers.field.notes", "Notes")}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{selectedOffer.payload.notes}</p>
                      </div>
                    )}
                  </div>

                  {selectedOffer.status === "COUNTER_OFFERED" && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 text-sm text-blue-400 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      {t(locale, "individual.offers.counterOfferSent", "Your counter-offer has been sent. Waiting for HR response.")}
                    </div>
                  )}

                  {/* Action buttons — only for SENT offers */}
                  {selectedOffer.status === "SENT" && (
                    <div className="space-y-3">
                      {actionError && <p className="text-xs text-red-400 text-center">{actionError}</p>}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleAccept}
                          disabled={!!acting}
                          className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-500/90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {acting === "accept" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          {t(locale, "individual.offers.acceptOffer", "Accept offer")}
                        </button>
                        <button
                          type="button"
                          onClick={handleReject}
                          disabled={!!acting}
                          className="flex-1 rounded-xl border border-red-400/50 py-3 text-sm font-bold text-red-400 hover:bg-red-400/5 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {acting === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          {t(locale, "individual.offers.decline", "Decline")}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCounter((v) => !v)}
                        className="w-full rounded-xl border border-[var(--border)] py-2.5 text-sm font-bold text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {t(locale, "individual.offers.negotiate", "Negotiate / Counter-offer")}
                        {showCounter ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {/* Counter-offer form */}
                      {showCounter && (
                        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.offers.counterProposal", "Your counter-proposal")}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(["position", "compensation", "startDate", "benefits"] as const).map((field) => (
                              <div key={field} className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                  {t(locale, `individual.offers.field.${field}`, field === "startDate" ? "Start date" : field === "benefits" ? "Benefits" : field === "position" ? "Position" : "Compensation")}
                                </label>
                                <input
                                  type="text"
                                  value={counterPayload[field] ?? ""}
                                  onChange={(e) => setCounterPayload((p) => ({ ...p, [field]: e.target.value }))}
                                  placeholder={selectedOffer.payload[field] ?? ""}
                                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]/40"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{t(locale, "individual.offers.messageOptional", "Message (optional)")}</label>
                            <textarea
                              rows={2}
                              value={counterMsg}
                              onChange={(e) => setCounterMsg(e.target.value)}
                              placeholder={t(locale, "individual.offers.counterPlaceholder", "Explain your counter-proposal...")}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none placeholder:text-[var(--text-muted)]/50"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCounter}
                            disabled={!!acting}
                            className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {acting === "counter" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {t(locale, "individual.offers.sendCounter", "Send counter-offer")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Negotiation history */}
                  {negotiations.length > 0 && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.offers.negotiationHistory", "Negotiation history")}</p>
                      <div className="space-y-3">
                        {negotiations.map((n) => (
                          <div
                            key={n.id}
                            className={`rounded-xl border p-4 space-y-2 ${
                              n.actor_type === "CANDIDATE"
                                ? "border-[var(--accent)]/30 bg-[var(--accent-dim)]"
                                : "border-[var(--border)] bg-[var(--bg-raised)]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                {n.actor_type === "CANDIDATE" ? t(locale, "individual.offers.yourProposal", "Your proposal") : t(locale, "individual.offers.institutionResponse", "Institution response")}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)]">{new Date(n.created_at).toLocaleDateString()}</span>
                            </div>
                            {n.message && <p className="text-xs text-[var(--text-secondary)]">{n.message}</p>}
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(n.proposed_payload_json ?? {}).filter(([, v]) => v).map(([k, v]) => (
                                <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)]">
                                  <span className="font-bold">{k}:</span> {String(v)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
