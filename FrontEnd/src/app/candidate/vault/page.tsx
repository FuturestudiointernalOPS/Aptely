"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Link2,
  FileUp,
  Trash2,
  Plus,
  Send,
  Star,
  Paperclip,
  X,
  Copy,
  Check,
  UserCheck,
  Award,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { EvidenceLog, WorkEvidenceItem } from "@/components/Vault/EvidenceLog";
import {
  ROUTES,
  endorsePath,
  absoluteUrl,
  createAuthRedirect,
  vaultProofApi,
  vaultEvidenceApi,
  vaultReferenceApi,
  vaultMyProofsApi,
  vaultMyEvidenceApi,
  vaultMyEndorsementApi,
  vaultMyEndorsementsApi,
  vaultMyReferencesApi,
  vaultMyProofsUploadApi,
  vaultMyEndorsementsRequestApi,
} from "@/lib/routes";

type ProofType = "FILE" | "LINK";

interface SkillProof {
  id: string;
  skill_name: string;
  proof_type: ProofType;
  file_url?: string;
  link_url?: string;
  title: string;
  description?: string;
  created_at: string;
}

interface VaultReference {
  id: string;
  name: string;
  email?: string;
  company?: string;
  relationship?: string;
  notes?: string;
  created_at: string;
}

interface Endorsement {
  id: string;
  endorser_email: string;
  endorser_name?: string;
  dimension: string;
  rating?: number;
  comment?: string;
  status: "PENDING" | "SUBMITTED" | "EXPIRED";
  token?: string;
  expires_at?: string;
  requested_at: string;
}

const STATUS_CFG: Record<string, { labelKey: string; cls: string }> = {
  PENDING: {
    labelKey: "individual.vault.endorsement.pending",
    cls: "bg-amber-400/10 text-amber-400",
  },
  SUBMITTED: {
    labelKey: "individual.vault.endorsement.received",
    cls: "bg-emerald-400/10 text-emerald-400",
  },
  EXPIRED: {
    labelKey: "individual.vault.endorsement.expired",
    cls: "bg-[var(--bg-raised)] text-[var(--text-muted)]",
  },
};

const ACCEPTED_TYPES = ".pdf,image/jpeg,image/png,image/gif,image/webp";

export default function VaultPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [proofs, setProofs] = useState<SkillProof[]>([]);
  const [evidence, setEvidence] = useState<WorkEvidenceItem[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [references, setReferences] = useState<VaultReference[]>([]);
  const [fetching, setFetching] = useState(true);
  // Reference form
  const [refFormOpen, setRefFormOpen] = useState(false);
  const [refName, setRefName] = useState("");
  const [refEmail, setRefEmail] = useState("");
  const [refCompany, setRefCompany] = useState("");
  const [refRelationship, setRefRelationship] = useState("");
  const [addingRef, setAddingRef] = useState(false);

  // Proof form
  const [proofType, setProofType] = useState<ProofType>("LINK");
  const [proofSkill, setProofSkill] = useState("");
  const [proofTitle, setProofTitle] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofDesc, setProofDesc] = useState("");
  const [addingProof, setAddingProof] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [proofFormOpen, setProofFormOpen] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  // Endorsement form
  const [endEmail, setEndEmail] = useState("");
  const [endName, setEndName] = useState("");
  const [endDimension, setEndDimension] = useState("");
  const [sendingEnd, setSendingEnd] = useState(false);
  const [endFormOpen, setEndFormOpen] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(createAuthRedirect(ROUTES.candidate.vault));
      return;
    }
    if (!isPersonal) {
      router.replace(ROUTES.company.dashboard);
      return;
    }

    const load = async () => {
      setFetching(true);
      const [p, e, en, refs] = await Promise.all([
        apiFetch(vaultMyProofsApi, "HR", { method: "GET", cache: "no-store" }),
        apiFetch(vaultMyEvidenceApi, "HR", {
          method: "GET",
          cache: "no-store",
        }),
        apiFetch(vaultMyEndorsementsApi, "HR", {
          method: "GET",
          cache: "no-store",
        }),
        apiFetch(vaultMyReferencesApi, "HR", {
          method: "GET",
          cache: "no-store",
        }),
      ]);
      setProofs(Array.isArray(p) ? p : []);
      setEvidence(Array.isArray(e) ? e : []);
      setEndorsements(Array.isArray(en) ? en : []);
      setReferences(Array.isArray(refs) ? refs : []);
      setFetching(false);
    };
    load();
  }, [loading, router, user, isPersonal]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setProofFile(f);
  };

  const handleAddProof = async () => {
    if (!proofSkill || !proofTitle) return;
    if (proofType === "LINK" && !proofUrl) return;
    if (proofType === "FILE" && !proofFile) return;

    setAddingProof(true);
    setProofError(null);

    let fileUrl: string | undefined;

    if (proofType === "FILE" && proofFile) {
      setUploadingFile(true);
      const fd = new FormData();
      fd.append("file", proofFile);
      const uploadRes = await apiFetch(vaultMyProofsUploadApi, "HR", {
        method: "POST",
        body: fd,
      });
      setUploadingFile(false);

      if (!uploadRes?.url) {
        setProofError(
          t(
            locale,
            "individual.vault.uploadFailed",
            "Upload failed. Check your profile is saved and try again.",
          ),
        );
        setAddingProof(false);
        return;
      }
      fileUrl = uploadRes.url as string;
    }

    const body =
      proofType === "LINK"
        ? {
            proof_type: "LINK",
            skill_name: proofSkill,
            title: proofTitle,
            description: proofDesc || undefined,
            link_url: proofUrl,
          }
        : {
            proof_type: "FILE",
            skill_name: proofSkill,
            title: proofTitle,
            description: proofDesc || undefined,
            file_url: fileUrl,
          };

    const res = await apiFetch(vaultMyProofsApi, "HR", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res?.id) {
      setProofs((prev) => [res as SkillProof, ...prev]);
      setProofSkill("");
      setProofTitle("");
      setProofUrl("");
      setProofFile(null);
      setProofDesc("");
      setProofError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setProofFormOpen(false);
    } else {
      setProofError(
        t(
          locale,
          "individual.vault.saveFailed",
          "Failed to save proof. Please try again.",
        ),
      );
    }
    setAddingProof(false);
  };

  const handleDeleteProof = async (id: string) => {
    const res = await apiFetch(vaultProofApi(id), "HR", { method: "DELETE" });
    if (res !== null) setProofs((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDeleteEvidence = async (id: string) => {
    const res = await apiFetch(vaultEvidenceApi(id), "HR", { method: "DELETE" });
    if (res !== null) setEvidence((prev) => prev.filter((e) => e.id !== id));
  };

  const handleRequestEndorsement = async () => {
    if (!endEmail || !endDimension) return;
    setSendingEnd(true);
    const res = await apiFetch(vaultMyEndorsementsRequestApi, "HR", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endorser_email: endEmail,
        endorser_name: endName || undefined,
        dimension: endDimension,
      }),
    });
    if (res?.id) {
      const token = (res.token as string) || "";
      setEndorsements((prev) => [
        {
          id: res.id as string,
          endorser_email: res.endorser_email as string,
          endorser_name: endName || undefined,
          dimension: res.dimension as string,
          token,
          status: "PENDING",
          requested_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setEndEmail("");
      setEndName("");
      setEndDimension("");
      setEndFormOpen(false);
      if (res.emailSent === false && token) {
        const link = absoluteUrl(endorsePath(token));
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          /* */
        }
      }
    }
    setSendingEnd(false);
  };

  const handleAddReference = async () => {
    if (!refName.trim()) return;
    setAddingRef(true);
    const res = await apiFetch(vaultMyReferencesApi, "HR", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: refName,
        email: refEmail || undefined,
        company: refCompany || undefined,
        relationship: refRelationship || undefined,
      }),
    });
    if (res?.id) {
      setReferences((prev) => [res as VaultReference, ...prev]);
      setRefName("");
      setRefEmail("");
      setRefCompany("");
      setRefRelationship("");
      setRefFormOpen(false);
    }
    setAddingRef(false);
  };

  const handleDeleteReference = async (id: string) => {
    const res = await apiFetch(vaultReferenceApi(id), "HR", { method: "DELETE" });
    if (res !== null) setReferences((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSwitchType = (pt: ProofType) => {
    setProofType(pt);
    setProofError(null);
  };

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 text-sm text-[var(--text-muted)]">
          {t(locale, "individual.vault.loading", "Loading vault...")}
        </div>
      </div>
    );
  }

  const proofsBySkill = proofs.reduce<Record<string, SkillProof[]>>(
    (acc, p) => {
      if (!acc[p.skill_name]) acc[p.skill_name] = [];
      acc[p.skill_name].push(p);
      return acc;
    },
    {},
  );

  const canSubmitProof =
    proofSkill &&
    proofTitle &&
    (proofType === "LINK" ? Boolean(proofUrl) : Boolean(proofFile));

  return (
    <div className="py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--accent)]" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.vault.sectionLabel",
                  "Verification Vault",
                )}
              </p>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mt-1">
              {t(locale, "individual.vault.title", "My proofs & endorsements")}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {t(
                locale,
                "individual.vault.subtitle",
                "Back up your skills with tangible evidence and third-party validation.",
              )}
            </p>
          </div>
        </div>

        {/* Skill Proofs */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              {t(locale, "individual.vault.skillProofs", "Skill Proofs")}
            </h2>
            <button
              type="button"
              onClick={() => setProofFormOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-80"
            >
              <Plus className="w-3.5 h-3.5" />{" "}
              {t(locale, "individual.vault.addProof", "Add proof")}
            </button>
          </div>

          {proofFormOpen && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 space-y-3">
              {/* Type toggle */}
              <div className="flex gap-2">
                {(["LINK", "FILE"] as ProofType[]).map((proofTypeOption) => (
                  <button
                    key={proofTypeOption}
                    type="button"
                    onClick={() => handleSwitchType(proofTypeOption)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                      proofType === proofTypeOption
                        ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {proofTypeOption === "LINK" ? (
                      <Link2 className="w-3.5 h-3.5" />
                    ) : (
                      <FileUp className="w-3.5 h-3.5" />
                    )}
                    {proofTypeOption === "LINK"
                      ? t(locale, "individual.vault.urlLink", "URL link")
                      : t(locale, "individual.vault.uploadFile", "Upload file")}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder={t(
                    locale,
                    "individual.vault.skillNamePlaceholder",
                    "Skill name (e.g. TypeScript)",
                  )}
                  value={proofSkill}
                  onChange={(e) => setProofSkill(e.target.value)}
                />
                <input
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder={t(
                    locale,
                    "individual.vault.titlePlaceholder",
                    "Title (e.g. Open-source repo)",
                  )}
                  value={proofTitle}
                  onChange={(e) => setProofTitle(e.target.value)}
                />

                {proofType === "LINK" ? (
                  <input
                    className="sm:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={t(
                      locale,
                      "individual.vault.urlPlaceholder",
                      "URL (https://github.com/...)",
                    )}
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                  />
                ) : (
                  <div className="sm:col-span-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_TYPES}
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {proofFile ? (
                      <div className="flex items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-3 py-2">
                        <Paperclip className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                        <span className="text-xs text-[var(--text-primary)] truncate flex-1">
                          {proofFile.name}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                          {(proofFile.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setProofFile(null);
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className="flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-deep)] px-3 py-4 text-center hover:border-[var(--accent)]/50 transition-colors"
                      >
                        <FileUp className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
                        <p className="text-xs text-[var(--text-secondary)]">
                          {t(
                            locale,
                            "individual.vault.clickToSelect",
                            "Click to select a file",
                          )}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {t(
                            locale,
                            "individual.vault.fileTypes",
                            "PDF, JPEG, PNG, GIF, WebP — max 10 MB",
                          )}
                        </p>
                      </button>
                    )}
                  </div>
                )}

                <input
                  className="sm:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder={t(
                    locale,
                    "individual.vault.descPlaceholder",
                    "Short description (optional)",
                  )}
                  value={proofDesc}
                  onChange={(e) => setProofDesc(e.target.value)}
                />
              </div>

              {proofError && (
                <p className="text-xs text-red-400 font-medium">{proofError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddProof}
                  disabled={addingProof || !canSubmitProof}
                  className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {uploadingFile
                    ? t(locale, "individual.vault.uploading", "Uploading...")
                    : addingProof
                      ? t(locale, "individual.vault.saving", "Saving...")
                      : t(locale, "individual.vault.addProofBtn", "Add proof")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProofFormOpen(false);
                    setProofFile(null);
                    setProofError(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)]/50"
                >
                  {t(locale, "individual.vault.cancel", "Cancel")}
                </button>
              </div>
            </div>
          )}

          {Object.keys(proofsBySkill).length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 md:p-8 text-center flex flex-col items-center gap-3">
              <Shield className="w-10 h-10 text-[var(--text-muted)]/30" />
              <div>
                <p className="text-sm font-bold text-[var(--text-secondary)]">
                  {t(
                    locale,
                    "individual.vault.noProofs.title",
                    "No proofs yet",
                  )}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[45ch] mx-auto">
                  {t(
                    locale,
                    "individual.vault.noProofs.desc",
                    "Add a GitHub link, portfolio URL or certification file to back up your skills.",
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(proofsBySkill).map(([skill, items]) => (
                <div key={skill}>
                  <p className="text-xs font-bold text-[var(--accent)] mb-2">
                    {skill}
                  </p>
                  <div className="space-y-2">
                    {items.map((proof) => (
                      <div
                        key={proof.id}
                        className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {proof.proof_type === "LINK" ? (
                              <Link2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                            ) : (
                              <FileUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            )}
                            <p className="text-xs font-semibold text-[var(--text-primary)]">
                              {proof.title}
                            </p>
                          </div>
                          {proof.description && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {proof.description}
                            </p>
                          )}
                          <a
                            href={proof.link_url ?? proof.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[var(--accent)] underline break-all"
                          >
                            {proof.link_url ?? proof.file_url}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProof(proof.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Work Evidence Log */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <EvidenceLog
            items={evidence}
            onAdded={(item) => setEvidence((prev) => [item, ...prev])}
            onDeleted={handleDeleteEvidence}
          />
        </div>

        {/* Endorsements */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              {t(locale, "individual.vault.endorsements", "Endorsements")}
            </h2>
            <button
              type="button"
              onClick={() => setEndFormOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-80"
            >
              <Send className="w-3.5 h-3.5" />{" "}
              {t(locale, "individual.vault.requestEndorsement", "Request")}
            </button>
          </div>

          {endFormOpen && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder={t(
                    locale,
                    "individual.vault.endorserEmailPlaceholder",
                    "Endorser email *",
                  )}
                  type="email"
                  value={endEmail}
                  onChange={(e) => setEndEmail(e.target.value)}
                />
                <input
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder={t(
                    locale,
                    "individual.vault.endorserNamePlaceholder",
                    "Endorser name (optional)",
                  )}
                  value={endName}
                  onChange={(e) => setEndName(e.target.value)}
                />
                <input
                  className="sm:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder={t(
                    locale,
                    "individual.vault.dimensionPlaceholder",
                    "Dimension to endorse (e.g. Technical leadership, Communication) *",
                  )}
                  value={endDimension}
                  onChange={(e) => setEndDimension(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRequestEndorsement}
                  disabled={sendingEnd || !endEmail || !endDimension}
                  className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {sendingEnd
                    ? t(locale, "individual.vault.sending", "Sending...")
                    : t(locale, "individual.vault.sendRequest", "Send request")}
                </button>
                <button
                  type="button"
                  onClick={() => setEndFormOpen(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)]/50"
                >
                  {t(locale, "individual.vault.cancel", "Cancel")}
                </button>
              </div>
            </div>
          )}

          {endorsements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 md:p-8 text-center flex flex-col items-center gap-3">
              <Star className="w-10 h-10 text-[var(--text-muted)]/30" />
              <div>
                <p className="text-sm font-bold text-[var(--text-secondary)]">
                  {t(
                    locale,
                    "individual.vault.noEndorsements.title",
                    "No endorsements yet",
                  )}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[45ch] mx-auto">
                  {t(
                    locale,
                    "individual.vault.noEndorsements.desc",
                    "Ask a colleague or manager to endorse you on a specific dimension.",
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {endorsements.map((end) => {
                const cfg = STATUS_CFG[end.status] ?? STATUS_CFG.PENDING;
                const endLabel = t(locale, cfg.labelKey, end.status);
                return (
                  <div
                    key={end.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {end.dimension}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {end.endorser_name ?? end.endorser_email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {end.rating != null && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[var(--accent)]">
                            <Star className="w-3 h-3" />
                            {end.rating}/5
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${cfg.cls}`}
                        >
                          {endLabel}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              !confirm(
                                t(
                                  locale,
                                  "individual.vault.deleteConfirm",
                                  "Supprimer cette recommandation ?",
                                ),
                              )
                            )
                              return;
                            const ok = await apiFetch(
                              vaultMyEndorsementApi(end.id),
                              "HR",
                              { method: "DELETE" },
                            );
                            if (ok)
                              setEndorsements((prev) =>
                                prev.filter((e) => e.id !== end.id),
                              );
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded text-red-400 hover:bg-red-400/10 transition-colors"
                          title={t(
                            locale,
                            "individual.vault.delete",
                            "Supprimer",
                          )}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {end.comment && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 italic">
                        &ldquo;{end.comment}&rdquo;
                      </p>
                    )}
                    {end.status === "PENDING" && end.token && (
                      <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {t(
                            locale,
                            "individual.vault.emailSentHint",
                            "Email sent to endorser. Or share link directly:",
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            const link = absoluteUrl(
                              endorsePath(end.token ?? ""),
                            );
                            try {
                              await navigator.clipboard.writeText(link);
                              setCopiedTokenId(end.id);
                              setTimeout(() => setCopiedTokenId(null), 2000);
                            } catch {
                              window.prompt("Copy link:", link);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                        >
                          {copiedTokenId === end.id ? (
                            <>
                              <Check className="w-3 h-3" />{" "}
                              {t(locale, "individual.vault.copied", "Copied")}
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />{" "}
                              {t(
                                locale,
                                "individual.vault.copyLink",
                                "Copy link",
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assessment Badges */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              {t(locale, "individual.vault.skillBadges", "Skill Badges")}
            </h2>
          </div>
          {proofs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 text-center flex flex-col items-center gap-2">
              <Award className="w-8 h-8 text-[var(--text-muted)]/30" />
              <p className="text-xs text-[var(--text-muted)]">
                {t(
                  locale,
                  "individual.vault.noBadges",
                  "Add skill proofs above to earn badges.",
                )}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(proofsBySkill).map(([skill, skillProofs]) => {
                const fileProofs = skillProofs.filter(
                  (p) => p.proof_type === "FILE",
                );
                const tierKey =
                  fileProofs.length >= 1
                    ? "individual.vault.badgeTier.expert"
                    : skillProofs.length >= 2
                      ? "individual.vault.badgeTier.validated"
                      : "individual.vault.badgeTier.tested";
                const tierFallback =
                  fileProofs.length >= 1
                    ? "Expert"
                    : skillProofs.length >= 2
                      ? "Validated"
                      : "Tested";
                const tier = t(locale, tierKey, tierFallback);
                const tierCls =
                  tier === "Expert"
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30"
                    : tier === "Validated"
                      ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
                      : "bg-blue-400/10 text-blue-400 border-blue-400/30";
                return (
                  <div
                    key={skill}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${tierCls}`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>{skill}</span>
                    <span className="opacity-60">·</span>
                    <span>{tier}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-[var(--text-muted)]">
            {t(
              locale,
              "individual.vault.badgeTierHint",
              "Tested = 1 proof · Validated = 2+ proofs · Expert = file proof uploaded",
            )}
          </p>
        </div>

        {/* Reference Manager */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {t(locale, "individual.vault.references", "References")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setRefFormOpen((o) => !o)}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              <Plus className="w-3 h-3" />{" "}
              {t(locale, "individual.vault.addReference", "Add reference")}
            </button>
          </div>

          {refFormOpen && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 space-y-3">
              <input
                type="text"
                placeholder={t(
                  locale,
                  "individual.vault.refFullNamePlaceholder",
                  "Full name *",
                )}
                value={refName}
                onChange={(e) => setRefName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder={t(
                    locale,
                    "individual.vault.refEmailPlaceholder",
                    "Email",
                  )}
                  value={refEmail}
                  onChange={(e) => setRefEmail(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--accent)]"
                />
                <input
                  type="text"
                  placeholder={t(
                    locale,
                    "individual.vault.refCompanyPlaceholder",
                    "Company",
                  )}
                  value={refCompany}
                  onChange={(e) => setRefCompany(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <input
                type="text"
                placeholder={t(
                  locale,
                  "individual.vault.refRelationshipPlaceholder",
                  "Relationship (e.g. Former manager)",
                )}
                value={refRelationship}
                onChange={(e) => setRefRelationship(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRefFormOpen(false)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5"
                >
                  {t(locale, "individual.vault.cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleAddReference}
                  disabled={addingRef || !refName.trim()}
                  className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {addingRef
                    ? t(locale, "individual.vault.savingRef", "Saving…")
                    : t(locale, "individual.vault.saveRef", "Save")}
                </button>
              </div>
            </div>
          )}

          {references.length === 0 && !refFormOpen ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)] p-4 sm:p-6 md:p-8 text-center flex flex-col items-center gap-3">
              <UserCheck className="w-10 h-10 text-[var(--text-muted)]/30" />
              <div>
                <p className="text-sm font-bold text-[var(--text-secondary)]">
                  {t(
                    locale,
                    "individual.vault.noReferences.title",
                    "No references added yet",
                  )}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t(
                    locale,
                    "individual.vault.noReferences.desc",
                    "Add colleagues or managers who can vouch for your work.",
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {ref.name}
                    </p>
                    {(ref.company || ref.relationship) && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {[ref.relationship, ref.company]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {ref.email && (
                      <p className="text-xs text-[var(--accent)]">
                        {ref.email}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteReference(ref.id)}
                    className="text-[var(--text-muted)] hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
