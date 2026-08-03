"use client";

import { useState, useEffect, useCallback } from "react";
import { offerSignedPdfApi, offerSignPath, offerSigningChainApi, offerSigningChainSignApi, offerResolveSignersApi } from "@/lib/routes";
import { apiFetch } from "@/lib/apiHelper";
import { CheckCircle2, XCircle, Clock, PenLine, Loader2, ChevronDown, ChevronUp, FileDown } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import SignaturePad from "@/components/SignaturePad";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import { FormField, Input } from "@/components/ui/FormField";

interface SigningStep {
  id: string;
  position: number;
  signer_type: "CANDIDATE" | "HR";
  signer_role: string | null;
  signer_user_id: string | null;
  status: "PENDING" | "SIGNED" | "REJECTED";
  signed_at: string | null;
  signature_token?: string | null;
}

interface ResolvedSigner {
  id: string;
  full_name: string | null;
  email: string;
  source: "hiring_manager" | "department_manager" | "owner_fallback";
}

interface ResolvedSigners {
  department: { id: string; name: string } | null;
  manager: ResolvedSigner | null;
  signers: Array<{ signer_type: "CANDIDATE" | "HR"; signer_role?: string | null; signer_user_id?: string | null }>;
}

interface Props {
  offerId: string;
  offerStatus: string;
}

export function OfferSigningChain({ offerId, offerStatus }: Props) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [chain, setChain] = useState<SigningStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [signing, setSigning] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resolved, setResolved] = useState<ResolvedSigners | null>(null);
  // Signature modal
  const [sigModalPos, setSigModalPos] = useState<number | null>(null);
  const [sigData, setSigData] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchChain = useCallback(async () => {
    setLoading(true);
    try {
      const [chainRes, signersRes] = await Promise.all([
        apiFetch(offerSigningChainApi(offerId), "HR").catch(() => null),
        apiFetch(offerResolveSignersApi(offerId), "HR").catch(() => null),
      ]);
      setChain(Array.isArray(chainRes) ? chainRes : chainRes?.data ? chainRes.data : []);
      if (signersRes?.data) setResolved(signersRes.data as ResolvedSigners);
    } catch {
      setChain([]);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => { void fetchChain(); }, [fetchChain]);

  const departmentManagerName = resolved?.manager?.full_name ?? resolved?.manager?.email ?? null;

  const handleInitChain = async () => {
    setCreating(true);
    setError(null);
    try {
      // Organigramme: utilise les signataires résolus (hiring_manager ou department_manager ou OWNER)
      const signers = resolved?.signers ?? [
        { signer_type: "CANDIDATE" as const, signer_role: null },
        { signer_type: "HR" as const, signer_role: "OWNER" },
      ];
      await apiFetch(offerSigningChainApi(offerId), "HR", {
        method: "POST",
        body: JSON.stringify({ signers }),
      });
      await fetchChain();
    } catch (e: any) {
      setError(e?.message || tr("signing.failedCreate", "Failed to create signing chain"));
    } finally {
      setCreating(false);
    }
  };

  const handleSign = (position: number) => {
    setSigModalPos(position);
    setSigData(null);
    setSignerName("");
  };

  const handleSignConfirm = async () => {
    if (!sigData || sigModalPos === null) return;
    setSigning(sigModalPos);
    setError(null);
    setSigModalPos(null);
    try {
      await apiFetch(offerSigningChainSignApi(offerId, sigModalPos), "HR", {
        method: "POST",
        body: JSON.stringify({ signatureData: sigData, signerName: signerName.trim() || undefined }),
      });
      await fetchChain();
    } catch (e: any) {
      setError(e?.message || tr("signing.failedSign", "Failed to sign"));
    } finally {
      setSigning(null);
      setSigData(null);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      // Proxy reads httpOnly hr_access_token and adds Authorization header
      const res = await fetch(`/api/backend${offerSignedPdfApi(offerId)}`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `offre-signee-${offerId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "PDF download failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const statusIcon = (s: SigningStep["status"]) => {
    if (s === "SIGNED") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (s === "REJECTED") return <XCircle className="w-4 h-4 text-rose-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  const allSigned = chain.length > 0 && chain.every((s) => s.status === "SIGNED");
  const currentStep = chain.find((s) => s.status === "PENDING");

  const isTerminal = ["ACCEPTED", "REJECTED", "EXPIRED"].includes(offerStatus.toUpperCase());

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <PenLine className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-base font-display font-bold text-[var(--text-primary)]">
            {tr("signing.title", "Offer signature")}
            {chain.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                ({chain.filter((s) => s.status === "SIGNED").length}/{chain.length} {tr("signing.signed", "signed")})
              </span>
            )}
          </h2>
          {allSigned && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                {tr("signing.complete", "Signé ✓")}
              </span>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                {tr("signing.downloadPdf", "PDF signé")}
              </button>
            </div>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" /> : <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />}
      </button>

      {!collapsed && (
        <>
          {error && (
            <p className="text-sm text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm"><Loader2 className="w-4 h-4 animate-spin" />{tr("signing.loading", "Loading…")}</div>
          ) : chain.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">{tr("signing.noChain", "No signing chain configured for this offer.")}</p>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-3 text-xs text-[var(--text-secondary)] space-y-1">
                <p className="font-semibold text-[var(--text-primary)]">{tr("signing.autoSigners", "Signataires (organigramme) :")}</p>
                <p>1. {tr("signing.signer.CANDIDATE", "Candidat")}</p>
                <p>2. {departmentManagerName ?? tr("signing.ownerFallback", "Responsable de l'entreprise")}</p>
              </div>
              {!isTerminal && (
                <button onClick={handleInitChain} disabled={creating} className="btn-primary text-sm flex items-center gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                  {tr("signing.createChain", "Initialiser la chaîne de signature")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {chain.map((step) => {
                const isCurrent = step.status === "PENDING" && currentStep?.position === step.position;
                const canSign = isCurrent && step.signer_type === "HR";
                const isSigning = signing === step.position;

                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-4 ${isCurrent ? "border-amber-400/30 bg-amber-400/5" : "border-[var(--border)]"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {statusIcon(step.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--text-primary)]">{tr("signing.step", "Step")} {step.position}</span>
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${
                              step.status === "SIGNED" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                              : step.status === "REJECTED" ? "text-rose-400 bg-rose-400/10 border-rose-400/20"
                              : "text-amber-400 bg-amber-400/10 border-amber-400/20"
                            }`}>{step.status}</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {step.signer_type === "CANDIDATE" ? tr("signing.signer.CANDIDATE", "Candidate") : (step.signer_role ? tr(`signing.role.${step.signer_role}`, step.signer_role) : tr("signing.signer.HR", "HR"))}
                            </span>
                          </div>
                          {step.signed_at && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {tr("signing.signedOn", "Signed on")} {new Date(step.signed_at).toLocaleDateString()}
                            </p>
                          )}
                          {step.signer_type === "CANDIDATE" && step.status === "PENDING" && step.signature_token && (
                            <p className="text-xs text-[var(--accent)] mt-1 font-medium">
                              {tr("signing.candidateLink", "Candidate link:")} {offerSignPath(step.signature_token?.slice(0, 16) ?? "") + "…"}
                            </p>
                          )}
                        </div>
                      </div>
                      {canSign && !isTerminal && (
                        <button
                          onClick={() => handleSign(step.position)}
                          disabled={isSigning}
                          className="px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {isSigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                          {tr("signing.signBtn", "Sign")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── HR Signature Modal ── */}
      <Modal
        open={sigModalPos !== null}
        onClose={() => setSigModalPos(null)}
        size="sm"
        title={tr("signing.signModal.title", "Signer l'offre (étape HR)")}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSigModalPos(null)}>
              {tr("common.cancel", "Annuler")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSignConfirm}
              disabled={!sigData}
              iconLeft={<PenLine className="w-4 h-4" />}
            >
              {tr("signing.signModal.confirm", "Confirmer la signature")}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <FormField label={tr("signing.signModal.yourName", "Votre nom")}>
            <Input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder={tr("signing.namePlaceholder", "Full name")}
            />
          </FormField>

          <SignaturePad
            label={tr("signing.signModal.signHere", "Votre signature")}
            onSigned={setSigData}
            onClear={() => setSigData(null)}
          />
        </div>
      </Modal>
    </div>
  );
}
