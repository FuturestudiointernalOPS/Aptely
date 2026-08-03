"use client";

import { useEffect, useState, use } from "react";
import {
  getOfferById,
  getOfferVersions,
  updateOffer,
  updateOfferStatus,
  generateOfferPdf,
  acceptOffer,
  rejectOffer,
  type OfferDetail,
  type OfferVersion,
  type OfferStatus,
} from "@/lib/api";
import {
  FileText,
  ArrowLeft,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  History,
  Edit3,
  Save,
  DollarSign,
  Calendar,
  Gift,
  StickyNote,
  Briefcase,
  User2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Video,
} from "lucide-react";
import Link from "next/link";
import { getClientLocale, t } from "@/lib/i18n";
import { OfferCounterNegotiation } from "@/components/OfferCounterNegotiation";
import { OfferApprovalChain } from "@/components/OfferApprovalChain";
import { OfferSigningChain } from "@/components/OfferSigningChain";
import { ROUTES } from "@/lib/routes";
import Modal from "@/components/ui/Modal";
import dynamic from "next/dynamic";

const VideoPlayer = dynamic(
  () => import("@/components/ui/VideoPlayer").then((m) => ({ default: m.VideoPlayer })),
  { ssr: false, loading: () => <div className="aspect-video rounded-2xl bg-[var(--bg-raised)] animate-pulse" /> }
);


function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const locale = getClientLocale();
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  
  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: t(locale, "offers.status.draft", "Draft"), color: "text-slate-400", bg: "bg-slate-400/10 border-slate-400/20" },
    SENT: { label: t(locale, "offers.status.sent", "Sent"), color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
    ACCEPTED: { label: t(locale, "offers.status.accepted", "Accepted"), color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    REJECTED: { label: t(locale, "offers.status.declined", "Declined"), color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20" },
    EXPIRED: { label: t(locale, "offers.status.expired", "Expired"), color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
    COUNTER_OFFERED: { label: t(locale, "offers.status.counterOffered", "Counter-offer"), color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  };
  const [versions, setVersions] = useState<OfferVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  const [form, setForm] = useState({
    position: "",
    compensation: "",
    startDate: "",
    benefits: "",
    notes: "",
    salaryBandMin: "",
    salaryBandMax: "",
  });

  const fetchOffer = async () => {
    setLoading(true);
    try {
      const [offerData, versionData] = await Promise.all([
        getOfferById(id),
        getOfferVersions(id),
      ]);
      setOffer(offerData);
      setVersions(versionData);
      if (offerData?.latestPayload) {
        setForm({
          position: offerData.latestPayload.position || "",
          compensation: offerData.latestPayload.compensation || "",
          startDate: offerData.latestPayload.startDate || "",
          benefits: offerData.latestPayload.benefits || "",
          notes: offerData.latestPayload.notes || "",
          salaryBandMin: (offerData.latestPayload as Record<string, unknown>)?.salaryBandMin as string || "",
          salaryBandMax: (offerData.latestPayload as Record<string, unknown>)?.salaryBandMax as string || "",
        });
      }
    } catch (e) {
      console.error("[OfferDetail] Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffer();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOffer(id, form, changeReason || undefined);
      setEditing(false);
      setChangeReason("");
      await fetchOffer();
    } catch (e) {
      console.error("[OfferDetail] Save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: OfferStatus) => {
    setSaving(true);
    try {
      await updateOfferStatus(id, status);
      await fetchOffer();
    } catch (e) {
      console.error("[OfferDetail] Status error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const generated = await generateOfferPdf(id);
      setPortalUrl(generated?.portalUrl || "");
      setDownloadUrl(generated?.downloadUrl || "");
    } catch (e) {
      console.error("[OfferDetail] Generate PDF error:", e);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleAccept = async () => {
    setSaving(true);
    try {
      const ok = await acceptOffer(id);
      if (!ok) {
        await updateOfferStatus(id, "ACCEPTED");
      }
      await fetchOffer();
    } catch (e) {
      console.error("[OfferDetail] Accept error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      const ok = await rejectOffer(id);
      if (!ok) {
        await updateOfferStatus(id, "REJECTED");
      }
      await fetchOffer();
    } catch (e) {
      console.error("[OfferDetail] Reject error:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
        <p className="text-[var(--text-muted)] text-sm">{t(locale, "offers.detail.loading", "Loading offer details...")}</p>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-32 gap-3">
        <FileText className="w-10 h-10 text-[var(--text-muted)]" />
        <p className="text-[var(--text-primary)] font-display font-bold text-lg">{t(locale, "offers.detail.notFound", "Offer not found")}</p>
        <Link href={ROUTES.company.recruitment.offers} className="text-[var(--accent)] text-sm hover:underline">← {t(locale, "offers.detail.back", "Back to Offers")}</Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[offer.status] || STATUS_CONFIG.DRAFT;

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-10">
      {/* Breadcrumb */}
      <Link href={ROUTES.company.recruitment.offers} className="inline-flex items-center gap-2 text-[var(--text-muted)] text-sm hover:text-[var(--accent)] transition-colors animate-fade-in-up">
        <ArrowLeft className="w-4 h-4" />
        {t(locale, "offers.detail.back", "Back to Offers")}
      </Link>

      {/* Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 animate-fade-in-up delay-75">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center">
              <FileText className="w-7 h-7 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">{offer.roleTitle}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <User2 className="w-3 h-3" />
                  {offer.candidate?.full_name || t(locale, "offers.unknown", "Unknown")}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-[var(--text-muted)]">v{offer.currentVersion}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowVideoPreview(true)}
              className="btn-glass flex items-center gap-2 text-sm"
            >
              <Video className="w-4 h-4" />
              {t(locale, "offers.detail.previewVideo", "Preview video")}
            </button>
            {offer.status === "DRAFT" && (
              <>
                <button
                  onClick={() => setEditing(!editing)}
                  className="btn-glass flex items-center gap-2 text-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  {editing ? t(locale, "offers.detail.cancelEdit", "Cancel Edit") : t(locale, "offers.detail.edit", "Edit")}
                </button>
                <button
                  onClick={() => handleStatusChange("SENT")}
                  className="btn-primary flex items-center gap-2 text-sm"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t(locale, "offers.detail.send", "Send Offer")}
                </button>
              </>
            )}
            {offer.status === "SENT" && (
              <>
                <button
                  onClick={handleAccept}
                  className="p-2.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition-all"
                  disabled={saving}
                  title={t(locale, "offers.detail.markAccepted", "Mark Accepted")}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleReject}
                  className="p-2.5 rounded-lg bg-rose-400/10 border border-rose-400/20 text-rose-400 hover:bg-rose-400/20 transition-all"
                  disabled={saving}
                  title={t(locale, "offers.detail.markDeclined", "Mark Declined")}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Counter-Offer Negotiation (Phase F) */}
      {(offer.status === "SENT" || offer.status === "COUNTER_OFFERED") && (
        <div className="animate-fade-in-up delay-80">
          <OfferCounterNegotiation
            offerId={id}
            currentTerms={offer.latestPayload || {}}
            status={offer.status}
            userRole="HR"
            onCounterSubmitted={fetchOffer}
          />
        </div>
      )}

      {/* Approval Chain — visible on DRAFT (create/manage), SENT and COUNTER_OFFERED (audit trail) */}
      {(offer.status === "DRAFT" || offer.status === "SENT" || offer.status === "COUNTER_OFFERED") && (
        <div className="animate-fade-in-up delay-85">
          <OfferApprovalChain
            offerId={id}
            offerStatus={offer.status}
            onChainUpdated={fetchOffer}
          />
        </div>
      )}

      {/* Signing Chain — visible once offer is SENT or ACCEPTED */}
      {(offer.status === "SENT" || offer.status === "ACCEPTED" || offer.status === "COUNTER_OFFERED") && (
        <div className="animate-fade-in-up delay-87">
          <OfferSigningChain
            offerId={id}
            offerStatus={offer.status}
          />
        </div>
      )}

      {/* Portal & PDF */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 animate-fade-in-up delay-90 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-display font-bold text-[var(--text-primary)]">{t(locale, "offers.detail.portalTitle", "Offer Portal")}</h2>
          <button
            onClick={handleGeneratePdf}
            className="btn-glass text-sm flex items-center gap-2"
            disabled={generatingPdf}
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {t(locale, "offers.detail.generatePdf", "Generate PDF + Portal Link")}
          </button>
        </div>
        {portalUrl && (
          <div className="rounded-xl border border-[var(--border)] p-3 text-sm space-y-2">
            <p className="text-[var(--text-muted)] break-all">{t(locale, "offers.detail.portalUrl", "Portal URL: {{url}}", { url: portalUrl })}</p>
            {downloadUrl && <p className="text-[var(--text-muted)] break-all">{t(locale, "offers.detail.downloadUrl", "Download URL: {{url}}", { url: downloadUrl })}</p>}
          </div>
        )}
      </div>

      {/* Offer Content */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 animate-fade-in-up delay-100">
        <h2 className="text-base font-display font-bold text-[var(--text-primary)] mb-5">{t(locale, "offers.detail.termsTitle", "Offer Terms")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: t(locale, "offers.detail.position", "Position"), key: "position" as const, icon: Briefcase },
            { label: t(locale, "offers.detail.compensation", "Compensation"), key: "compensation" as const, icon: DollarSign },
            { label: t(locale, "offers.detail.startDate", "Start Date"), key: "startDate" as const, icon: Calendar },
            { label: t(locale, "offers.detail.benefits", "Benefits"), key: "benefits" as const, icon: Gift },
          ].map(({ label, key, icon: Icon }) => (
            <div key={key} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
              </div>
              {editing ? (
                <input
                  type={key === "startDate" ? "date" : "text"}
                  className="glass-input w-full mt-1"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <p className="text-[var(--text-primary)] text-sm font-medium">{form[key] || "—"}</p>
              )}
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "offers.detail.notes", "Notes")}</span>
          </div>
          {editing ? (
            <textarea
              className="glass-input w-full h-24 resize-none mt-1"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          ) : (
            <p className="text-[var(--text-primary)] text-sm font-medium whitespace-pre-wrap">{form.notes || "—"}</p>
          )}
        </div>

        {/* Salary Band */}
        <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "offers.detail.salaryBand", "Salary Band (optional)")}</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mb-3">{t(locale, "offers.detail.salaryBandDesc", "Set min/max limits — you'll be alerted if a counter-offer exceeds these bounds.")}</p>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{t(locale, "offers.detail.salaryBandMin", "Min")}</label>
                <input type="text" className="glass-input w-full mt-1" value={form.salaryBandMin} onChange={(e) => setForm({ ...form, salaryBandMin: e.target.value })} placeholder={t(locale, "offers.detail.salaryExampleMin", "ex: 80 000 EUR / 90,000 USD")} />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{t(locale, "offers.detail.salaryBandMax", "Max")}</label>
                <input type="text" className="glass-input w-full mt-1" value={form.salaryBandMax} onChange={(e) => setForm({ ...form, salaryBandMax: e.target.value })} placeholder={t(locale, "offers.detail.salaryExampleMax", "ex: 100 000 EUR / 110,000 USD")} />
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-primary)] text-sm font-medium">
              {form.salaryBandMin || form.salaryBandMax
                ? `${form.salaryBandMin || "—"} → ${form.salaryBandMax || "—"}`
                : <span className="text-[var(--text-muted)]">—</span>}
            </p>
          )}
        </div>

        {/* Save Bar */}
        {editing && (
          <div className="mt-4 bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t(locale, "offers.detail.changeReason", "Change Reason")}</label>
            <input
              type="text"
              className="glass-input w-full"
              placeholder={t(locale, "offers.detail.changeReasonPlaceholder", "Why are you editing this offer?")}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
          </div>
            <button
              onClick={handleSave}
              className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap"
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t(locale, "offers.detail.saveVersion", "Save New Version")}
            </button>
          </div>
        )}
      </div>

      {/* Version History */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 animate-fade-in-up delay-150">
        <button
          onClick={() => setShowVersions(!showVersions)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-display font-bold text-[var(--text-primary)]">
              {t(locale, "offers.detail.historyTitle", "Version History ({{count}})", { count: versions.length })}
            </h2>
          </div>
          {showVersions ? (
            <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
          )}
        </button>

        {showVersions && (
          <div className="mt-4 space-y-3">
            {versions.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm">{t(locale, "offers.detail.noHistory", "No versions recorded yet.")}</p>
            ) : (
              versions.map((v, idx) => (
                <div key={v.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-bold">
                        v{v.version_no}
                      </span>
                      {idx === 0 && (
                        <span className="text-xs text-emerald-400 font-bold">{t(locale, "offers.detail.latest", "Latest")}</span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(v.created_at, locale)}</span>
                  </div>
                  {v.change_reason && (
                    <p className="text-[var(--text-secondary)] text-xs italic mb-2">"{v.change_reason === "Initial offer creation" ? t(locale, "offers.version.initialCreation", "Initial offer creation") : v.change_reason}"</p>
                  )}
                  <pre className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface)] rounded-lg p-3 overflow-auto max-h-32">
                    {JSON.stringify(v.payload_json, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>

      <Modal
        open={showVideoPreview}
        onClose={() => setShowVideoPreview(false)}
        title={t(locale, "offers.detail.videoPreviewTitle", "Video preview — Animated offer")}
        size="lg"
      >
        <VideoPlayer
          inputProps={{
            candidateName: offer.candidate?.full_name || t(locale, "offers.unknown", "Candidate"),
            jobTitle: offer.roleTitle || "",
            company: "",
            salary: form.compensation || undefined,
            startDate: form.startDate || undefined,
          }}
        />
      </Modal>
    </>
  );
}
