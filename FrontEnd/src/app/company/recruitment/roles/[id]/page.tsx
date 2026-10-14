"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getRoleById, getApplicationsByRole, Role, Application, evaluateRole, updateApplicationStatus, finalizeSelection, sendSelectionEmails, saveRolePostSheet, relaunchApplicationMatching } from "@/lib/api";
import { listWavesForRole } from "@/lib/api.waves";
import { useRequireInstitution } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import CandidateDrawer from "./CandidateDrawer";
import RoleDnaForm from "@/components/RoleDnaForm";
import CandidateApplicationModal from "./CandidateApplicationModal";
import {
    Search,
    Clock,
    ChevronRight,
    ArrowLeft,
    MapPin,
    Users,
    CheckCircle2,
    Target,
    Link as LinkIcon,
    Check,
    Eye,
    X,
    MessageSquare,
    Send,
    Loader2,
    AlertCircle,
    RotateCcw,
    FileText,
    ChevronDown,
    ChevronUp,
    Save,
    RefreshCcw,
    Calendar,
} from "lucide-react";
import Link from "next/link";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, appInterviewPath, appReportPath, roleFinalizeListPath, candidateInterviewsPath, rolePath, roleWithAppPath } from "@/lib/routes";
import ApplicationDrawer from "./ApplicationDrawer";
import { EmptyState } from "@/components/ui/EmptyState";


function relativeTime(iso: string, locale: any): string {
    if (!iso) return t(locale, "common.unknown", "Unknown");
    const diff = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diff)) return t(locale, "common.unknown", "Unknown");
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m} ${t(locale, "time.minAgo", "min ago")}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${t(locale, "time.hAgo", "h ago")}`;
    const d = Math.floor(h / 24);
    return d === 1 ? t(locale, "time.yesterday", "Yesterday") : `${d} ${t(locale, "time.daysAgo", "days ago")}`;
}

function getInitials(name: string) {
    return name?.split(" ")?.map((n) => n[0])?.join("")?.slice(0, 2)?.toUpperCase() || "??";
}

function hasUsableId(value: string | undefined): boolean {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;

    const lowered = trimmed.toLowerCase();
    return lowered !== "unknown" && lowered !== "undefined" && lowered !== "null";
}

const AVATAR_COLORS = [
    "bg-blue-400/10 text-blue-400 border border-blue-400/20",
    "bg-purple-400/10 text-purple-400 border border-purple-400/20",
    "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20",
    "bg-amber-400/10 text-amber-400 border border-amber-400/20",
    "bg-rose-400/10 text-rose-400 border border-rose-400/20",
];


type ParsedLegacyRole = {
    title: string;
    mission90Days: string;
    success6Months: string;
    keyProblems: Array<{ problem: string; priority: "HIGH" | "MEDIUM" | "LOW" }>;
};

function cleanLegacyText(value: string): string {
    return value
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function parseLegacyRoleData(titleRaw: string, descriptionRaw: string): ParsedLegacyRole {
    const parsed: ParsedLegacyRole = {
        title: titleRaw || "",
        mission90Days: "",
        success6Months: "",
        keyProblems: [],
    };

    const titleMatch = titleRaw?.match(/Title:\s*(.*?)\s*Seniority:/i);
    if (titleMatch?.[1]) {
        parsed.title = cleanLegacyText(titleMatch[1]);
    }

    const missionMatch = descriptionRaw?.match(/90-Day Mission:\s*([\s\S]*?)(?:\n\s*6-Month Success:|$)/i);
    if (missionMatch?.[1]) {
        parsed.mission90Days = cleanLegacyText(missionMatch[1]);
    }

    const successMatch = descriptionRaw?.match(/6-Month Success:\s*([\s\S]*?)(?:\n\s*Top\s*\d+\s*Key Problems|$)/i);
    if (successMatch?.[1]) {
        parsed.success6Months = cleanLegacyText(successMatch[1]);
    }

    const problemsBlockMatch = descriptionRaw?.match(/Top\s*\d+\s*Key Problems[\s\S]*?:\s*([\s\S]*)$/i);
    if (problemsBlockMatch?.[1]) {
        const lines = problemsBlockMatch[1]
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const extracted = lines
            .map((line) => {
                const item = line.match(/^\d+\.\s*(.+)$/);
                return item?.[1]?.trim() ?? "";
            })
            .filter(Boolean)
            .map((problem, index) => ({
                problem,
                priority: (index === 0 ? "HIGH" : index === 1 ? "MEDIUM" : "LOW") as "HIGH" | "MEDIUM" | "LOW",
            }));

        parsed.keyProblems = extracted;
    }

    return parsed;
}

export default function RoleApplicationsPage() {
    useRequireInstitution();
    const locale = getClientLocale();
    const router = useRouter();
    const routeParams = useParams<{ id: string }>();
    const id = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
    const searchParams = useSearchParams();
    const selectedAppId = searchParams.get("app");
    
    const FILTER_TABS = [
        { value: "ALL", label: t(locale, "roles.dashboard.filter.all", "All Candidates") },
        { value: "SCORE", label: t(locale, "roles.dashboard.filter.score", "Candidates by score") },
        { value: "PENDING", label: t(locale, "roles.dashboard.filter.new", "Nouveau") },
        { value: "FINISHED", label: t(locale, "roles.dashboard.filter.review", "En revue") },
        { value: "INTERVIEW", label: t(locale, "roles.dashboard.filter.interview", "Interview") },
        { value: "VALIDATED", label: t(locale, "roles.dashboard.filter.validated", "Validated") },
        { value: "REJECTED", label: t(locale, "roles.dashboard.filter.rejected", "Rejected") },
    ];

    // Core Data
    const [role, setRole] = useState<Role | null>(null);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [filter, setFilter] = useState("ALL");
    const [scoreThreshold, setScoreThreshold] = useState(50);
    const [search, setSearch] = useState("");
    const [copied, setCopied] = useState(false);
    
    // Evaluation State
    const [evaluating, setEvaluating] = useState(false);
    
    // Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [currentAppIndex, setCurrentAppIndex] = useState<number>(0);
    const [applicationModalOpen, setApplicationModalOpen] = useState(false);
    const [applicationModalId, setApplicationModalId] = useState<string | null>(null);
    const [relaunchingApplicationId, setRelaunchingApplicationId] = useState<string | null>(null);

    // Editable role post sheet
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetSaving, setSheetSaving] = useState(false);
    const [nameRole, setNameRole] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [localisation, setLocalisation] = useState("");
    const [instructionIA, setInstructionIA] = useState("");
    const [textStr, setTextStr] = useState("");
    const [textError, setTextError] = useState<string | null>(null);
    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalApps, setTotalApps] = useState(0);
    const PER_PAGE = 20;
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Finalize State
    const [templatesExpanded, setTemplatesExpanded] = useState(false);
    const [sendingEmails, setSendingEmails] = useState(false);
    const [hasWaves, setHasWaves] = useState(false);
    const [templates, setTemplates] = useState({
        approved: "Dear {{name}},\n\nWe are thrilled to inform you that your Talent DNA matches our requirements perfectly. We would like to invite you for a technical interview next week.\n\nBest regards,\nAptely HR Team",
        rejected: "Dear {{name}},\n\nThank you for your interest in the {{role}} position. While your profile is impressive, we have decided to move forward with other candidates whose DNA markers are a closer match for this specific role.\n\nBest regards,\nAptely HR Team"
    });

    const loadData = async () => {
        const [roleData, appsRes, wavesData] = await Promise.all([
            getRoleById(id),
            getApplicationsByRole(id, 1, PER_PAGE),
            listWavesForRole(id).catch(() => []),
        ]);
        setHasWaves(Array.isArray(wavesData) && wavesData.length > 0);
        setRole(roleData);
        setApplications(appsRes.data);
        setTotalApps(appsRes.meta.total);
        setPage(1);
        setHasMore(appsRes.data.length < appsRes.meta.total);

        if (roleData) {
            if (roleData.metadataMissing) {
                setSheetOpen(true);
            }
            const persistedFullForm = roleData.roleDna?.fullFormSnapshot || {};
            setNameRole(persistedFullForm.name_role || roleData.title || "");
            setLocalisation(persistedFullForm.localisation || roleData.location || "");
            setStartDate(persistedFullForm.start_date || "");
            setEndDate(persistedFullForm.end_date || "");
            setInstructionIA(persistedFullForm.instruction_ia || "");
            const initialText = persistedFullForm.role_content 
                ? persistedFullForm.role_content 
                : Object.keys(persistedFullForm).length > 0 
                    ? JSON.stringify(persistedFullForm, null, 2) 
                    : "";
            setTextStr(initialText);
        }

        setLoading(false);
    };

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }
        loadData();
     
    }, [id]);

    // Auto-refresh while matching runs. Polls when the evaluation was launched from
    // this page (evaluating) OR when apps are already ANALYSING (evaluation launched
    // elsewhere / page reloaded mid-run) — otherwise scores only appear on manual reload.
    const hasAnalysing = applications.some(a => a.status === 'ANALYSING');
    useEffect(() => {
        if (!evaluating && !hasAnalysing) return;
        const interval = setInterval(async () => {
            const appsRes = await getApplicationsByRole(id, 1, Math.max(applications.length, PER_PAGE));
            setApplications(appsRes.data);
            const stillProcessing = appsRes.data.some(a => a.status === 'ANALYSING');
            if (!stillProcessing) {
                setEvaluating(false);
                clearInterval(interval);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [evaluating, hasAnalysing, id]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        const res = await getApplicationsByRole(id, nextPage, PER_PAGE);
        setApplications(prev => [...prev, ...res.data]);
        setPage(nextPage);
        setHasMore(applications.length + res.data.length < totalApps);
        setLoadingMore(false);
    }, [loadingMore, hasMore, page, id, applications.length, totalApps]);

    // Infinite scroll: auto-load when the "load more" sentinel is visible
    useEffect(() => {
        const sentinel = loadMoreRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
            { rootMargin: '200px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadMore]);

    const handleStatusChange = async (appId: string, newStatus: string) => {
        const prevStatus = applications.find(a => a.applicationId === appId)?.status;
        // Optimistic update — rolled back if the backend rejects the change
        setApplications(apps => apps.map(a => a.applicationId === appId ? { ...a, status: newStatus as any } : a));
        const ok = await updateApplicationStatus(appId, newStatus);
        if (!ok && prevStatus) {
            setApplications(apps => apps.map(a => a.applicationId === appId ? { ...a, status: prevStatus as any } : a));
        }
    };

    const handleEvaluateAll = async () => {
        setEvaluating(true);
        const ok = await evaluateRole(id, 200);
        if (!ok) {
            setEvaluating(false);
            alert(t(locale, "roles.dashboard.evaluateFailed", "Échec du lancement de l'évaluation IA. Réessayez."));
            return;
        }
        await loadData(); // Immediate refresh to see Analysing state
    };

    const handleSendEmails = async () => {
        if (!confirm(t(locale, "roles.dashboard.confirmSendEmails", "Finaliser la sélection et envoyer les emails à tous les candidats validés et refusés ?"))) return;

        setSendingEmails(true);
        const candidatesToProcess = applications.filter(a => a.status === 'VALIDATED' || a.status === 'REJECTED');

        let failed = 0;
        try {
            for (const app of candidatesToProcess) {
                const finalized = await finalizeSelection(app.applicationId, {
                    approvalMessage: templates.approved,
                    rejectionMessage: templates.rejected,
                });
                const sent = finalized && await sendSelectionEmails(app.applicationId);
                if (!sent) failed++;
            }
        } catch (err) {
            console.error("SendEmails error:", err);
            failed++;
        }

        setSendingEmails(false);
        if (failed === 0) {
            alert(t(locale, "roles.dashboard.emailsSentSuccess", "Emails envoyés à {{count}} candidat(s).", { count: candidatesToProcess.length }));
        } else {
            alert(t(locale, "roles.dashboard.emailsSentPartial", "Échec de l'envoi pour {{failed}} candidat(s) sur {{total}}. Réessayez.", { failed, total: candidatesToProcess.length }));
        }
    };

    const copyRoleLink = () => {
        if (!role) return;
        navigator.clipboard.writeText(role.shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRelaunchCandidateMatching = async (applicationId: string) => {
        setRelaunchingApplicationId(applicationId);
        const ok = await relaunchApplicationMatching(applicationId);
        if (ok) {
            await loadData();
        } else {
            alert(t(locale, "roles.dashboard.relaunchFailed", "Échec de la relance du matching IA. Réessayez."));
        }
        setRelaunchingApplicationId(null);
    };

    const handleSaveRoleSheet = async () => {
        if (!role) return;
        setTextError(null);
        
        if (!textStr.trim() && !nameRole.trim()) {
            setTextError(t(locale, "roles.dashboard.sheetEmptyError", "Le contenu ou le nom du poste ne peut pas être vide."));
            return;
        }

        setSheetSaving(true);
        const ok = await saveRolePostSheet(role.roleId, {
            fullForm: { 
                name_role: nameRole,
                localisation: localisation,
                start_date: startDate,
                end_date: endDate,
                instruction_ia: instructionIA,
                role_content: textStr 
            },
        });

        setSheetSaving(false);
        if (ok) {
            await loadData();
        } else {
            alert(t(locale, "roles.dashboard.saveSheetFailed", "Échec de l'enregistrement de la fiche de poste. Réessayez."));
        }
    };

    // Derived Data
    const filtered = applications
        .filter((app) => {
            const matchSearch = app.candidateName.toLowerCase().includes(search.toLowerCase());
            const matchFilter =
                filter === "ALL" ||
                (filter === "SCORE"
                    ? typeof app.matchScore === "number" && app.matchScore > 0 && app.matchScore >= scoreThreshold
                    : app.status === filter);

            return matchSearch && matchFilter;
        })
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    const validatedCount = applications.filter(a => a.status === 'VALIDATED').length;
    const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;
    const processingCount = applications.filter(a => a.status === 'ANALYSING' || a.status === 'PENDING').length;
    const analysedCount = applications.filter(a => a.status !== 'ANALYSING' && a.status !== 'PENDING').length;
    // Only count as "fully analysed" when ALL candidates loaded and none pending
    const fullyAnalysed = !hasMore && processingCount === 0;
    // Estimated pending: loaded pending + unloaded candidates (conservative)
    const estimatedPending = processingCount + (hasMore ? totalApps - applications.length : 0);

    // Drawer Navigation
    const openDrawer = (appId: string) => {
        const idx = filtered.findIndex(a => a.applicationId === appId);
        if (idx !== -1) {
            setCurrentAppIndex(idx);
            setDrawerOpen(true);
        }
    };

    if (loading) return (
        <div className="max-w-6xl mx-auto py-10 flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-4 text-[var(--text-muted)]">
                <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
                <p className="font-bold font-display">{t(locale, "roles.dashboard.loading", "Loading Decision Command Center...")}</p>
            </div>
        </div>
    );

    if (!role) return (
        <div className="max-w-6xl mx-auto py-10 text-center text-[var(--text-muted)] font-bold">
            {t(locale, "roles.dashboard.notFound", "Role not found.")}
        </div>
    );

    // Shared cell renderers — used by the desktop table and the mobile card list.
    const renderMatchScore = (app: (typeof filtered)[number]) => (
        typeof app.matchScore === 'number' ? (
            app.matchScore === 0 ? (
                <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg w-max">
                    <AlertCircle className="w-4 h-4 min-w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">{t(locale, "roles.dashboard.aiFailed", "AI Failed")}</span>
                </div>
            ) : (
                <div className="flex items-center gap-3 w-full lg:w-48">
                    <div className="flex-1 h-2 bg-[var(--accent)]/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-[var(--accent)] rounded-full"
                            style={{ width: `${Math.round(app.matchScore > 1 ? app.matchScore : app.matchScore * 100)}%` }}
                        />
                    </div>
                    <span className="font-bold text-[var(--accent)] text-sm w-8">{Math.round(app.matchScore > 1 ? app.matchScore : app.matchScore * 100)}%</span>
                </div>
            )
        ) : (
            <span className="text-xs font-bold text-[var(--text-muted)] italic">{t(locale, "roles.dashboard.pendingAi", "Pending AI...")}</span>
        )
    );

    const renderActions = (app: (typeof filtered)[number]) => (
        <div className="flex items-center justify-end gap-2 flex-wrap opacity-100 lg:opacity-60 group-hover:opacity-100 transition-opacity">
            {app.status === 'FINISHED' || app.status === 'VALIDATED' || app.status === 'REJECTED' ? (
                <>
                    <button
                        title={t(locale, "kanban.viewReport", "View DNA Report")}
                        onClick={() => router.push(appReportPath(app.applicationId))}
                        className="p-2 rounded-lg text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--border)] hover:text-[var(--accent)] transition-all shadow-sm"
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                    <Link
                        href={
                            hasUsableId(app.candidateId)
                                ? `${candidateInterviewsPath(app.candidateId!)}?applicationId=${app.applicationId}`
                                : appInterviewPath(app.applicationId)
                        }
                        title={t(locale, "kanban.scheduleInterview", "Schedule Interview")}
                        className="p-2 rounded-lg text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--border)] hover:text-blue-400 transition-all shadow-sm"
                    >
                        <Calendar className="w-5 h-5" />
                    </Link>
                </>
            ) : (
                <>
                    <span
                        className="p-2 rounded-lg text-[var(--text-muted)]/30 border border-transparent cursor-not-allowed"
                        aria-hidden="true"
                    >
                        <Eye className="w-5 h-5" />
                    </span>
                    <span
                        className="p-2 rounded-lg text-[var(--text-muted)]/30 border border-transparent cursor-not-allowed"
                        aria-hidden="true"
                    >
                        <Calendar className="w-5 h-5" />
                    </span>
                </>
            )}
            <button
                title={t(locale, "roles.dashboard.actions.relaunch", "Relaunch AI matching")}
                onClick={() => handleRelaunchCandidateMatching(app.applicationId)}
                disabled={relaunchingApplicationId === app.applicationId}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-50"
            >
                <RefreshCcw className={`w-5 h-5 ${relaunchingApplicationId === app.applicationId ? "animate-spin" : ""}`} />
            </button>
            <button
                title={t(locale, "roles.dashboard.actions.viewForm", "View candidate submitted form")}
                onClick={() => {
                    setApplicationModalId(app.applicationId);
                    setApplicationModalOpen(true);
                }}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
            >
                <FileText className="w-5 h-5" />
            </button>
            {(app.status === "VALIDATED" || app.status === "REJECTED") && (
                <button
                    title={t(locale, "roles.dashboard.actions.undo", "Standby (Undo decision)")}
                    onClick={() => handleStatusChange(app.applicationId, "FINISHED")}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
            )}
            <button
                title={t(locale, "roles.dashboard.actions.validate", "Validate Candidate")}
                onClick={() => handleStatusChange(app.applicationId, "VALIDATED")}
                className={`p-2 rounded-lg transition-colors ${app.status === "VALIDATED" ? "text-emerald-400 bg-emerald-400/10 pointer-events-none" : "text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-400/10"}`}
            >
                <Check className="w-5 h-5" />
            </button>
            <button
                title={t(locale, "roles.dashboard.actions.reject", "Reject Candidate")}
                onClick={() => handleStatusChange(app.applicationId, "REJECTED")}
                className={`p-2 rounded-lg transition-colors ${app.status === "REJECTED" ? "text-red-400 bg-red-400/10 pointer-events-none" : "text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10"}`}
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-32">
            {/* Nav */}
            <Link href={ROUTES.company.recruitment.roles} className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent)] font-bold text-sm transition-colors mb-2">
                <ArrowLeft className="w-4 h-4" />
                {t(locale, "roles.dashboard.back", "Back to Roles")}
            </Link>

            {/* Role Header */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/[0.06] blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none" />
                
                <div className="space-y-4 relative z-10">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-[var(--text-primary)] tracking-tight">
                        {role.roleDna?.fullFormSnapshot?.name_role || role.title || t(locale, "roles.dashboard.untitled", "Role to complete")}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-[var(--text-secondary)] text-sm font-medium">
                        <span className="flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-1.5 rounded-full">
                            <MapPin className="w-4 h-4 text-[var(--accent)]" />
                            {(() => {
                                const snapshotLocation = role.roleDna?.fullFormSnapshot?.localisation;
                                const isPlaceholder = typeof snapshotLocation === "string"
                                    && ["other", "autre", "other - other", "autre - autre"].includes(snapshotLocation.toLowerCase().trim());
                                return (!isPlaceholder && snapshotLocation) || role.location || t(locale, "roles.dashboard.locationPlaceholder", "Complete Job Post Sheet to add location");
                            })()}
                        </span>
                        <span className="flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-1.5 rounded-full">
                            <Clock className="w-4 h-4 text-[var(--accent)]" />
                            {role.status === "ACTIVE" ? t(locale, "roles.dashboard.activePipeline", "Active Pipeline")
                                : role.status === "DRAFT" ? t(locale, "roles.status.draft", "BROUILLON")
                                : role.status === "CANCELLED" ? t(locale, "roles.status.cancelled", "ANNULÉ")
                                : role.status === "CLOSED" ? t(locale, "roles.status.closed", "FERMÉ")
                                : role.status}
                        </span>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 relative z-10">
                    <button
                        onClick={copyRoleLink}
                        className={`w-full sm:w-auto px-5 py-3 sm:px-6 sm:py-4 rounded-2xl font-bold border transition-all flex items-center justify-center gap-2 ${copied
                            ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                            : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                        }`}
                    >
                        {copied ? <Check className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
                        {copied ? t(locale, "roles.dashboard.copied", "Copied!") : t(locale, "roles.dashboard.share", "Share Custom Link")}
                    </button>
                    <div className="text-center px-4 sm:px-6 border-t sm:border-t-0 sm:border-l border-[var(--border)] pt-3 sm:pt-0">
                        <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mb-1">{t(locale, "roles.dashboard.totalPipeline", "Total Pipeline")}</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-[var(--accent)]">{totalApps || applications.length}</p>
                    </div>
                </div>
            </div>

            {/* AI Evaluation Bar */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
                <div className="p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4 shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                        <Target className="w-6 h-6 text-[var(--accent)]" />
                    </div>
                    <div>
                        <h2 className="text-[var(--text-primary)] font-display font-bold tracking-tight flex items-center gap-2">
                            {t(locale, "roles.dashboard.evaluationStatus", "AI Evaluation Status")}
                            {evaluating && <ScaleLoader />}
                        </h2>
                        <p className="text-[var(--text-muted)] text-sm font-medium mt-1">{t(locale, "roles.dashboard.evaluationSubtitle", "Cross-referencing candidate DNA with role requirements.")}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="flex-1 text-right flex items-center gap-4">
                        <div className="w-48 h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden shrink-0">
                            <div 
                                className="h-full bg-[var(--accent)] transition-all duration-1000 ease-out" 
                                style={{ width: totalApps > 0 ? `${(analysedCount / totalApps) * 100}%` : '0%' }}
                            />
                        </div>
                        <span className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">{t(locale, "roles.dashboard.analysedCount", "{{analysed}}/{{total}} Analysed", { analysed: analysedCount, total: totalApps })}</span>
                    </div>
                    <button
                        onClick={handleEvaluateAll}
                        disabled={evaluating || fullyAnalysed}
                        className={`px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shrink-0 uppercase text-sm tracking-wide min-w-[200px] ${evaluating
                            ? "bg-amber-500/20 border-2 border-amber-500/30 text-amber-400 cursor-wait"
                            : fullyAnalysed
                            ? "bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 cursor-default"
                            : "bg-[var(--accent)] border-2 border-[var(--accent)] text-white hover:bg-orange-600 hover:border-orange-600 shadow-lg shadow-[var(--accent)]/25 cursor-pointer"
                        }`}
                    >
                        {evaluating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> {t(locale, "roles.dashboard.evaluating", "Evaluating...")} 
                            </>
                        ) : fullyAnalysed ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" /> {t(locale, "roles.dashboard.fullyAnalysed", "Fully Analysed")}
                            </>
                        ) : (
                            <>
                                <Target className="w-4 h-4" /> {t(locale, "roles.dashboard.evaluatePending", "Evaluate Pending ({{count}})", { count: estimatedPending })}
                            </>
                        )}
                    </button>
                </div>
                </div>
            </div>

            {/* Editable Role Post Sheet */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
                <button
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-[var(--bg-surface)] transition-colors"
                    onClick={() => setSheetOpen((value) => !value)}
                >
                    <div className="text-left">
                        <h2 className="font-display font-bold text-[var(--text-primary)]">{t(locale, "roles.dashboard.postSheet.title", "Role Full Description")}</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{t(locale, "roles.dashboard.postSheet.subtitle", "Review and edit the full role form before candidate ranking.")}</p>
                    </div>
                    {sheetOpen ? <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" /> : <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />}
                </button>

                {sheetOpen && (
                    <div className="border-t border-[var(--border)] p-6 bg-[var(--bg-surface)]">
                        <RoleDnaForm 
                            initialData={role.roleDna?.fullFormSnapshot || {}}
                            isUpdate={true}
                            submitLabel={t(locale, "roles.dashboard.postSheet.save", "Save Role Description")}
                            onSubmit={async (formData) => {
                                setSheetSaving(true);
                                const ok = await saveRolePostSheet(role.roleId, {
                                    fullForm: formData,
                                });
                                setSheetSaving(false);
                                if (ok) {
                                    await loadData();
                                    setSheetOpen(false);
                                } else {
                                    alert(t(locale, "roles.dashboard.saveSheetFailed", "Échec de l'enregistrement de la fiche de poste. Réessayez."));
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Filters Area */}
            <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <div />
                <div className="flex items-center gap-2">
                    {applications.some(a => a.status === 'VALIDATED' || a.status === 'REJECTED') && (
                        <Link
                            href={roleFinalizeListPath(id)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/40 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all"
                        >
                            <Send className="w-3.5 h-3.5" />
                            {t(locale, "finalize.finalizeSelection", "Finaliser la sélection")}
                        </Link>
                    )}
                </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {FILTER_TABS.map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setFilter(tab.value)}
                                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${filter === tab.value
                                    ? "bg-white/[0.1] text-[var(--text-primary)] border border-white/[0.1] shadow-glow-sm cursor-default pointer-events-none"
                                    : "text-[var(--text-muted)] border border-transparent hover:border-[var(--border)] hover:text-[var(--text-secondary)]"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                </div>

                <div className="relative w-full md:w-64 shrink-0">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                        type="text"
                        placeholder={t(locale, "applications.search.placeholder", "Search candidate...")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="glass-input w-full pl-11 pr-4 py-3"
                    />
                </div>
            </div>
            {filter === "SCORE" && (
                <div className="flex items-center gap-4 px-1 py-1">
                    <span className="text-xs font-bold text-[var(--text-muted)] whitespace-nowrap">
                        {t(locale, "roles.dashboard.filter.scoreMin", "Score minimum :")}
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={scoreThreshold}
                        onChange={(e) => setScoreThreshold(Number(e.target.value))}
                        className="flex-1 accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="text-sm font-bold text-[var(--accent)] w-12 text-right">{scoreThreshold}%</span>
                </div>
            )}
            </div>

            {/* Talent Pipeline View */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] overflow-hidden">
                    <div className="p-6 border-b border-[var(--border)]">
                        <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">{t(locale, "roles.dashboard.leaderboard", "Talent Leaderboard")}</h2>
                    </div>
                    
                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={<Users className="w-6 h-6" />}
                            title={t(locale, "roles.dashboard.noMatches", "No candidates match your filter")}
                            description={t(locale, "roles.dashboard.noMatchesHint", "Try clearing the search or changing the status filter.")}
                        />
                    ) : (
                        <>
                        <div className="overflow-x-auto hidden lg:block">
                            <table className="w-full text-left border-collapse glass-table">
                                <thead>
                                    <tr>
                                        <th>{t(locale, "roles.dashboard.table.rank", "# Rank")}</th>
                                        <th>{t(locale, "roles.dashboard.table.candidate", "Candidate")}</th>
                                        <th>{t(locale, "roles.dashboard.table.matchScore", "Match Score")}</th>
                                        <th>{t(locale, "roles.dashboard.table.status", "Status")}</th>
                                        <th className="text-right">{t(locale, "roles.dashboard.table.actions", "Actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((app, index) => (
                                        <tr
                                            key={app.applicationId}
                                            className="group cursor-pointer hover:bg-[var(--bg-raised)] transition-colors"
                                            onClick={() => router.push(roleWithAppPath(id, app.applicationId))}
                                        >
                                            <td className="text-sm font-bold text-[var(--text-muted)]">
                                                {index + 1}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
                                                        {getInitials(app.candidateName)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[var(--text-primary)] font-bold">{app.candidateName}</p>
                                                        <p className="text-[var(--text-muted)] text-[11px] font-bold mt-0.5 uppercase tracking-wide flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {relativeTime(app.submittedAt, locale)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{renderMatchScore(app)}</td>
                                            <td>
                                                <StatusBadge status={app.status} size="sm" />
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>{renderActions(app)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile: card list (table is hidden < lg) */}
                        <div className="lg:hidden divide-y divide-[var(--border)]">
                            {filtered.map((app, index) => (
                                <div key={app.applicationId} className="p-4 space-y-3 cursor-pointer hover:bg-[var(--bg-raised)] transition-colors"
                                    onClick={() => router.push(roleWithAppPath(id, app.applicationId))}>
                                    <div className="flex items-start gap-3">
                                        <span className="text-xs font-bold text-[var(--text-muted)] w-5 pt-2.5 flex-shrink-0">{index + 1}</span>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
                                            {getInitials(app.candidateName)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[var(--text-primary)] font-bold truncate">{app.candidateName}</p>
                                            <p className="text-[var(--text-muted)] text-[11px] font-bold mt-0.5 uppercase tracking-wide flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {relativeTime(app.submittedAt, locale)}
                                            </p>
                                        </div>
                                        <StatusBadge status={app.status} size="sm" />
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()}>
                                        {renderMatchScore(app)}
                                        {renderActions(app)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        </>
                    )}
                </div>

            {/* Load more sentinel for infinite scroll */}
            <div ref={loadMoreRef} className="flex justify-center py-4">
                {hasMore && (
                    <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-8 py-3 rounded-xl font-bold flex items-center gap-2 bg-[var(--bg-surface)] border-2 border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent-dim)] hover:border-[var(--accent)] transition-all shadow-sm"
                    >
                        {loadingMore ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
                        ) : (
                            <>Afficher plus de candidats</>
                        )}
                    </button>
                )}
            </div>

            {/* Pipeline banner hidden — waves feature cached */}

            {/* Candidate DNA Drawer */}
            <CandidateDrawer 
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                applicationId={filtered[currentAppIndex]?.applicationId || null}
                onNavigateNext={() => setCurrentAppIndex(Math.min(filtered.length - 1, currentAppIndex + 1))}
                onNavigatePrev={() => setCurrentAppIndex(Math.max(0, currentAppIndex - 1))}
                hasNext={currentAppIndex < filtered.length - 1}
                hasPrev={currentAppIndex > 0}
                onStatusChange={handleStatusChange}
            />

            <CandidateApplicationModal
                isOpen={applicationModalOpen}
                onClose={() => setApplicationModalOpen(false)}
                applicationId={applicationModalId}
            />

            {/* Application drawer — opened by clicking a candidate row (?app= in URL) */}
            {(() => {
                const selectedIndex = filtered.findIndex(a => a.applicationId === selectedAppId);
                return (
                    <ApplicationDrawer
                        appId={selectedAppId}
                        onClose={() => router.push(rolePath(id))}
                        onNext={selectedIndex < filtered.length - 1
                            ? () => router.push(roleWithAppPath(id, filtered[selectedIndex + 1].applicationId))
                            : undefined}
                        onPrev={selectedIndex > 0
                            ? () => router.push(roleWithAppPath(id, filtered[selectedIndex - 1].applicationId))
                            : undefined}
                        hasNext={selectedIndex >= 0 && selectedIndex < filtered.length - 1}
                        hasPrev={selectedIndex > 0}
                    />
                );
            })()}
        </div>
    );
}

// Simple tiny loader for the evaluation text
function ScaleLoader() {
    return (
        <div className="flex gap-1 ml-2">
            <div className="w-1 h-3 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1 h-3 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1 h-3 bg-[var(--accent)] rounded-full animate-bounce"></div>
        </div>
    );
}
