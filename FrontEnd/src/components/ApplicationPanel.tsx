"use client";

import { apiFetch, isApiSuccess } from "@/lib/apiHelper";
import {
    getApplicationDocuments, type ApplicationDocument,
    getOnboardingChecklist, updateOnboardingTaskStatus, listOnboardingTemplates, instantiateOnboardingChecklist,
    verifyOnboardingDocument,
    getOnboardingDocumentSigningChain, initOnboardingDocumentSigningChain, signOnboardingDocumentStep,
    type OnboardingChecklist, type OnboardingTemplate, type OnboardingSigningStep,
    getAptelyReport, type AptelyReport,
    createOffer,
} from "@/lib/api";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import Modal from "@/components/ui/Modal";
import { getClientLocale, t } from "@/lib/i18n";
import {
    User,
    ArrowLeft, Share2, MapPin, ExternalLink, FileText,
    CheckCircle, X, StopCircle, Sparkles, Briefcase, Calendar, MessageSquare,
    AlertTriangle, ShieldCheck, Loader, Clock, ClipboardList, PlusCircle,
    CheckSquare, Square, ChevronDown, ChevronUp, Loader2, Upload, XCircle, CheckCircle2,
    DollarSign, Gift, FileSignature,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { DecisionMaker } from "@/components/DecisionMaker";
import { DecisionRatifier } from "@/components/DecisionRatifier";
import { useWorkspace } from "@/lib/workspace";
import {
    ROUTES, appInterviewPath, appCandidatePath, candidateInterviewsPath,
    applicationApiPath, appStatusApi, decisionStateApi, decisionAuditApi,
    appReportPath, appMessagesPath, offerPath,
} from "@/lib/routes";

interface AIReport {
    finalScore: number;
    matchLabel: string;
    dimensions: { label: string; score: number }[];
    insights: { type: "success" | "warning"; text: string }[];
}

interface ApplicationDetail {
    applicationId?: string;
    id?: string;
    candidateId?: string;
    candidate_id?: string;
    candidateName?: string;
    roleTitle?: string;
    submittedAt?: string | null;
    created_at?: string | null;
    status: string;
    location?: string;
    linkedin?: string;
    portfolio?: string;
    hasDocuments?: boolean;
    aiReport?: AIReport;
    roles?: { title?: string };
    dna_snapshot?: {
        talent_identity?: Record<string, unknown>;
        talent_snapshot?: Record<string, unknown>;
        talent_skills?: Array<{ skillName: string; yearsUsed: number; ownership: string; context?: string[] }>;
        talent_evidence?: Array<{ projectName: string; result: string }>;
        foundation?: Record<string, unknown>;
        candidate_id?: string;
    } | null;
    dnaSnapshot?: ApplicationDetail["dna_snapshot"];
    match_results?: {
        final_score?: number | null;
        overall_score?: number | null;
        role_fit?: number | null;
        skill_validity?: number | null;
        capability_strength?: number | null;
        environment_fit?: number | null;
        ai_explanation?: { strengths?: string[]; gaps?: string[] } | string | null;
    } | null;
}

function safeUrl(url: string | undefined): string {
    if (!url) return "";
    try {
        const p = new URL(url, "https://example.com");
        return p.protocol === "https:" || p.protocol === "http:" ? url : "";
    } catch { return ""; }
}

function safeRouteId(value: string | undefined): string {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const lowered = trimmed.toLowerCase();
    if (lowered === "unknown" || lowered === "undefined" || lowered === "null") return "";
    return trimmed;
}

function buildAIReportFromRaw(
    raw: NonNullable<ApplicationDetail["match_results"]>,
    tr: (key: string, fallback: string) => string
): AIReport | null {
    const toPercent = (v: number | null | undefined) => v != null ? Math.round(v * 100) : 0;
    const finalScore = toPercent(raw.overall_score ?? raw.final_score);
    if (finalScore === 0) return null;

    let aiExp: { strengths?: string[]; gaps?: string[] } = {};
    if (raw.ai_explanation) {
        try {
            aiExp = typeof raw.ai_explanation === "string"
                ? JSON.parse(raw.ai_explanation)
                : raw.ai_explanation;
        } catch { aiExp = {}; }
    }

    const matchLabel =
        finalScore >= 85 ? tr("application.report.label.excellent", "Excellent Match") :
        finalScore >= 70 ? tr("application.report.label.optimal", "Fit Optimal") :
        finalScore >= 55 ? tr("application.report.label.correct", "Fit Correct") :
        finalScore >= 40 ? tr("application.report.label.limited", "Fit Limité") :
        tr("application.report.label.weak", "Faible Correspondance");

    return {
        finalScore,
        matchLabel,
        dimensions: [
            { label: tr("application.report.vector.roleAlignment", "Alignement au poste"), score: toPercent(raw.role_fit) },
            { label: tr("application.report.vector.skillValidity", "Validité compétences"), score: toPercent(raw.skill_validity) },
            { label: tr("application.report.vector.capabilityStrength", "Force des capacités"), score: toPercent(raw.capability_strength) },
        ],
        insights: [
            ...(aiExp.strengths ?? []).map(s => ({ type: "success" as const, text: s })),
            ...(aiExp.gaps ?? []).map(g => ({ type: "warning" as const, text: g })),
        ],
    };
}

export interface ApplicationPanelProps {
    appId: string;
    /** true = standalone page (back link in header). false = inside drawer (no back link). */
    fullPage?: boolean;
    onClose?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
}

export function ApplicationPanel({
    appId,
    fullPage = false,
    onClose,
}: ApplicationPanelProps) {
    const id = appId;
    const router = useRouter();
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const localeTag = locale === "fr" ? "fr-FR" : "en-US";
    const toast = useToast();
    const { hasPermission } = useWorkspace();
    const canManageOnboarding = hasPermission("onboarding.manage");

    const [app, setApp] = useState<ApplicationDetail | null>(null);
    const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<"denied" | "not_found" | null>(null);
    const [decisionState, setDecisionState] = useState<{
        recommendations: Array<{ id: string; recommendation: string; observations?: string }>;
        decision: { id: string; action: string; reason?: string } | null;
        ratification: { id: string; status: string } | null;
    } | null>(null);
    const [auditLogs, setAuditLogs] = useState<Array<{
        id: string;
        event_type: string;
        payload_json: Record<string, unknown>;
        actor_id: string;
        created_at: string;
    }>>([]);
    const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
    const [checklistLoading, setChecklistLoading] = useState(true);
    const [checklistExpanded, setChecklistExpanded] = useState(true);
    const [taskUpdating, setTaskUpdating] = useState<string | null>(null);
    const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [instantiating, setInstantiating] = useState(false);
    const [docVerifying, setDocVerifying] = useState<string | null>(null);
    const [docSigningChains, setDocSigningChains] = useState<Record<string, OnboardingSigningStep[]>>({});
    const [activeTab, setActiveTab] = useState<"pipeline" | "onboarding">("pipeline");
    const [signingChainLoading, setSigningChainLoading] = useState<string | null>(null);
    const [signingStep, setSigningStep] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState<"dna" | "report" | null>(null);
    const [fullReport, setFullReport] = useState<AptelyReport | null>(null);
    const [reportDrawerLoading, setReportDrawerLoading] = useState(false);
    const [acting, setActing] = useState(false);
    const [pendingAction, setPendingAction] = useState<"reject" | "stop" | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [offerModalOpen, setOfferModalOpen] = useState(false);
    const [creatingOffer, setCreatingOffer] = useState(false);
    const [offerForm, setOfferForm] = useState({ position: "", compensation: "", startDate: "", benefits: "", notes: "" });

    const fetchDecisionState = useCallback(async () => {
        const [r, logs] = await Promise.all([
            apiFetch(decisionStateApi(id), "HR"),
            apiFetch(decisionAuditApi(id), "HR"),
        ]);
        if (r) setDecisionState(r);
        if (Array.isArray(logs)) setAuditLogs(logs);
        else if (Array.isArray((logs as any)?.data)) setAuditLogs((logs as any).data);
    }, [id]);

    const fetchChecklist = useCallback(async () => {
        if (!id) return;
        setChecklistLoading(true);
        try {
            const cl = await getOnboardingChecklist(id);
            setChecklist(cl);
            // Templates require onboarding.manage — skip the call when missing (avoids 403 overlay).
            if (canManageOnboarding) {
                const tpls = await listOnboardingTemplates({ limit: 50 });
                setTemplates(tpls.data || []);
                if (tpls.data?.length > 0) setSelectedTemplateId(tpls.data[0].id);
            } else {
                setTemplates([]);
            }
        } catch { /* silent */ }
        finally { setChecklistLoading(false); }
    }, [id, canManageOnboarding]);

    useEffect(() => {
        if (!id) { setLoading(false); return; }
        setLoading(true);
        setApp(null);
        setLoadError(null);
        setDecisionState(null);
        setAuditLogs([]);
        setDocuments([]);
        setActiveTab("pipeline");
        setDrawerOpen(null);
        Promise.all([
            apiFetch(applicationApiPath(id), "HR"),
            getApplicationDocuments(id),
            apiFetch(decisionStateApi(id), "HR"),
            apiFetch(decisionAuditApi(id), "HR"),
        ]).then(([response, docs, stateResponse, logsResponse]) => {
            // apiFetch returns truthy { isPermissionError } / { isAuthError } on 403/401 —
            // never treat those as application payloads (cross-org deep-link shell bug).
            if (!isApiSuccess(response)) {
                const denied =
                    typeof response === "object" &&
                    response !== null &&
                    ("isPermissionError" in response || "isAuthError" in response);
                setLoadError(denied ? "denied" : "not_found");
                setLoading(false);
                return;
            }
            const application = (response as any)?.data ?? response;
            if (application && typeof application === "object" && (application.id || application.applicationId || application.status)) {
                if (!application.aiReport && application.match_results) {
                    const raw = Array.isArray(application.match_results)
                        ? application.match_results[0]
                        : application.match_results;
                    if (raw) {
                        const built = buildAIReportFromRaw(raw, tr);
                        if (built) application.aiReport = built;
                    }
                }
                setApp(application);
            } else {
                setLoadError("not_found");
            }
            setDocuments(Array.isArray(docs) ? docs : []);
            if (isApiSuccess(stateResponse)) setDecisionState(stateResponse as any);
            if (Array.isArray(logsResponse)) setAuditLogs(logsResponse as any);
            else if (isApiSuccess(logsResponse) && Array.isArray((logsResponse as any)?.data)) {
                setAuditLogs((logsResponse as any).data);
            }
            setLoading(false);
        });
    }, [id]);

    useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

    const handleTaskToggle = async (taskId: string, currentStatus: string) => {
        setTaskUpdating(taskId);
        const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
        try {
            await updateOnboardingTaskStatus(taskId, newStatus as "PENDING" | "COMPLETED");
            await fetchChecklist();
        } catch { /* silent */ }
        finally { setTaskUpdating(null); }
    };

    const handleVerifyDoc = async (docId: string, status: "VERIFIED" | "REJECTED") => {
        setDocVerifying(docId);
        try {
            await verifyOnboardingDocument(docId, status);
            await fetchChecklist();
        } catch { /* silent */ }
        finally { setDocVerifying(null); }
    };

    const loadSigningChain = async (docId: string) => {
        setSigningChainLoading(docId);
        try {
            const chain = await getOnboardingDocumentSigningChain(docId);
            setDocSigningChains((prev) => ({ ...prev, [docId]: chain }));
        } catch { /* silent */ }
        finally { setSigningChainLoading(null); }
    };

    const handleInitSigningChain = async (docId: string) => {
        setSigningChainLoading(docId);
        try {
            const chain = await initOnboardingDocumentSigningChain(docId, [
                { signer_role: "OWNER" },
                { signer_role: "CANDIDATE" },
            ]);
            setDocSigningChains((prev) => ({ ...prev, [docId]: chain }));
        } catch { /* silent */ }
        finally { setSigningChainLoading(null); }
    };

    const handleSignStep = async (docId: string, position: number) => {
        setSigningStep(`${docId}-${position}`);
        try {
            await signOnboardingDocumentStep(docId, position);
            await loadSigningChain(docId);
        } catch { /* silent */ }
        finally { setSigningStep(null); }
    };

    const handleInstantiateChecklist = async () => {
        if (!id || !selectedTemplateId) return;
        setInstantiating(true);
        try {
            await instantiateOnboardingChecklist(id, selectedTemplateId);
            await fetchChecklist();
        } catch { /* silent */ }
        finally { setInstantiating(false); }
    };

    const handleShare = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ url });
                toast.success(tr("application.detail.shared", "Lien partagé !"));
            } else {
                await navigator.clipboard.writeText(url);
                toast.success(tr("application.detail.linkCopied", "Lien copié !"));
            }
        } catch {
            try {
                await navigator.clipboard.writeText(url);
                toast.success(tr("application.detail.linkCopied", "Lien copié !"));
            } catch {
                toast.error(tr("application.detail.shareFailed", "Impossible de copier le lien."));
            }
        }
    };

    const openDnaDrawer = () => setDrawerOpen("dna");

    const openReportDrawer = async () => {
        setDrawerOpen("report");
        if (!fullReport) {
            setReportDrawerLoading(true);
            try {
                const data = await getAptelyReport(id as string, locale);
                if (data) setFullReport(data);
            } catch { /* silent */ }
            finally { setReportDrawerLoading(false); }
        }
    };

    const handleAction = async (action: "reject" | "stop" | "validate", reason?: string) => {
        setActing(true);
        const statusMap: Record<string, string> = { reject: "REJECTED", stop: "STOPPED", validate: "VALIDATED" };
        const body: Record<string, unknown> = { status: statusMap[action] };
        if (action === "reject" && reason?.trim()) body.rejectionReason = reason.trim();
        await apiFetch(appStatusApi(id), "HR", { method: "PATCH", body: JSON.stringify(body) });
        setActing(false);
        if (fullPage) {
            router.push(ROUTES.company.recruitment.applications);
        } else {
            onClose?.();
        }
    };

    const handleCreateOffer = async () => {
        if (!offerForm.position.trim() || !offerForm.compensation.trim() || !offerForm.startDate.trim()) {
            toast.error(tr("application.detail.offerFormRequired", "Position, compensation and start date are required."));
            return;
        }
        setCreatingOffer(true);
        const result = await createOffer(id, {
            position: offerForm.position.trim(),
            compensation: offerForm.compensation.trim(),
            startDate: offerForm.startDate.trim(),
            benefits: offerForm.benefits.trim() || undefined,
            notes: offerForm.notes.trim() || undefined,
        });
        setCreatingOffer(false);
        if (result?.offer?.id) {
            setOfferModalOpen(false);
            toast.success(tr("application.detail.offerCreated", "Offer created — redirecting…"));
            router.push(offerPath(result.offer.id));
        } else {
            toast.error(tr("application.detail.offerCreateError", "Could not create the offer (maybe one already exists for this candidate)."));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader className="w-8 h-8 text-[var(--accent)] animate-spin" />
            </div>
        );
    }

    if (!app) {
        const msg =
            loadError === "denied"
                ? tr(
                      "application.detail.accessDenied",
                      "Access denied. This application is outside your organization.",
                  )
                : tr("application.detail.notFound", "Application not found.");
        return (
            <div className="p-20 text-center space-y-4">
                <p className="text-[var(--text-muted)]">{msg}</p>
                {fullPage && (
                    <Link
                        href={ROUTES.company.recruitment.applications}
                        className="inline-flex items-center gap-2 text-[var(--accent)] font-semibold text-sm hover:underline"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {tr("application.detail.backApplications", "Applications")}
                    </Link>
                )}
            </div>
        );
    }

    const report = app.aiReport;
    const isDecisionFinalized = !!decisionState?.ratification || ["FINISHED", "REJECTED", "STOPPED", "HIRED"].includes(app.status);
    const candidateId = safeRouteId(app.candidateId || app.candidate_id);
    const candidateName = app.candidateName || tr("application.detail.unknownCandidate", "Unknown candidate");
    const roleTitle = app.roleTitle || (app.roles as { title?: string } | undefined)?.title || tr("application.detail.untitledRole", "Role to complete");
    const rawDate = app.submittedAt || app.created_at;
    const formattedDate = rawDate && !isNaN(new Date(rawDate).getTime())
        ? new Date(rawDate).toLocaleDateString(localeTag, { month: "short", day: "numeric", year: "numeric" })
        : tr("application.detail.notAvailable", "N/A");

    return (
        <div className={fullPage ? "max-w-3xl mx-auto space-y-5" : "space-y-5"}>
            {/* Header — only in fullPage mode */}
            {fullPage && (
                <div className="flex items-center justify-between animate-fade-in-up">
                    <Link href={ROUTES.company.recruitment.applications} className="flex items-center gap-2 text-[var(--accent)] font-semibold text-sm hover:underline">
                        <ArrowLeft className="w-4 h-4" /> {tr("application.detail.backApplications", "Applications")}
                    </Link>
                    <div className="flex items-center gap-2">
                        <h1 className="text-[var(--text-primary)] font-bold text-lg">{tr("application.detail.title", "Application detail")}</h1>
                        <button
                            onClick={handleShare}
                            className="w-8 h-8 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center transition-colors hover:border-[var(--accent)]"
                        >
                            <Share2 className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                    </div>
                </div>
            )}

            {/* Candidate Card */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 animate-fade-in-up delay-100">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
                        <User className="w-6 h-6 text-[var(--text-muted)]" />
                    </div>
                    <div>
                        <h2 className="text-[var(--text-primary)] font-bold text-xl">{candidateName}</h2>
                        {app.location && (
                            <p className="text-[var(--text-muted)] text-sm flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {app.location}
                            </p>
                        )}
                        <div className="flex gap-3 mt-1 flex-wrap">
                            {safeUrl(app.linkedin) && (
                                <a href={safeUrl(app.linkedin)} target="_blank" rel="noopener noreferrer"
                                    className="text-[var(--accent)] text-xs font-bold uppercase tracking-wide flex items-center gap-1 hover:underline">
                                    <ExternalLink className="w-3 h-3" /> LinkedIn
                                </a>
                            )}
                            {safeUrl(app.portfolio) && (
                                <a href={safeUrl(app.portfolio)} target="_blank" rel="noopener noreferrer"
                                    className="text-[var(--accent)] text-xs font-bold uppercase tracking-wide flex items-center gap-1 hover:underline">
                                    <Briefcase className="w-3 h-3" /> Portfolio
                                </a>
                            )}
                            <button
                                onClick={openDnaDrawer}
                                className="text-[var(--accent)] text-xs font-bold uppercase tracking-wide flex items-center gap-1 hover:underline">
                                <ShieldCheck className="w-3 h-3" /> {tr("application.detail.fullDnaProfile", "Full DNA profile")}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
                    <div>
                        <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide mb-1">{tr("application.detail.roleApplied", "Role applied")}</p>
                        <p className="text-[var(--text-primary)] font-semibold text-sm">{roleTitle}</p>
                    </div>
                    <div>
                        <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide mb-1">{tr("application.detail.submitted", "Submitted")}</p>
                        <p className="text-[var(--text-primary)] font-semibold text-sm">{formattedDate}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[var(--border)]">
                {(["pipeline", "onboarding"] as const).map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-semibold transition-colors capitalize ${
                            activeTab === tab
                                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                    >
                        {tab === "pipeline" ? tr("application.detail.tab.pipeline", "Pipeline") : tr("application.detail.tab.onboarding", "Intégration")}
                    </button>
                ))}
            </div>

            {/* Documents */}
            {documents.length > 0 && activeTab === "pipeline" && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 animate-fade-in-up delay-200">
                    <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-4">{tr("application.detail.documents", "Documents")}</p>
                    <div className="space-y-3">
                        {documents.map((doc) => (
                            <a key={doc.id} href={doc.url || "#"} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => { if (!doc.url) e.preventDefault(); }}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-raised)] cursor-pointer transition-colors group">
                                <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-[var(--accent)]" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[var(--text-primary)] font-semibold text-sm">{doc.fileName}</p>
                                    <p className="text-[var(--text-muted)] text-xs">{doc.type}</p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Report — waiting state */}
            {!report && activeTab === "pipeline" && app.status !== "REJECTED" && app.status !== "STOPPED" && app.status !== "HIRED" && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 animate-fade-in-up delay-300">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-400/15 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                        </div>
                        <span className="text-[var(--text-primary)] font-bold">{tr("application.detail.aiReport", "Aptely AI report")}</span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-sm">{tr("application.detail.aiAnalysing", "L'IA analyse la candidature…")}</p>
                    <p className="text-[var(--text-muted)] text-xs mt-1">{tr("application.detail.aiAnalysingEta", "Durée estimée : 1 à 3 min après la soumission")}</p>
                    <div className="mt-4 h-1.5 rounded-full bg-[var(--bg-raised)] overflow-hidden">
                        <div className="h-full w-1/3 rounded-full bg-cyan-400/60 animate-pulse" />
                    </div>
                </div>
            )}

            {/* AI Report */}
            {report && activeTab === "pipeline" && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 animate-fade-in-up delay-300 relative overflow-hidden">
                    <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-[var(--text-primary)] font-bold">{tr("application.detail.aiReport", "Aptely AI report")}</span>
                            </div>
                            <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider border border-[var(--border)] rounded-full px-3 py-1">{tr("application.detail.matchScore", "Match score")}</span>
                        </div>
                        <div className="relative flex items-center justify-center w-36 h-36 mx-auto my-4">
                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r={52} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                <circle cx="60" cy="60" r={52} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
                                    strokeDasharray={2 * Math.PI * 52}
                                    strokeDashoffset={2 * Math.PI * 52 - (report.finalScore / 100) * 2 * Math.PI * 52}
                                    style={{ transition: "stroke-dashoffset 1s ease" }} />
                            </svg>
                            <div className="text-center z-10">
                                <span className="text-[var(--text-primary)] text-4xl font-bold">{report.finalScore}</span>
                                <span className="text-[var(--text-muted)] text-lg">%</span>
                            </div>
                        </div>
                        <p className="text-center text-[var(--accent)] font-bold text-sm uppercase tracking-wider mb-6">{report.matchLabel}</p>
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            {report.dimensions.map((d) => (
                                <div key={d.label} className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-3 text-center">
                                    <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">{d.label}</p>
                                    <p className="text-[var(--text-primary)] font-bold text-xl">{d.score}%</p>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2 mb-5">
                            {report.insights.map((ins, i) => (
                                <div key={i} className={`flex items-start gap-2 p-3 rounded-xl text-sm ${ins.type === "success" ? "bg-[var(--bg-raised)] text-[var(--text-primary)]" : "bg-amber-500/15 text-amber-400"}`}>
                                    {ins.type === "success"
                                        ? <CheckCircle className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                                        : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                                    {ins.text}
                                </div>
                            ))}
                        </div>
                        <button onClick={openReportDrawer}
                            className="block w-full text-center py-3.5 bg-[var(--accent)] hover:opacity-90 text-white font-bold rounded-xl transition-all uppercase text-sm tracking-wide">
                            {tr("application.detail.viewFullReport", "View full AI report details")}
                        </button>
                    </div>
                </div>
            )}

            {/* Phase F — Decision Flow */}
            {decisionState && activeTab === "pipeline" && (
                <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "350ms" }}>
                    {/* Recommendation section hidden — linked to offers (DecisionRecommender removed) */}
                    {decisionState.recommendations.length > 0 && !decisionState.decision && (
                        <DecisionMaker
                            applicationId={id}
                            candidateName={candidateName}
                            recommendation={decisionState.recommendations[0] ? {
                                recommendation: decisionState.recommendations[0].recommendation as "STRONG" | "MEDIUM" | "WEAK",
                                observations: decisionState.recommendations[0].observations,
                            } : undefined}
                            onDecisionSubmitted={fetchDecisionState}
                        />
                    )}
                    {decisionState.decision && !decisionState.ratification && (
                        <DecisionRatifier
                            applicationId={id}
                            decisionId={decisionState.decision.id}
                            candidateName={candidateName}
                            decision={{
                                action: decisionState.decision.action as "ACCEPT" | "REJECT" | "HOLD",
                                reason: decisionState.decision.reason,
                            }}
                            onRatificationSubmitted={fetchDecisionState}
                        />
                    )}
                    {decisionState.ratification && (
                        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 flex-1">
                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                <div>
                                    <p className="text-[var(--text-primary)] font-semibold text-sm">{t(locale, "application.detail.decisionRatified", "Decision Ratified")}</p>
                                    <p className="text-[var(--text-muted)] text-xs">{t(locale, "application.detail.ratificationStatus", "Status")}: {decisionState.ratification.status}</p>
                                </div>
                            </div>
                            {decisionState.ratification.status === "APPROVED" && decisionState.decision?.action === "ACCEPT" && (
                                <button
                                    onClick={() => setOfferModalOpen(true)}
                                    className="px-5 py-2.5 bg-[var(--accent)] text-white font-bold rounded-xl hover:opacity-90 transition-all text-sm flex items-center justify-center gap-2 shrink-0"
                                >
                                    <FileSignature className="w-4 h-4" />
                                    {tr("application.detail.createOffer", "Create offer")}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Decision Audit Timeline */}
            {auditLogs.length > 0 && activeTab === "pipeline" && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "380ms" }}>
                    <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest mb-5 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        {tr("application.detail.decisionTimeline", "Decision trail")}
                    </p>
                    <div className="relative">
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-[var(--border)]" />
                        <div className="space-y-5">
                            {auditLogs.map((log) => {
                                const eventLabel: Record<string, string> = {
                                    DECISION_RECOMMENDED: tr("audit.recommended", "Recommendation submitted"),
                                    DECISION_DECIDED: tr("audit.decided", "Decision recorded"),
                                    DECISION_RATIFIED: tr("audit.ratified", "Decision ratified"),
                                };
                                const dotColor: Record<string, string> = {
                                    DECISION_RECOMMENDED: "bg-blue-400",
                                    DECISION_DECIDED: "bg-[var(--accent)]",
                                    DECISION_RATIFIED: "bg-emerald-400",
                                };
                                const payload = log.payload_json ?? {};
                                const formattedTs = new Date(log.created_at).toLocaleString(localeTag, {
                                    month: "short", day: "numeric", year: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                });
                                return (
                                    <div key={log.id} className="relative pl-9">
                                        <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${dotColor[log.event_type] ?? "bg-[var(--text-muted)]"}`}>
                                            <CheckCircle className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <p className="text-[var(--text-primary)] font-semibold text-sm leading-tight">
                                            {eventLabel[log.event_type] ?? log.event_type}
                                        </p>
                                        {!!(payload as any).recommendation && (
                                            <p className="text-[var(--text-muted)] text-xs mt-0.5">
                                                {tr("audit.strength", "Strength")}: <span className="text-[var(--text-primary)] font-medium">{String((payload as any).recommendation)}</span>
                                            </p>
                                        )}
                                        {!!(payload as any).action && (
                                            <p className="text-[var(--text-muted)] text-xs mt-0.5">
                                                {tr("audit.action", "Action")}: <span className="text-[var(--text-primary)] font-medium">{String((payload as any).action)}</span>
                                            </p>
                                        )}
                                        {!!(payload as any).reason && (
                                            <p className="text-[var(--text-muted)] text-xs mt-0.5 italic">{String((payload as any).reason)}</p>
                                        )}
                                        <p className="text-[var(--text-muted)] text-xs mt-1">{formattedTs}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Onboarding Checklist */}
            {activeTab === "onboarding" && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl animate-fade-in-up" style={{ animationDelay: "390ms" }}>
                    <button className="w-full flex items-center justify-between p-5 text-left"
                        onClick={() => setChecklistExpanded((v) => !v)}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center">
                                <ClipboardList className="w-4 h-4 text-[var(--accent)]" />
                            </div>
                            <div>
                                <p className="text-[var(--text-primary)] font-bold text-sm">{tr("onboarding.checklistTitle", "Onboarding Checklist")}</p>
                                {checklist && (
                                    <p className="text-[var(--text-muted)] text-xs">
                                        {checklist.progress.completed}/{checklist.progress.total} {tr("onboarding.tasksCompleted", "tasks completed")} · {checklist.progress.percentage}%
                                    </p>
                                )}
                            </div>
                        </div>
                        {checklistExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </button>
                    {checklistExpanded && (
                        <div className="px-5 pb-5 border-t border-[var(--border)] pt-4">
                            {checklistLoading ? (
                                <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-3">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {tr("onboarding.loading", "Loading checklist...")}
                                </div>
                            ) : !checklist ? (
                                <div className="space-y-3">
                                    <p className="text-[var(--text-muted)] text-sm">{tr("onboarding.noChecklist", "No onboarding checklist yet.")}</p>
                                    {templates.length > 0 ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl flex-1 text-sm py-1.5 px-2 focus:outline-none focus:border-[var(--accent)]"
                                                value={selectedTemplateId}
                                                onChange={(e) => setSelectedTemplateId(e.target.value)}>
                                                {templates.map((tpl) => (
                                                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                                                ))}
                                            </select>
                                            <button onClick={handleInstantiateChecklist} disabled={instantiating || !selectedTemplateId}
                                                className="bg-[var(--accent)] text-white rounded-xl flex items-center gap-1.5 text-sm py-1.5 px-3 whitespace-nowrap hover:opacity-90 disabled:opacity-50">
                                                {instantiating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                                                {tr("onboarding.createChecklist", "Create Checklist")}
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-[var(--text-muted)] text-xs">
                                            {tr("onboarding.noTemplates", "No templates available.")} <Link href={ROUTES.company.recruitment.onboarding} className="text-[var(--accent)] hover:underline">{tr("onboarding.createTemplate", "Create one →")}</Link>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="w-full bg-[var(--border)] rounded-full h-1.5 mb-4">
                                        <div className="bg-[var(--accent)] h-1.5 rounded-full transition-all duration-500"
                                            style={{ width: `${checklist.progress.percentage}%` }} />
                                    </div>
                                    {checklist.progress.percentage === 100 && (
                                        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 mb-2">
                                            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-bold text-emerald-400">{tr("onboarding.day1Ready", "Prêt pour le Jour 1")}</p>
                                                <p className="text-xs text-emerald-400/70">{tr("onboarding.day1ReadyDesc", "Toutes les tâches sont complétées.")}</p>
                                            </div>
                                        </div>
                                    )}
                                    {checklist.tasks.map((task) => (
                                        <div key={task.id} className="flex items-start gap-3">
                                            <button onClick={() => handleTaskToggle(task.id, task.status)} disabled={taskUpdating === task.id}
                                                className="mt-0.5 flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50">
                                                {taskUpdating === task.id ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : task.status === "COMPLETED" ? <CheckSquare className="w-4 h-4 text-emerald-400" />
                                                    : <Square className="w-4 h-4" />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${task.status === "COMPLETED" ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                                                    {task.title}
                                                </p>
                                                {task.description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{task.description}</p>}
                                            </div>
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${task.assignee_type === "CANDIDATE" ? "bg-sky-400/10 text-sky-400" : "bg-[var(--accent-dim)] text-[var(--accent)]"}`}>
                                                {task.assignee_type === "CANDIDATE" ? tr("onboarding.candidate", "Candidate") : tr("onboarding.hr", "HR")}
                                            </span>
                                        </div>
                                    ))}
                                    {checklist.tasks.length === 0 && <p className="text-[var(--text-muted)] text-sm">{tr("onboarding.noTasks", "No tasks defined.")}</p>}
                                    {(checklist.documents ?? []).length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-[var(--border)]">
                                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                                                <Upload className="w-3 h-3" />{tr("onboarding.documents", "Documents")}
                                            </p>
                                            <div className="space-y-3">
                                                {(checklist.documents ?? []).map((doc) => (
                                                    <div key={doc.id} className="space-y-1">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            {doc.status === "REJECTED" ? <XCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                                                                : doc.status === "VERIFIED" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                                                                : <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />}
                                                            <span className="flex-1 truncate text-[var(--text-secondary)]">{doc.file_name}</span>
                                                            {doc.status === "UPLOADED" && (
                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                    <button onClick={() => handleVerifyDoc(doc.id, "VERIFIED")} disabled={docVerifying === doc.id}
                                                                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/20 transition-colors disabled:opacity-50">
                                                                        {docVerifying === doc.id ? <Loader2 className="w-2.5 h-2.5 animate-spin inline" /> : "✓"}
                                                                    </button>
                                                                    <button onClick={() => handleVerifyDoc(doc.id, "REJECTED")} disabled={docVerifying === doc.id}
                                                                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-400/10 text-rose-400 border border-rose-400/30 hover:bg-rose-400/20 transition-colors disabled:opacity-50">
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <span className={`font-bold flex-shrink-0 ${doc.status === "VERIFIED" ? "text-emerald-400" : doc.status === "REJECTED" ? "text-rose-400" : "text-[var(--text-muted)]"}`}>
                                                                {doc.status}
                                                            </span>
                                                            {doc.notes && <span className="text-[var(--text-muted)] italic truncate max-w-[80px]">{doc.notes}</span>}
                                                            {doc.status === "VERIFIED" && !docSigningChains[doc.id] && (
                                                                <button onClick={() => loadSigningChain(doc.id)} disabled={signingChainLoading === doc.id}
                                                                    className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors disabled:opacity-50 flex-shrink-0">
                                                                    {signingChainLoading === doc.id ? <Loader2 className="w-2.5 h-2.5 animate-spin inline" /> : t(locale, "application.detail.signingChain", "Signing chain")}
                                                                </button>
                                                            )}
                                                        </div>
                                                        {doc.status === "VERIFIED" && docSigningChains[doc.id] !== undefined && (
                                                            <div className="ml-5 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] p-2 space-y-1.5">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "application.detail.signingChain", "Signing chain")}</p>
                                                                {docSigningChains[doc.id].length === 0 ? (
                                                                    <button onClick={() => handleInitSigningChain(doc.id)} disabled={signingChainLoading === doc.id}
                                                                        className="text-[10px] font-bold text-[var(--accent)] hover:underline disabled:opacity-50">
                                                                        {signingChainLoading === doc.id ? t(locale, "application.detail.initSigningChain", "Initializing…") : t(locale, "application.detail.initSigningChainAction", "+ Initiate (HR → Candidate)")}
                                                                    </button>
                                                                ) : (
                                                                    docSigningChains[doc.id].map((step) => (
                                                                        <div key={step.id} className="flex items-center gap-2 text-[11px]">
                                                                            {step.status === "SIGNED" ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                                                                : step.status === "REJECTED" ? <XCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                                                                                : <Clock className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                                                                            <span className="text-[var(--text-secondary)] font-medium">{step.signer_role}</span>
                                                                            <span className={`font-bold ${step.status === "SIGNED" ? "text-emerald-400" : step.status === "REJECTED" ? "text-rose-400" : "text-yellow-400"}`}>
                                                                                {step.status}
                                                                            </span>
                                                                            {step.status === "PENDING" && step.signer_role !== "CANDIDATE" && (
                                                                                <button onClick={() => handleSignStep(doc.id, step.position)} disabled={signingStep === `${doc.id}-${step.position}`}
                                                                                    className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/20 disabled:opacity-50">
                                                                                    {signingStep === `${doc.id}-${step.position}` ? <Loader2 className="w-2 h-2 animate-spin inline" /> : t(locale, "application.detail.sign", "Sign")}
                                                                                </button>
                                                                            )}
                                                                            {step.signed_at && (
                                                                                <span className="text-[var(--text-muted)] ml-auto">{new Date(step.signed_at).toLocaleTimeString(localeTag)}</span>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* DNA Drawer */}
            <SlideOverDrawer isOpen={drawerOpen === "dna"} onClose={() => setDrawerOpen(null)}
                title={tr("application.detail.fullDnaProfile", "Full DNA profile")}>
                {(() => {
                    const snap = app?.dna_snapshot ?? app?.dnaSnapshot ?? null;
                    if (!snap) {
                        return (
                            <div className="text-center py-10 space-y-3">
                                <p className="text-[var(--text-muted)] text-sm">{tr("drawer.dna.noData", "DNA profile not available.")}</p>
                                <Link href={appCandidatePath(id as string)} className="text-[var(--accent)] text-sm hover:underline" onClick={() => setDrawerOpen(null)}>
                                    {tr("drawer.dna.openPage", "Open full profile")} →
                                </Link>
                            </div>
                        );
                    }
                    const ti = (snap.talent_identity ?? {}) as Record<string, unknown>;
                    const ts = (snap.talent_snapshot ?? {}) as Record<string, unknown>;
                    const fd = (snap.foundation ?? {}) as Record<string, unknown>;
                    const skills = (snap.talent_skills ?? []) as Array<{ skillName: string; yearsUsed: number; ownership: string }>;
                    const evidence = (snap.talent_evidence ?? []) as Array<{ projectName: string; result: string }>;
                    const name = (ti.name as string) ?? candidateName;
                    const primaryRole = (ts.primaryRole as string) ?? (fd.primaryRole as string) ?? (ti.primaryRole as string) ?? "—";
                    const locObj = fd.location as { city?: string; country?: string } | undefined;
                    const location = [locObj?.city, locObj?.country].filter(Boolean).join(", ") || (ti.location as string) || "—";
                    const availObj = fd.availability as { type?: string; date?: string } | undefined;
                    const availLabel: Record<string, string> = { IMMEDIATELY: "Immédiatement", IN_1_MONTH: "Dans 1 mois", IN_3_MONTHS: "Dans 3 mois", IN_6_MONTHS: "Dans 6 mois" };
                    const availability = (availObj?.type ? (availLabel[availObj.type] ?? availObj.type) : null) ?? (ti.availability as string) ?? "—";
                    const salary = (fd.salaryExpectation as string) || (ti.salaryExpectation as string) || (ti.salary as string) || "—";
                    const contracts = (fd.contracts as string[] | undefined) ?? (ti.contracts as string[] | undefined) ?? [];
                    const problemSolving = (ts.trustedProblemSolving as string) ?? "";
                    const links = (ti.links as { linkedin?: string; portfolio?: string; cv?: string } | undefined) ?? {};
                    const linkedin = links.linkedin ?? (ti.linkedin as string) ?? "";
                    const portfolio = links.portfolio ?? (ti.portfolio as string) ?? "";
                    return (
                        <>
                            <div className="bg-[var(--bg-raised)] rounded-xl p-4 flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent-dim)] flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-[var(--accent)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[var(--text-primary)]">{name}</p>
                                    <p className="text-[var(--accent)] text-xs font-bold uppercase mt-0.5">{primaryRole}</p>
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                        {safeUrl(linkedin) && <a href={safeUrl(linkedin)} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] text-xs hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />LinkedIn</a>}
                                        {safeUrl(portfolio) && <a href={safeUrl(portfolio)} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] text-xs hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />Portfolio</a>}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    [tr("application.candidate.location", "Location"), location],
                                    [tr("application.candidate.availability", "Availability"), availability],
                                    [tr("application.candidate.salaryExpectations", "Salary"), salary],
                                    [tr("application.candidate.contractsAccepted", "Contracts"), contracts.join(", ") || "—"],
                                ] as [string, string][]).map(([label, value]) => (
                                    <div key={label} className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-3">
                                        <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-[var(--text-primary)] text-sm font-semibold">{value}</p>
                                    </div>
                                ))}
                            </div>
                            {problemSolving && (
                                <div className="bg-[var(--accent-dim)] border border-[var(--border)] rounded-xl p-4">
                                    <p className="text-[var(--accent)] text-xs font-bold uppercase tracking-wide mb-2">{tr("application.candidate.problemSolvingDna", "Problem solving DNA")}</p>
                                    <p className="text-[var(--text-secondary)] text-sm italic">&ldquo;{problemSolving}&rdquo;</p>
                                </div>
                            )}
                            {skills.length > 0 && (
                                <div>
                                    <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wide mb-2">{tr("application.candidate.skillMapping", "Key skills")}</p>
                                    <div className="space-y-2">
                                        {skills.slice(0, 6).map((cap, i) => (
                                            <div key={i} className="flex items-center justify-between bg-[var(--bg-raised)] rounded-xl px-3 py-2">
                                                <span className="text-[var(--text-primary)] text-sm font-semibold">{cap.skillName}</span>
                                                <span className="text-[var(--text-muted)] text-xs">{cap.yearsUsed}y · {cap.ownership}</span>
                                            </div>
                                        ))}
                                        {skills.length > 6 && <p className="text-[var(--text-muted)] text-xs text-center">+{skills.length - 6} {tr("application.candidate.moreSkills", "more")}</p>}
                                    </div>
                                </div>
                            )}
                            {evidence.length > 0 && (
                                <div>
                                    <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wide mb-2">{tr("application.candidate.deepWorkEvidence", "Work evidence")}</p>
                                    <div className="space-y-2">
                                        {evidence.slice(0, 3).map((ev, i) => (
                                            <div key={i} className="bg-[var(--bg-raised)] rounded-xl px-3 py-2">
                                                <p className="text-[var(--text-primary)] text-sm font-semibold">{ev.projectName}</p>
                                                <p className="text-[var(--text-muted)] text-xs mt-0.5 italic">{ev.result}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <Link href={appCandidatePath(id as string)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                                <ExternalLink className="w-4 h-4" />{tr("drawer.dna.fullProfile", "Full candidate profile")}
                            </Link>
                        </>
                    );
                })()}
            </SlideOverDrawer>

            {/* Report Drawer */}
            <SlideOverDrawer isOpen={drawerOpen === "report"} onClose={() => setDrawerOpen(null)}
                title={tr("application.detail.aiReport", "Aptely AI report")}>
                {reportDrawerLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                    </div>
                ) : report ? (
                    <>
                        <div className="flex items-center gap-5 bg-[var(--bg-raised)] rounded-xl p-5">
                            <div className="relative w-20 h-20 flex-shrink-0">
                                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
                                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                                    <circle cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 30}
                                        strokeDashoffset={2 * Math.PI * 30 - (report.finalScore / 100) * 2 * Math.PI * 30} />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[var(--text-primary)] text-lg font-bold">{report.finalScore}%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[var(--accent)] font-bold text-sm uppercase tracking-wide">{report.matchLabel}</p>
                                <p className="text-[var(--text-muted)] text-xs mt-1">{tr("application.detail.matchScore", "Match score")}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {report.dimensions.map((d) => (
                                <div key={d.label} className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-3 text-center">
                                    <p className="text-[var(--text-muted)] text-[10px] font-semibold uppercase tracking-wider mb-1">{d.label}</p>
                                    <p className="text-[var(--text-primary)] font-bold text-lg">{d.score}%</p>
                                </div>
                            ))}
                        </div>
                        {(fullReport?.results?.[0]?.aiExplanation?.whySelected?.length ?? 0) > 0 && (
                            <div>
                                <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wide mb-2">{tr("application.report.selectionRationale", "Why selected")}</p>
                                <div className="space-y-2">
                                    {fullReport!.results[0].aiExplanation.whySelected.map((reason, i) => (
                                        <div key={i} className="flex gap-3 p-3 bg-[var(--bg-raised)] rounded-xl text-sm text-[var(--text-secondary)] italic">
                                            <span className="text-[var(--accent)] font-bold flex-shrink-0">{i + 1}.</span>
                                            {reason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {report.insights.length > 0 && (
                            <div>
                                <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wide mb-2">{tr("application.report.insightsTitle", "Insights")}</p>
                                <div className="space-y-2">
                                    {report.insights.map((ins, i) => (
                                        <div key={i} className={`flex items-start gap-2 p-3 rounded-xl text-sm ${ins.type === "success" ? "bg-[var(--bg-raised)] text-[var(--text-primary)]" : "bg-amber-500/15 text-amber-400"}`}>
                                            {ins.type === "success"
                                                ? <CheckCircle className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                                                : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                                            {ins.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <Link href={appReportPath(id)} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 py-3 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                            <ExternalLink className="w-4 h-4" />{tr("drawer.report.fullReport", "Full AI analysis page")}
                        </Link>
                    </>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-[var(--text-muted)] text-sm">{tr("application.report.pendingTitle", "AI analysis pending")}</p>
                    </div>
                )}
            </SlideOverDrawer>

            {/* Rejection reason block */}
            {!isDecisionFinalized && pendingAction === "reject" && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 animate-fade-in-up">
                    <p className="text-rose-400 font-semibold text-sm mb-3">{tr("application.detail.confirmReject", "Reject this candidate?")}</p>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={tr("application.detail.rejectionReasonPlaceholder", "Motif (optionnel — envoyé au candidat par email)")}
                        rows={3}
                        className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-rose-400"
                    />
                </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap gap-2 sm:gap-3 sm:flex-nowrap pb-4 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
                <Link href={appMessagesPath(id)}
                    className="flex-1 basis-[22%] sm:basis-auto py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-center">
                    <MessageSquare className="w-4 h-4 inline mr-2" />{tr("application.detail.message", "Message")}
                </Link>
                <Link
                    href={candidateId
                        ? `${candidateInterviewsPath(candidateId)}?applicationId=${id}`
                        : appInterviewPath(id)}
                    className="flex-1 basis-[22%] sm:basis-auto py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:border-blue-400 hover:text-blue-400 transition-colors text-center">
                    <Calendar className="w-4 h-4 inline mr-2" />{tr("application.detail.scheduleInterview", "Schedule interview")}
                </Link>
                {!isDecisionFinalized && (pendingAction === "reject" ? (
                    <>
                        <button onClick={() => { const r = rejectionReason; setPendingAction(null); setRejectionReason(""); handleAction("reject", r); }} disabled={acting}
                            className="flex-1 px-4 py-3.5 bg-rose-500 text-white font-bold rounded-xl hover:opacity-90 transition-all text-sm disabled:opacity-50">
                            {tr("application.detail.confirmRejectAction", "Confirmer le rejet")}
                        </button>
                        <button onClick={() => { setPendingAction(null); setRejectionReason(""); }} disabled={acting}
                            className="px-4 py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:bg-[var(--bg-raised)] transition-colors text-sm">
                            {tr("application.detail.cancel", "Cancel")}
                        </button>
                    </>
                ) : pendingAction === "stop" ? (
                    <>
                        <span className="flex-1 basis-[22%] sm:basis-auto py-3.5 text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                            {tr("application.detail.confirmStop", "Stop this application?")}
                        </span>
                        <button onClick={() => { setPendingAction(null); handleAction("stop"); }} disabled={acting}
                            className="px-4 py-3.5 bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-secondary)] font-bold rounded-xl hover:opacity-90 transition-all text-sm disabled:opacity-50">
                            {tr("application.detail.confirm", "Confirm")}
                        </button>
                        <button onClick={() => setPendingAction(null)} disabled={acting}
                            className="px-4 py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:bg-[var(--bg-raised)] transition-colors text-sm">
                            {tr("application.detail.cancel", "Cancel")}
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setPendingAction("reject")} disabled={acting}
                            className="flex-1 basis-[22%] sm:basis-auto py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:border-rose-400 hover:text-rose-400 transition-colors disabled:opacity-50">
                            <X className="w-4 h-4 inline mr-2" />{tr("application.detail.reject", "Reject")}
                        </button>
                        <button onClick={() => setPendingAction("stop")} disabled={acting}
                            className="flex-1 basis-[22%] sm:basis-auto py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:bg-[var(--bg-raised)] transition-colors disabled:opacity-50">
                            <StopCircle className="w-4 h-4 inline mr-2" />{tr("application.detail.stop", "Stop")}
                        </button>
                        <button onClick={() => handleAction("validate")} disabled={acting}
                            className="basis-full sm:basis-auto sm:flex-2 px-8 py-3.5 bg-[var(--accent)] text-white font-bold rounded-xl hover:opacity-90 transition-all uppercase text-sm tracking-wide disabled:opacity-50">
                            {tr("application.detail.validate", "Validate application")}
                        </button>
                    </>
                ))}
            </div>

            {/* Create Offer Modal */}
            <Modal
                open={offerModalOpen}
                onClose={() => !creatingOffer && setOfferModalOpen(false)}
                title={tr("application.detail.createOfferTitle", "Create an offer")}
                description={candidateName}
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase flex items-center gap-1.5 mb-1">
                            <Briefcase className="w-3.5 h-3.5 text-[var(--accent)]" />
                            {tr("offers.detail.position", "Position")}
                        </label>
                        <input type="text" className="glass-input w-full" value={offerForm.position}
                            onChange={(e) => setOfferForm({ ...offerForm, position: e.target.value })}
                            placeholder={tr("application.detail.offerPositionPlaceholder", "e.g. Senior Backend Engineer")} />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-[var(--accent)]" />
                            {tr("offers.detail.compensation", "Compensation")}
                        </label>
                        <input type="text" className="glass-input w-full" value={offerForm.compensation}
                            onChange={(e) => setOfferForm({ ...offerForm, compensation: e.target.value })}
                            placeholder={tr("application.detail.offerCompensationPlaceholder", "ex: 65 000 EUR / 75,000 USD / an")} />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase flex items-center gap-1.5 mb-1">
                            <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                            {tr("offers.detail.startDate", "Start Date")}
                        </label>
                        <input type="date" className="glass-input w-full" value={offerForm.startDate}
                            onChange={(e) => setOfferForm({ ...offerForm, startDate: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase flex items-center gap-1.5 mb-1">
                            <Gift className="w-3.5 h-3.5 text-[var(--accent)]" />
                            {tr("offers.detail.benefits", "Benefits")} <span className="normal-case font-normal opacity-60">({tr("application.detail.optional", "optional")})</span>
                        </label>
                        <input type="text" className="glass-input w-full" value={offerForm.benefits}
                            onChange={(e) => setOfferForm({ ...offerForm, benefits: e.target.value })}
                            placeholder={tr("application.detail.offerBenefitsPlaceholder", "e.g. Remote, health insurance, equity")} />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase mb-1 block">
                            {tr("offers.detail.notes", "Notes")} <span className="normal-case font-normal opacity-60">({tr("application.detail.optional", "optional")})</span>
                        </label>
                        <textarea className="glass-input w-full h-20 resize-none" value={offerForm.notes}
                            onChange={(e) => setOfferForm({ ...offerForm, notes: e.target.value })} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => setOfferModalOpen(false)} disabled={creatingOffer}
                            className="flex-1 px-4 py-3 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:bg-[var(--bg-raised)] transition-colors text-sm disabled:opacity-50">
                            {tr("application.detail.cancel", "Cancel")}
                        </button>
                        <button onClick={handleCreateOffer} disabled={creatingOffer}
                            className="flex-1 px-4 py-3 bg-[var(--accent)] text-white font-bold rounded-xl hover:opacity-90 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                            {creatingOffer && <Loader2 className="w-4 h-4 animate-spin" />}
                            {tr("application.detail.createOfferSubmit", "Create offer")}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
