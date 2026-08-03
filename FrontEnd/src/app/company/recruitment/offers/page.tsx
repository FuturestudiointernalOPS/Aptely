"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listOffers,
  updateOfferStatus,
  type OfferListItem,
  type OfferStatus,
} from "@/lib/api";
import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ChevronDown,
  User2,
  PlusCircle,
  Eye,
  ArrowUpRight,
  MessageSquare,
  TrendingUp,
  Timer,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { getClientLocale, t, Locale } from "@/lib/i18n";
import { ROUTES, offerPath} from "@/lib/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import { PageHeader } from "@/components/ui/PageHeader";


function relativeTime(iso: string, locale: Locale): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t(locale, "common.time.justNow", "Just now");
  if (m < 60) return t(locale, "common.time.minAgo", "{{m}} min ago", { m });
  const h = Math.floor(m / 60);
  if (h < 24) {
    return h === 1
      ? t(locale, "common.time.hourAgo", "1 hour ago", { h })
      : t(locale, "common.time.hoursAgo", "{{h}} hours ago", { h });
  }
  const d = Math.floor(h / 24);
  return d === 1
    ? t(locale, "common.time.dayAgo", "1 day ago", { d })
    : t(locale, "common.time.daysAgo", "{{d}} days ago", { d });
}

export default function OffersPage() {
  const locale = getClientLocale();
  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [statusModal, setStatusModal] = useState<{ offer: OfferListItem; newStatus: OfferStatus } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOffers({
        status: (statusFilter as OfferStatus) || undefined,
        limit: 50,
      });
      setOffers(res.data || []);
      setMeta(res.meta || { total: 0, page: 1, limit: 20 });
    } catch (e) {
      console.error("[Offers] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handleStatusChange = async () => {
    if (!statusModal) return;
    setSubmitting(true);
    try {
      await updateOfferStatus(statusModal.offer.id, statusModal.newStatus);
      setStatusModal(null);
      await fetchOffers();
    } catch (e) {
      console.error("[Offers] Status update error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOffers = searchQuery
    ? offers.filter((o) => {
        const q = searchQuery.toLowerCase();
        return (
          o.roleTitle?.toLowerCase().includes(q) ||
          o.candidate?.full_name?.toLowerCase().includes(q) ||
          o.candidate?.email?.toLowerCase().includes(q)
        );
      })
    : offers;

  const counts = {
    total: offers.length,
    draft: offers.filter((o) => o.status === "DRAFT").length,
    sent: offers.filter((o) => o.status === "SENT").length,
    accepted: offers.filter((o) => o.status === "ACCEPTED").length,
    rejected: offers.filter((o) => o.status === "REJECTED").length,
    counterOffered: offers.filter((o) => o.status === "COUNTER_OFFERED").length,
    expired: offers.filter((o) => o.status === "EXPIRED").length,
  };

  // Offer Analytics
  const decidedOffers = offers.filter((o) => ["ACCEPTED", "REJECTED", "EXPIRED"].includes(o.status));
  const acceptanceRate = decidedOffers.length > 0
    ? Math.round((counts.accepted / decidedOffers.length) * 100)
    : null;
  const negotiationRate = counts.total > 0
    ? Math.round(((counts.counterOffered) / counts.total) * 100)
    : null;
  const acceptedWithDates = offers.filter((o) => o.status === "ACCEPTED" && o.createdAt && o.updatedAt);
  const avgDaysToSign = acceptedWithDates.length > 0
    ? Math.round(
        acceptedWithDates.reduce((sum, o) => {
          const diff = new Date(o.updatedAt!).getTime() - new Date(o.createdAt!).getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }, 0) / acceptedWithDates.length
      )
    : null;

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof FileText }> = {
    DRAFT:          { label: t(locale, "offers.status.draft", "Draft"),           color: "text-slate-400",  bg: "bg-slate-400/10 border-slate-400/20",  icon: FileText },
    SENT:           { label: t(locale, "offers.status.sent", "Sent"),             color: "text-sky-400",    bg: "bg-sky-400/10 border-sky-400/20",      icon: Send },
    COUNTER_OFFERED:{ label: t(locale, "offers.status.counter", "Counter-offer"), color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/20",    icon: MessageSquare },
    ACCEPTED:       { label: t(locale, "offers.status.accepted", "Accepted"),     color: "text-emerald-400",bg: "bg-emerald-400/10 border-emerald-400/20",icon: CheckCircle2 },
    REJECTED:       { label: t(locale, "offers.status.rejected", "Rejected"),     color: "text-rose-400",   bg: "bg-rose-400/10 border-rose-400/20",    icon: XCircle },
    EXPIRED:        { label: t(locale, "offers.status.expired", "Expired"),       color: "text-amber-400",  bg: "bg-amber-400/10 border-amber-400/20",  icon: Clock },
  };

  const filterOptions = [
    { value: "", label: t(locale, "offers.status.all", "All statuses") },
    { value: "DRAFT", label: t(locale, "offers.status.draft", "Draft") },
    { value: "SENT", label: t(locale, "offers.status.sent", "Sent") },
    { value: "COUNTER_OFFERED", label: t(locale, "offers.status.counter", "Counter-offer") },
    { value: "ACCEPTED", label: t(locale, "offers.status.accepted", "Accepted") },
    { value: "REJECTED", label: t(locale, "offers.status.rejected", "Rejected") },
    { value: "EXPIRED", label: t(locale, "offers.status.expired", "Expired") },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <PageHeader
        className="animate-fade-in-up"
        icon={<FileText className="w-5 h-5 text-[var(--accent)]" />}
        title={t(locale, "offers.title", "Offer management")}
        subtitle={t(locale, "offers.subtitle", "Create, track, and update hiring offers")}
        actions={
          <Link
            href={ROUTES.company.recruitment.roles}
            className="btn-primary flex items-center gap-2 text-sm"
            title={t(locale, "offers.newOfferHint", "Validate a candidate in their role pipeline to create an offer")}
          >
            <PlusCircle className="w-4 h-4" />
            {t(locale, "offers.newOffer", "New offer")}
            <span className="text-[10px] opacity-70 ml-1">{t(locale, "offers.toRoles", "→ Job postings")}</span>
          </Link>
        }
      />

      {/* Stats — horizontal strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-4 sm:px-6 py-4 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-8 animate-fade-in-up delay-75 sm:overflow-x-auto">
        {[
          { label: t(locale, "offers.total", "Total"), value: counts.total, color: "text-[var(--text-primary)]" },
          { label: t(locale, "offers.drafts", "Drafts"), value: counts.draft, color: "text-slate-400", dot: "bg-slate-400" },
          { label: t(locale, "offers.sent", "Sent"), value: counts.sent, color: "text-sky-400", dot: "bg-sky-400" },
          { label: t(locale, "offers.accepted", "Accepted"), value: counts.accepted, color: "text-emerald-400", dot: "bg-emerald-400" },
          { label: t(locale, "offers.rejected", "Rejected"), value: counts.rejected, color: "text-rose-400", dot: "bg-rose-400" },
        ].map((stat, i, arr) => (
          <div key={stat.label} className={`flex items-center gap-3 ${i < arr.length - 1 ? "sm:pr-8 sm:border-r sm:border-[var(--border)]" : ""}`}>
            {stat.dot && <span className={`w-2.5 h-2.5 rounded-full ${stat.dot} flex-shrink-0`} />}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{stat.label}</p>
              <p className={`text-xl font-display font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics */}
      {counts.total > 0 && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 animate-fade-in-up delay-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">{t(locale, "offers.analytics.title", "Offer Analytics")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <CheckCircle2 className="w-3 h-3" />
                {t(locale, "offers.analytics.acceptanceRate", "Acceptance rate")}
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {acceptanceRate !== null ? `${acceptanceRate}%` : "—"}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {counts.accepted} / {decidedOffers.length} {t(locale, "offers.analytics.decided", "decided")}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <Timer className="w-3 h-3" />
                {t(locale, "offers.analytics.avgTimeToSign", "Avg. time to sign")}
              </div>
              <p className="text-2xl font-bold text-[var(--accent)]">
                {avgDaysToSign !== null ? `${avgDaysToSign}${t(locale, "common.time.daysShort", "d")}` : "—"}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {t(locale, "offers.analytics.basedOn", "Based on")} {acceptedWithDates.length} {t(locale, "offers.analytics.signed", "signed")}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <RefreshCw className="w-3 h-3" />
                {t(locale, "offers.analytics.negotiationRate", "Negotiation rate")}
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {negotiationRate !== null ? `${negotiationRate}%` : "—"}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {counts.counterOffered} {t(locale, "offers.analytics.counterOffers", "counter-offers")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 animate-fade-in-up delay-100">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              id="offers-search"
              name="offers-search"
              type="text"
              placeholder={t(locale, "offers.searchPlaceholder", "Search by role or candidate...")}
              className="glass-input w-full pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
            <select
              id="offers-status-filter"
              name="offers-status-filter"
              className="glass-input pl-10 pr-8 appearance-none cursor-pointer min-w-[180px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {filterOptions.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Offers List */}
      {loading ? (
        <div className="space-y-2 animate-fade-in-up">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 flex items-center gap-4">
              <Skeleton className="w-11 h-11 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-7 w-20 rounded-xl flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl animate-fade-in-up">
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title={t(locale, "offers.empty.title", "No offers found")}
            description={t(locale, "offers.empty.subtitle", "Validate a candidate in their role pipeline to generate your first offer.")}
            action={(
              <Link
                href={ROUTES.company.recruitment.roles}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-sm font-semibold hover:bg-[var(--accent)] hover:text-white transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                {t(locale, "offers.empty.cta", "Go to job postings")}
              </Link>
            )}
          />
        </div>
      ) : (
        <div className="space-y-2 animate-fade-in-up delay-150">
          {filteredOffers.map((offer, idx) => {
            const cfg = statusConfig[offer.status] || statusConfig.DRAFT;
            const StatusIcon = cfg.icon;

            return (
              <div
                key={offer.id}
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-raised)] card-interactive animate-fade-in-up"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
                  {/* Candidate & Role */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                      <User2 className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[var(--text-primary)] font-bold text-sm truncate">
                        {offer.candidate?.full_name || t(locale, "offers.unknownCandidate", "Unknown candidate")}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate">
                        {offer.roleTitle}
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-raised)] border border-[var(--border)] text-[10px] font-bold">v{offer.currentVersion}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${offer.status === "ACCEPTED" ? "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]" : `${cfg.bg} ${cfg.color}`}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </div>

                  {/* Time */}
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{relativeTime(offer.updatedAt, locale)}</span>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {offer.status === "DRAFT" && (
                      <button
                        onClick={() => setStatusModal({ offer, newStatus: "SENT" })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-400/10 border border-sky-400/20 text-sky-400 hover:bg-sky-400/20 text-xs font-semibold transition-all"
                        title={t(locale, "offers.sendOffer", "Send offer")}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {t(locale, "offers.sendOffer", "Send")}
                      </button>
                    )}
                    {offer.status === "SENT" && (
                      <>
                        <button
                          onClick={() => setStatusModal({ offer, newStatus: "ACCEPTED" })}
                          className="p-2 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition-all"
                          title={t(locale, "offers.markAccepted", "Mark as accepted")}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setStatusModal({ offer, newStatus: "REJECTED" })}
                          className="p-2 rounded-xl bg-rose-400/10 border border-rose-400/20 text-rose-400 hover:bg-rose-400/20 transition-all"
                          title={t(locale, "offers.markRejected", "Mark as rejected")}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <Link
                      href={offerPath(offer.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] text-xs font-semibold transition-all"
                      title={t(locale, "offers.viewDetails", "View details")}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t(locale, "offers.view", "View")}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status Change Modal */}
      {statusModal && (() => {
        const cfg = statusConfig[statusModal.newStatus];
        return (
          <Modal
            open
            onClose={() => setStatusModal(null)}
            size="sm"
            title={statusModal.newStatus === "SENT" ? t(locale, "offers.sendOffer", "Send offer") : t(locale, "offers.markAs", `Mark as ${cfg.label.toLowerCase()}`, { label: cfg.label.toLowerCase() })}
            description={`${statusModal.offer.candidate?.full_name || t(locale, "offers.unknown", "Unknown")} — ${statusModal.offer.roleTitle}`}
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setStatusModal(null)} disabled={submitting}>
                  {t(locale, "common.cancel", "Cancel")}
                </Button>
                <Button variant="primary" size="sm" onClick={handleStatusChange} isLoading={submitting}>
                  {t(locale, "common.confirm", "Confirm")}
                </Button>
              </>
            }
          >
            <p className="text-[var(--text-secondary)] text-sm">
              {statusModal.newStatus === "SENT"
                ? t(locale, "offers.modal.sentDescription", "This will notify the candidate and unlock the offer portal.")
                : t(locale, "offers.modal.confirmDescription", "Are you sure you want to mark this offer as {{label}}?", { label: cfg.label.toLowerCase() })}
            </p>
          </Modal>
        );
      })()}
    </div>
  );
}
