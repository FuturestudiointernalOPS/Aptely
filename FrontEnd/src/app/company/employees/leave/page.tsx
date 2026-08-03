"use client";

import { useEffect, useState } from "react";
import { CalendarOff, CheckCircle, XCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { leavePoliciesApi, leaveRequestsApi, leaveRequestActionApi, withParams } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";

type LeaveType = "VACATION" | "SICK" | "UNPAID" | "PARENTAL" | "OTHER";
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface LeaveRequest {
    id: string;
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    days_count: number;
    reason: string | null;
    status: LeaveStatus;
    reviewed_at: string | null;
    review_note: string | null;
    created_at: string;
    employee_user_id: string;
    profiles: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface LeavePolicy {
    leave_type: LeaveType;
    days_per_year: number;
    carry_over_days: number;
}

type Tab = "requests" | "policies";

const STATUS_CONFIG: Record<LeaveStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    PENDING:   { label: "leave.request.pending",   cls: "bg-amber-400/10 text-amber-400 border-amber-400/30",   icon: <Clock size={11} /> },
    APPROVED:  { label: "leave.request.approved",  cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30", icon: <CheckCircle size={11} /> },
    REJECTED:  { label: "leave.request.rejected",  cls: "bg-red-400/10 text-red-400 border-red-400/30",         icon: <XCircle size={11} /> },
    CANCELLED: { label: "leave.request.cancelled", cls: "bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border)]", icon: null },
};

function ReviewModal({
    request,
    action,
    onConfirm,
    onCancel,
    loc,
}: {
    request: LeaveRequest;
    action: "approve" | "reject";
    onConfirm: (note: string) => Promise<void>;
    onCancel: () => void;
    loc: ReturnType<typeof getClientLocale>;
}) {
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try { await onConfirm(note); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
            <div className="relative w-full max-w-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                    {action === "approve"
                        ? t(loc, "leave.requests.approve", "Approuver")
                        : t(loc, "leave.requests.reject", "Refuser")}
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                    {request.profiles?.full_name} — {request.days_count}j {t(loc, `leave.type.${request.leave_type}`, request.leave_type)}
                </p>
                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                            {t(loc, "leave.review.note", "Note (optionnel)")}
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            {t(loc, "leave.review.cancel", "Annuler")}
                        </button>
                        <button type="submit" disabled={loading}
                            className={`px-4 py-2 rounded-lg text-sm text-white transition-opacity disabled:opacity-50 ${
                                action === "approve" ? "bg-emerald-500 hover:opacity-90" : "bg-red-500 hover:opacity-90"
                            }`}>
                            {t(loc, "leave.review.confirm", "Confirmer")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function LeavePage() {
    const loc = getClientLocale();
    const { hasPermission } = useWorkspace();
    const canManage = hasPermission("employees.manage");
    const canEdit = hasPermission("settings.edit");

    const [tab, setTab] = useState<Tab>("requests");
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [policies, setPolicies] = useState<LeavePolicy[]>([]);
    const [loadingReq, setLoadingReq] = useState(true);
    const [loadingPol, setLoadingPol] = useState(false);
    const [filterStatus, setFilterStatus] = useState<LeaveStatus | "">("");
    const [reviewModal, setReviewModal] = useState<{ req: LeaveRequest; action: "approve" | "reject" } | null>(null);
    const [policySaved, setPolicySaved] = useState(false);

    const LEAVE_TYPES: LeaveType[] = ["VACATION", "SICK", "UNPAID", "PARENTAL", "OTHER"];
    const DEFAULT_DAYS: Record<LeaveType, number> = { VACATION: 25, SICK: 10, UNPAID: 0, PARENTAL: 90, OTHER: 5 };

    const loadRequests = async () => {
        setLoadingReq(true);
        try {
            const params = filterStatus ? `status=${filterStatus}` : "";
            const res = await apiFetch(params ? withParams(leaveRequestsApi, params) : leaveRequestsApi, "HR") as { data: LeaveRequest[] } | null;
            setRequests(res?.data ?? []);
        } catch { /* silent */ }
        setLoadingReq(false);
    };

    const loadPolicies = async () => {
        setLoadingPol(true);
        try {
            const res = await apiFetch(leavePoliciesApi, "HR") as { data: LeavePolicy[] } | null;
            const loaded = res?.data ?? [];
            // Fill missing types with defaults
            const filled: LeavePolicy[] = LEAVE_TYPES.map((type) => {
                const found = loaded.find((p) => p.leave_type === type);
                return found ?? { leave_type: type, days_per_year: DEFAULT_DAYS[type], carry_over_days: 0 };
            });
            setPolicies(filled);
        } catch { /* silent */ }
        setLoadingPol(false);
    };

    useEffect(() => { void loadRequests(); }, [filterStatus]);
    useEffect(() => { if (tab === "policies") void loadPolicies(); }, [tab]);

    const handleReview = async (req: LeaveRequest, action: "approve" | "reject", note: string) => {
        await apiFetch(leaveRequestActionApi(req.id, action), "HR", {
            method: "PATCH",
            body: JSON.stringify({ review_note: note || null }),
        });
        setReviewModal(null);
        void loadRequests();
    };

    const handlePolicySave = async () => {
        await apiFetch(leavePoliciesApi, "HR", {
            method: "PATCH",
            body: JSON.stringify({ policies }),
        });
        setPolicySaved(true);
        setTimeout(() => setPolicySaved(false), 2000);
    };

    const updatePolicy = (type: LeaveType, field: "days_per_year" | "carry_over_days", val: number) => {
        setPolicies((prev) => prev.map((p) => p.leave_type === type ? { ...p, [field]: val } : p));
    };

    const pending = requests.filter((r) => r.status === "PENDING").length;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                    {t(loc, "leave.title", "Congés & Absences")}
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                    {t(loc, "leave.subtitle", "Gérez les demandes de congés de votre équipe")}
                </p>
            </div>

            {/* Stats strip */}
            <div className="flex items-center gap-6 px-5 py-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="text-center">
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{requests.length}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{t(loc, "leave.tabs.requests", "Demandes")}</p>
                </div>
                <div className="w-px h-8 bg-[var(--border)]" />
                <div className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{pending}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{t(loc, "leave.request.pending", "En attente")}</p>
                </div>
                <div className="w-px h-8 bg-[var(--border)]" />
                <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">{requests.filter((r) => r.status === "APPROVED").length}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{t(loc, "leave.request.approved", "Approuvés")}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[var(--bg-raised)] rounded-lg w-fit border border-[var(--border)]">
                {(["requests", "policies"] as Tab[]).map((tabKey) => (
                    <button key={tabKey} type="button" onClick={() => setTab(tabKey)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            tab === tabKey
                                ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}>
                        {tabKey === "requests"
                            ? t(loc, "leave.tabs.requests", "Demandes")
                            : t(loc, "leave.tabs.policies", "Politiques")}
                    </button>
                ))}
            </div>

            {/* ─── Requests tab ─────────────────────────────────────────────── */}
            {tab === "requests" && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as LeaveStatus | "")}
                            className="rounded-lg px-3 py-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-secondary)] outline-none focus:border-[var(--accent)]"
                        >
                            <option value="">— Tous —</option>
                            {(["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as LeaveStatus[]).map((s) => (
                                <option key={s} value={s}>{t(loc, `leave.request.${s.toLowerCase()}`, s)}</option>
                            ))}
                        </select>
                    </div>

                    {/* List */}
                    {loadingReq ? (
                        <div className="px-5 py-8 space-y-2">
                            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-[var(--bg-raised)] animate-pulse" />)}
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <CalendarOff className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                            <p className="text-sm font-medium text-[var(--text-secondary)]">
                                {t(loc, "leave.requests.empty", "Aucune demande")}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {t(loc, "leave.requests.emptyDesc", "Aucune demande de congé pour le moment.")}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border)]">
                            {requests.map((req) => {
                                const cfg = STATUS_CONFIG[req.status];
                                return (
                                    <div key={req.id} className="flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-raised)] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                {req.profiles?.full_name?.charAt(0).toUpperCase() ?? "?"}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                                    {req.profiles?.full_name ?? req.employee_user_id}
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                                    {t(loc, `leave.type.${req.leave_type}`, req.leave_type)}
                                                    {" · "}
                                                    {req.start_date} → {req.end_date}
                                                    {" · "}
                                                    {req.days_count}j
                                                </p>
                                                {req.reason && (
                                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-xs italic">"{req.reason}"</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.cls}`}>
                                                {cfg.icon}
                                                {t(loc, cfg.label, req.status)}
                                            </span>
                                            {canManage && req.status === "PENDING" && (
                                                <div className="flex items-center gap-1">
                                                    <button type="button"
                                                        onClick={() => setReviewModal({ req, action: "approve" })}
                                                        className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-500/20 transition-colors">
                                                        {t(loc, "leave.requests.approve", "Approuver")}
                                                    </button>
                                                    <button type="button"
                                                        onClick={() => setReviewModal({ req, action: "reject" })}
                                                        className="px-2.5 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-400/30 hover:bg-red-500/20 transition-colors">
                                                        {t(loc, "leave.requests.reject", "Refuser")}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Policies tab ─────────────────────────────────────────────── */}
            {tab === "policies" && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
                    {loadingPol ? (
                        <div className="px-5 py-8 space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 rounded-lg bg-[var(--bg-raised)] animate-pulse" />)}
                        </div>
                    ) : (
                        <>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border)]">
                                        <th className="px-5 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Type</th>
                                        <th className="px-5 py-3 text-right text-xs font-medium text-[var(--text-muted)]">
                                            {t(loc, "leave.policies.daysPerYear", "Jours / an")}
                                        </th>
                                        <th className="px-5 py-3 text-right text-xs font-medium text-[var(--text-muted)]">
                                            {t(loc, "leave.policies.carryOver", "Report")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {policies.map((p) => (
                                        <tr key={p.leave_type} className="hover:bg-[var(--bg-raised)] transition-colors">
                                            <td className="px-5 py-3 text-sm text-[var(--text-primary)] font-medium">
                                                {t(loc, `leave.type.${p.leave_type}`, p.leave_type)}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                {canEdit ? (
                                                    <input
                                                        type="number" min={0} max={365} step={0.5}
                                                        value={p.days_per_year}
                                                        onChange={(e) => updatePolicy(p.leave_type, "days_per_year", Number(e.target.value))}
                                                        className="w-20 text-right rounded-lg px-2 py-1 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                                    />
                                                ) : (
                                                    <span className="text-[var(--text-primary)]">{p.days_per_year}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                {canEdit ? (
                                                    <input
                                                        type="number" min={0} max={365} step={0.5}
                                                        value={p.carry_over_days}
                                                        onChange={(e) => updatePolicy(p.leave_type, "carry_over_days", Number(e.target.value))}
                                                        className="w-20 text-right rounded-lg px-2 py-1 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                                    />
                                                ) : (
                                                    <span className="text-[var(--text-primary)]">{p.carry_over_days}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {canEdit && (
                                <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end">
                                    <button type="button" onClick={() => void handlePolicySave()}
                                        className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
                                        {policySaved
                                            ? t(loc, "leave.policies.saved", "Enregistré ✓")
                                            : t(loc, "leave.policies.save", "Enregistrer")}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Review modal */}
            {reviewModal && (
                <ReviewModal
                    request={reviewModal.req}
                    action={reviewModal.action}
                    onConfirm={(note) => handleReview(reviewModal.req, reviewModal.action, note)}
                    onCancel={() => setReviewModal(null)}
                    loc={loc}
                />
            )}
        </div>
    );
}
