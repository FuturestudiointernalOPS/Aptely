"use client";

import { useState, useEffect } from "react";
import { getRoleById, getApplicationsByRole, finalizeSelection, sendSelectionEmails, Role, Application } from "@/lib/api";
import { useRequireInstitution } from "@/lib/auth";
import { withTimeout } from "@/lib/retryApi";
import { ArrowLeft, Send, CheckCircle2, XCircle, Mail, Edit3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, rolePath } from "@/lib/routes";
import { useToast } from "@/components/ui/Toast";


export default function FinalizeSelectionPage() {
    useRequireInstitution();
    
    const routeParams = useParams<{ id: string }>();
    const id = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
    const [role, setRole] = useState<Role | null>(null);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const router = useRouter();
    const locale = getClientLocale();
    const toast = useToast();

    const [templates, setTemplates] = useState({
        approved: t(locale, "finalize.defaultApproved", "Bonjour {{name}},\n\nNous avons le plaisir de vous informer que votre profil correspond parfaitement à nos exigences. Nous souhaitons vous inviter à un entretien technique prochainement.\n\nCordialement,\nL'équipe RH Aptely"),
        rejected: t(locale, "finalize.defaultRejected", "Bonjour {{name}},\n\nMerci pour votre intérêt pour le poste {{role}}. Après examen attentif, nous avons décidé de poursuivre avec d'autres candidats dont le profil correspond davantage à nos critères actuels.\n\nCordialement,\nL'équipe RH Aptely"),
    });

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const loadSelectionContext = async () => {
        if (!id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);

        try {
            const [roleData, appsRes] = await withTimeout(
                Promise.all([
                    getRoleById(id),
                    getApplicationsByRole(id, 1, 200)
                ]),
                10000,
                "Loading selection details timed out"
            );

            setRole(roleData);
            setApplications(appsRes.data);
        } catch (error) {
            const message = error instanceof Error ? error.message : t(locale, "finalize.errorDefault", "Unable to load selection details");
            setLoadError(message);
            setRole(null);
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }
        loadSelectionContext();
    }, [id]);

    // Auto-select all validated/rejected when applications load
    useEffect(() => {
        const selectable = applications.filter(a => a.status === 'VALIDATED' || a.status === 'REJECTED');
        setSelectedIds(new Set(selectable.map(a => a.applicationId)));
    }, [applications]);

    const toggleCandidate = (appId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(appId)) next.delete(appId);
            else next.add(appId);
            return next;
        });
    };

    const selectAll = () => {
        const selectable = applications.filter(a => a.status === 'VALIDATED' || a.status === 'REJECTED');
        setSelectedIds(new Set(selectable.map(a => a.applicationId)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleFinalize = async () => {
        const toProcess = applications.filter(a =>
            (a.status === 'VALIDATED' || a.status === 'REJECTED') && selectedIds.has(a.applicationId)
        );
        if (toProcess.length === 0) {
            toast.error(t(locale, "finalize.noCandidates", "Aucun candidat sélectionné."));
            return;
        }

        setSending(true);
        let sent = 0;
        try {
            for (const app of toProcess) {
                const finalized = await finalizeSelection(app.applicationId, {
                    approvalMessage: templates.approved,
                    rejectionMessage: templates.rejected,
                });
                if (finalized) {
                    await sendSelectionEmails(app.applicationId);
                    sent++;
                }
            }
        } catch (err) {
            console.error("Finalize error:", err);
            toast.error(t(locale, "finalize.error", "Une erreur est survenue. Réessayez."));
        }

        setSending(false);
        if (sent > 0) toast.success(t(locale, "finalize.success", "Emails envoyés à {{count}} candidat(s).", { count: String(sent) }));
    };

    if (loading) return <div className="p-20 text-center">{t(locale, "finalize.loading", "Loading selection details...")}</div>;
    if (loadError) {
        return (
            <div className="p-20 text-center space-y-4">
                <p className="text-red-400 font-semibold">{loadError}</p>
                <button
                    onClick={loadSelectionContext}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent)]-soft transition-colors"
                >
                    {t(locale, "common.retry", "Retry")}
                </button>
            </div>
        );
    }
    if (!role) return <div className="p-20 text-center">{t(locale, "finalize.roleNotFound", "Role not found.")}</div>;

    const approvedCount = applications.filter(a => a.status === 'VALIDATED').length;
    const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;
    const hasApplications = applications.length > 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <Link href={rolePath(id)} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent)] font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    {t(locale, "finalize.backToPipeline", "Back to Pipeline")}
                </Link>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, "finalize.title", "Finalize Selection")}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up delay-100">
                {/* Stats Cards */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 rounded-2xl  border border-emerald-400/20 flex flex-col items-center text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{approvedCount}</p>
                    <p className="text-xs font-bold text-[var(--text-muted)] mt-1 uppercase">{t(locale, "finalize.approved", "Approved Candidates")}</p>
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 rounded-2xl  border border-red-400/10 flex flex-col items-center text-center">
                    <XCircle className="w-8 h-8 text-red-400 mb-2" />
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{rejectedCount}</p>
                    <p className="text-xs font-bold text-[var(--text-muted)] mt-1 uppercase">{t(locale, "finalize.rejected", "Rejected Profiles")}</p>
                </div>
                <button
                    onClick={handleFinalize}
                    disabled={sending || !hasApplications}
                    className="bg-[var(--accent)] border-2 border-[var(--accent)] p-6 rounded-2xl flex flex-col items-center justify-center text-white font-bold hover:bg-orange-600 hover:border-orange-600 hover:shadow-lg shadow-[var(--accent)]/25 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {sending ? (
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2" />
                    ) : (
                        <Send className="w-8 h-8 mb-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    )}
                    <span className="text-sm font-bold">{sending ? t(locale, "finalize.sending", "Sending...") : t(locale, "finalize.finish", "Finish & Send Emails")}</span>
                </button>
            </div>

            {/* Template Editors */}
            <div className="space-y-6 animate-fade-in-up delay-200">
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8  border border-[var(--border)] space-y-6">
                    <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4">
                        <Mail className="w-5 h-5 text-[var(--accent)]" />
                        <h2 className="font-bold text-[var(--text-primary)]">{t(locale, "finalize.templates", "Communication Templates")}</h2>
                        <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded-lg">
                            <Sparkles className="w-3 h-3 fill-current" />
                            {t(locale, "finalize.aiAssisted", "AI ASSISTED")}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Approved Template */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400/100" />
                                <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, "finalize.successMsg", "Success Message")}</label>
                            </div>
                            <div className="relative">
                                <textarea
                                    rows={8}
                                    className="w-full p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:ring-1 focus:ring-[var(--accent)]/30 transition-all resize-none"
                                    value={templates.approved}
                                    onChange={(e) => setTemplates({ ...templates, approved: e.target.value })}
                                />
                                <span className="absolute bottom-4 right-4 text-[var(--text-muted)]" aria-hidden="true">
                                    <Edit3 className="w-4 h-4" />
                                </span>
                            </div>
                        </div>

                        {/* Rejected Template */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                <label className="text-sm font-bold text-[var(--text-primary)]">{t(locale, "finalize.rejectionMsg", "Rejection Message")}</label>
                            </div>
                            <div className="relative">
                                <textarea
                                    rows={8}
                                    className="w-full p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:ring-1 focus:ring-[var(--accent)]/30 transition-all resize-none"
                                    value={templates.rejected}
                                    onChange={(e) => setTemplates({ ...templates, rejected: e.target.value })}
                                />
                                <span className="absolute bottom-4 right-4 text-[var(--text-muted)]" aria-hidden="true">
                                    <Edit3 className="w-4 h-4" />
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-blue-400/10/50 border border-blue-100 rounded-2xl flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-400/100 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ml-1">i</div>
                        <p className="text-[11px] text-blue-400 leading-relaxed font-medium">
                            {t(locale, "finalize.hint", "The tags {{name}} and {{role}} will be automatically replaced with individual candidate details before sending.")}
                        </p>
                    </div>
                </div>
            </div>

            {/* Candidate Selection List */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 space-y-4 animate-fade-in-up delay-300">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-[var(--text-primary)]">{t(locale, "finalize.selectCandidates", "Select candidates to email")}</h3>
                    <div className="flex gap-2">
                        <button onClick={selectAll} className="text-xs text-[var(--accent)] hover:underline font-semibold">
                            {t(locale, "finalize.selectAll", "Select all")}
                        </button>
                        <button onClick={deselectAll} className="text-xs text-[var(--text-muted)] hover:underline font-semibold">
                            {t(locale, "finalize.deselectAll", "Deselect all")}
                        </button>
                    </div>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {applications.filter(a => a.status === 'VALIDATED' || a.status === 'REJECTED').map(app => (
                        <label key={app.applicationId} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                            selectedIds.has(app.applicationId)
                                ? 'bg-[var(--accent-dim)] border border-[var(--accent)]/20'
                                : 'bg-[var(--bg-raised)] border border-transparent hover:border-[var(--border)]'
                        }`}>
                            <input
                                type="checkbox"
                                checked={selectedIds.has(app.applicationId)}
                                onChange={() => toggleCandidate(app.applicationId)}
                                className="w-4 h-4 rounded accent-[var(--accent)]"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{app.candidateName}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                app.status === 'VALIDATED'
                                    ? 'bg-emerald-400/10 text-emerald-400'
                                    : 'bg-red-400/10 text-red-400'
                            }`}>
                                {app.status === 'VALIDATED'
                                    ? t(locale, "finalize.statusApproved", "Approved")
                                    : t(locale, "finalize.statusRejected", "Rejected")}
                            </span>
                        </label>
                    ))}
                    {applications.filter(a => a.status === 'VALIDATED' || a.status === 'REJECTED').length === 0 && (
                        <p className="text-sm text-[var(--text-muted)] text-center py-4">
                            {t(locale, "finalize.noCandidatesToList", "Aucun candidat à lister. Validez ou rejetez d'abord des candidats dans le pipeline.")}
                        </p>
                    )}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                    {selectedIds.size} {t(locale, "finalize.selectedCount", "candidat(s) sélectionné(s)")}
                </div>
            </div>
        </div>
    );
}
