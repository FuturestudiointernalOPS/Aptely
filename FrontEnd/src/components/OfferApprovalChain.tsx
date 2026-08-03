"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  getOfferApprovalChain,
  createOfferApprovalChain,
  approveOfferStep,
  rejectOfferStep,
  type OfferApprovalStep,
} from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";

interface OfferApprovalChainProps {
  offerId: string;
  offerStatus: string;
  onChainUpdated?: () => void;
}

const ROLE_OPTIONS = ["OWNER", "HR_LEAD", "HIRING_MANAGER", "ADMIN"];

export function OfferApprovalChain({ offerId, offerStatus, onChainUpdated }: OfferApprovalChainProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [chain, setChain] = useState<OfferApprovalStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [comment, setComment] = useState<Record<number, string>>({});
  const [showComment, setShowComment] = useState<Record<number, boolean>>({});

  // Create chain form state
  const [showCreate, setShowCreate] = useState(false);
  const [draftSteps, setDraftSteps] = useState<Array<{ required_role: string }>>([
    { required_role: "HR_LEAD" },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChain = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOfferApprovalChain(offerId);
      setChain(data);
    } catch {
      setChain([]);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    void fetchChain();
  }, [fetchChain]);

  const handleDecide = async (step: number, decision: "approve" | "reject") => {
    setActing(step);
    setError(null);
    try {
      if (decision === "approve") {
        await approveOfferStep(offerId, step, comment[step]);
      } else {
        await rejectOfferStep(offerId, step, comment[step]);
      }
      await fetchChain();
      onChainUpdated?.();
      setComment((prev) => ({ ...prev, [step]: "" }));
      setShowComment((prev) => ({ ...prev, [step]: false }));
    } catch (e: any) {
      setError(e?.message || tr("approvalChain.failedAction", "Action failed"));
    } finally {
      setActing(null);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      await createOfferApprovalChain(offerId, draftSteps);
      setShowCreate(false);
      await fetchChain();
    } catch (e: any) {
      setError(e?.message || tr("approvalChain.failedCreate", "Failed to create chain"));
    } finally {
      setCreating(false);
    }
  };

  const statusIcon = (s: OfferApprovalStep["status"]) => {
    if (s === "APPROVED") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (s === "REJECTED") return <XCircle className="w-4 h-4 text-rose-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  const statusColors: Record<string, string> = {
    APPROVED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    REJECTED: "text-rose-400 bg-rose-400/10 border-rose-400/20",
    PENDING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  };

  const currentPendingStep = chain.find((s) => s.status === "PENDING");
  const allApproved = chain.length > 0 && chain.every((s) => s.status === "APPROVED");
  const anyRejected = chain.some((s) => s.status === "REJECTED");

  if (loading) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex items-center gap-2 text-[var(--text-muted)] text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {tr("approvalChain.loading", "Loading approval chain…")}
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-base font-display font-bold text-[var(--text-primary)]">
            {tr("approvalChain.title", "Approval Chain")}
            {chain.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                ({chain.filter((s) => s.status === "APPROVED").length}/{chain.length} {tr("approvalChain.approved", "approved")})
              </span>
            )}
          </h2>
          {allApproved && (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
              {tr("approvalChain.cleared", "Cleared")}
            </span>
          )}
          {anyRejected && (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold text-rose-400 bg-rose-400/10 border border-rose-400/20">
              {tr("approvalChain.blocked", "Blocked")}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" /> : <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />}
      </button>

      {!collapsed && (
        <>
          {error && (
            <p className="text-sm text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* No chain + DRAFT or SENT → show create */}
          {chain.length === 0 && (offerStatus === "DRAFT" || offerStatus === "SENT") && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">{tr("approvalChain.noChain", "No approval chain configured for this offer.")}</p>
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn-glass text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {tr("approvalChain.configureBtn", "Configure Approval Chain")}
                </button>
              ) : (
                <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{tr("approvalChain.defineSteps", "Define approval steps")}</p>
                  {draftSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)] w-8">{tr("approvalChain.step", "Step")} {i + 1}</span>
                      <select
                        value={step.required_role}
                        onChange={(e) => {
                          const updated = [...draftSteps];
                          updated[i] = { required_role: e.target.value };
                          setDraftSteps(updated);
                        }}
                        className="glass-input flex-1 text-sm"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {draftSteps.length > 1 && (
                        <button
                          onClick={() => setDraftSteps(draftSteps.filter((_, j) => j !== i))}
                          className="p-1 text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {draftSteps.length < 5 && (
                    <button
                      onClick={() => setDraftSteps([...draftSteps, { required_role: "HR_LEAD" }])}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {tr("approvalChain.addStep", "Add step")}
                    </button>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreate}
                      disabled={creating}
                      className="btn-primary text-sm flex items-center gap-2"
                    >
                      {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {tr("approvalChain.createChain", "Create Chain")}
                    </button>
                    <button
                      onClick={() => setShowCreate(false)}
                      className="btn-glass text-sm"
                    >
                      {tr("approvalChain.cancel", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chain steps */}
          {chain.length > 0 && (
            <div className="space-y-2">
              {chain.map((step) => {
                const isPending = step.status === "PENDING";
                const isCurrentStep = isPending && currentPendingStep?.step === step.step;
                const isActing = acting === step.step;

                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isCurrentStep
                        ? "border-amber-400/30 bg-amber-400/5"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {statusIcon(step.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              {tr("approvalChain.step", "Step")} {step.step}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${statusColors[step.status]}`}
                            >
                              {step.status}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">{step.required_role}</span>
                          </div>
                          {step.profiles && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {tr("approvalChain.by", "by")} {step.profiles.full_name || step.profiles.email}
                              {step.decided_at && (
                                <> · {new Date(step.decided_at).toLocaleDateString()}</>
                              )}
                            </p>
                          )}
                          {step.comment && (
                            <p className="text-xs text-[var(--text-secondary)] italic mt-1">"{step.comment}"</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons — only on current pending step */}
                      {isCurrentStep && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              setShowComment((prev) => ({ ...prev, [step.step]: !prev[step.step] }))
                            }
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                          >
                            {showComment[step.step] ? tr("approvalChain.hideComment", "Hide comment") : tr("approvalChain.addComment", "Add comment")}
                          </button>
                          <button
                            onClick={() => handleDecide(step.step, "approve")}
                            disabled={isActing}
                            className="p-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition-all disabled:opacity-50"
                            title={tr("approvalChain.approveStep", "Approve step")}
                          >
                            {isActing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDecide(step.step, "reject")}
                            disabled={isActing}
                            className="p-2 rounded-lg bg-rose-400/10 border border-rose-400/20 text-rose-400 hover:bg-rose-400/20 transition-all disabled:opacity-50"
                            title={tr("approvalChain.rejectStep", "Reject step")}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {showComment[step.step] && isCurrentStep && (
                      <div className="mt-3">
                        <input
                          type="text"
                          className="glass-input w-full text-sm"
                          placeholder={tr("approvalChain.commentPlaceholder", "Optional comment…")}
                          value={comment[step.step] || ""}
                          onChange={(e) =>
                            setComment((prev) => ({ ...prev, [step.step]: e.target.value }))
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {chain.length === 0 && offerStatus !== "DRAFT" && offerStatus !== "SENT" && (
            <p className="text-sm text-[var(--text-muted)]">{tr("approvalChain.noChainShort", "No approval chain for this offer.")}</p>
          )}
        </>
      )}
    </div>
  );
}
