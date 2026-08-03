"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getInstitutionInterviews, type InstitutionInterviewListItem } from "@/lib/api";
import { getAssignedToMeInterviews, type AssignedInterview } from "@/lib/api.interviews";
import { useRequireInstitution } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { getClientLocale, t, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import {
    CalendarRange, Search, Filter, ArrowUpRight, MapPin, Clock,
    User2, Briefcase, FileText, UserCircle, AlertCircle, ChevronRight, Video,
} from "lucide-react";
import { ROUTES, interviewNotesPath } from "@/lib/routes";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const FULL_HR = ["OWNER", "ADMIN", "HR_LEAD", "STANDARD_HR"];

function formatDateTime(iso: string | null, locale: string): string {
    if (!iso) return "—";
    const tag = locale === "en" ? "en-US" : "fr-FR";
    return new Date(iso).toLocaleString(tag, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
}

function statusBadgeAll(status: string): { classes: string; label: string } {
    switch (status) {
        case "SCHEDULED": return { classes: "bg-blue-400/10 text-blue-400 border border-blue-400/20", label: status };
        case "COMPLETED": return { classes: "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20", label: status };
        case "CANCELLED": return { classes: "bg-rose-400/10 text-rose-400 border border-rose-400/20", label: status };
        case "DRAFT":     return { classes: "bg-amber-400/10 text-amber-400 border border-amber-400/20", label: status };
        default:          return { classes: "bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border)]", label: status };
    }
}

function getStatusBadgeMine(locale: Locale): Record<string, { label: string; class: string }> {
    return {
        DRAFT:     { label: t(locale, "interviewer.status.draft",     "Draft"),     class: "text-[var(--text-muted)] border-[var(--border)]" },
        SCHEDULED: { label: t(locale, "interviewer.status.scheduled", "Scheduled"), class: "text-[var(--accent)] border-[var(--accent)]/40" },
        COMPLETED: { label: t(locale, "interviewer.status.completed", "Completed"), class: "text-emerald-400 border-emerald-400/40" },
        CANCELLED: { label: t(locale, "interviewer.status.cancelled", "Cancelled"), class: "text-rose-400 border-rose-400/40" },
    };
}

function getScorecardBadge(locale: Locale): Record<string, { label: string; dot: string }> {
    return {
        NONE:      { label: t(locale, "interviewer.scorecard.none",      "Scorecard to fill"),     dot: "bg-amber-400" },
        DRAFT:     { label: t(locale, "interviewer.scorecard.draft",     "Scorecard in progress"), dot: "bg-blue-400" },
        SUBMITTED: { label: t(locale, "interviewer.scorecard.submitted", "Scorecard submitted"),   dot: "bg-emerald-400" },
        ARCHIVED:  { label: t(locale, "interviewer.scorecard.archived",  "Scorecard archived"),    dot: "bg-[var(--text-muted)]" },
    };
}

// ─── "Mes entretiens" tab ─────────────────────────────────────────────────────

type MyFilter = "ALL" | "DRAFT" | "SCHEDULED" | "COMPLETED";

function MyInterviewsTab() {
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const STATUS_BADGE = getStatusBadgeMine(locale);
    const SCORECARD_BADGE = getScorecardBadge(locale);

    const [loading, setLoading] = useState(true);
    const [interviews, setInterviews] = useState<AssignedInterview[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<MyFilter>("ALL");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const data = await getAssignedToMeInterviews();
            setInterviews(data);
            setSelectedId(data[0]?.id ?? null);
            setLoading(false);
        };
        void load();
    }, []);

    const filtered = useMemo(() => {
        const base = filter === "ALL" ? interviews : interviews.filter((i) => i.status === filter);
        return [...base].sort((a, b) => {
            const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
            const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
            return bt - at;
        });
    }, [interviews, filter]);

    const selected = useMemo(() => filtered.find((i) => i.id === selectedId) ?? null, [filtered, selectedId]);
    const pendingCount = interviews.filter(i => i.status === "SCHEDULED" && i.myScorecardStatus === "NONE").length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {pendingCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-400 text-xs font-bold w-fit">
                    <AlertCircle className="w-4 h-4" />
                    {t(locale, "interviewer.pendingScorecards", "{{count}} scorecard(s) to complete", { count: pendingCount })}
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                {(["ALL", "SCHEDULED", "COMPLETED", "DRAFT"] as MyFilter[]).map((s) => (
                    <button key={s} type="button"
                        onClick={() => { setFilter(s); setSelectedId(filtered[0]?.id ?? null); }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            filter === s
                                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"
                        }`}
                    >
                        {s === "ALL" ? tr("interviewer.filter.all", "Tous") : (STATUS_BADGE[s]?.label ?? s)}
                        {s === "ALL" && ` (${interviews.length})`}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* List */}
                <div className="xl:col-span-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        {tr("interviewer.assigned", "Entretiens assignés")}
                    </p>
                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
                            {tr("interviewer.empty", "Aucun entretien ne vous est actuellement assigné.")}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((interview) => {
                                const sc = SCORECARD_BADGE[interview.myScorecardStatus];
                                const badge = STATUS_BADGE[interview.status];
                                return (
                                    <button key={interview.id} type="button"
                                        onClick={() => setSelectedId(interview.id)}
                                        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                                            selectedId === interview.id
                                                ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                                                : "border-[var(--border)] hover:border-[var(--accent)]/40"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                                    {interview.candidateName ?? tr("interview.scheduler.default.candidate", "Candidat")}
                                                </p>
                                                <p className="text-xs text-[var(--text-secondary)] truncate">{interview.roleTitle ?? "—"}</p>
                                                <p className="text-xs text-[var(--text-muted)] mt-1">{formatDateTime(interview.scheduledAt, locale)}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${badge?.class ?? "text-[var(--text-muted)] border-[var(--border)]"}`}>
                                                    {badge?.label ?? interview.status}
                                                </span>
                                                {interview.status === "SCHEDULED" && sc && (
                                                    <div className="flex items-center gap-1">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                        <span className="text-[10px] text-[var(--text-muted)]">{sc.label}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        {tr("interviewer.focus", "Entretien sélectionné")}
                    </p>
                    {selected ? (
                        <>
                            <div className="rounded-xl border border-[var(--border)] p-3 space-y-1">
                                <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.candidateName ?? tr("interview.scheduler.default.candidate", "Candidat")}</p>
                                <p className="text-xs text-[var(--text-secondary)]">{selected.roleTitle ?? "—"}</p>
                                <p className="text-xs text-[var(--text-muted)]">{formatDateTime(selected.scheduledAt, locale)}</p>
                                <p className="text-xs text-[var(--text-muted)]">{selected.durationMinutes} min · {selected.name}</p>
                                {selected.meetingLocation && (
                                    <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                        <MapPin className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{selected.meetingLocation}</span>
                                    </div>
                                )}
                                {selected.meetingLink && (
                                    <a href={selected.meetingLink} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline mt-1">
                                        <Video className="w-3 h-3 flex-shrink-0" />
                                        {tr("interviewer.joinMeeting", "Rejoindre la réunion")}
                                    </a>
                                )}
                            </div>
                            {selected.status === "SCHEDULED" && SCORECARD_BADGE[selected.myScorecardStatus] && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
                                    SCORECARD_BADGE[selected.myScorecardStatus].dot === "bg-amber-400"
                                        ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
                                        : "border-[var(--border)] text-[var(--text-muted)]"
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${SCORECARD_BADGE[selected.myScorecardStatus].dot}`} />
                                    {SCORECARD_BADGE[selected.myScorecardStatus].label}
                                </div>
                            )}
                            <Link href={interviewNotesPath(selected.applicationId, selected.id)}
                                className="w-full flex items-center justify-center gap-2 text-sm text-white bg-[var(--accent)] hover:opacity-90 font-semibold rounded-xl px-4 py-3 transition-all">
                                <FileText className="w-4 h-4" />
                                {tr("interviewer.openInterview", "Ouvrir l'entretien")}
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </>
                    ) : (
                        <p className="text-sm text-[var(--text-muted)]">{tr("interviewer.selectHint", "Sélectionnez un entretien pour voir les détails.")}</p>
                    )}
                </div>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
                <UserCircle className="w-5 h-5 text-[var(--text-secondary)]" />
                <p className="text-sm text-[var(--text-secondary)]">
                    {tr("interviewer.note", "Ce tableau affiche uniquement les entretiens où vous êtes explicitement assigné comme interviewer.")}
                </p>
            </div>
        </div>
    );
}

// ─── "Tous" tab ───────────────────────────────────────────────────────────────

type AllFilter = "ALL" | "DRAFT" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
const ALL_STATUS_FILTERS: AllFilter[] = ["ALL", "DRAFT", "SCHEDULED", "COMPLETED", "CANCELLED"];

function AllInterviewsTab() {
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);

    const [loading, setLoading] = useState(true);
    const [interviews, setInterviews] = useState<InstitutionInterviewListItem[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<AllFilter>("ALL");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const rows = await getInstitutionInterviews();
            setInterviews(rows);
            setLoading(false);
        };
        load();
    }, []);

    const filtered = useMemo(() => {
        return interviews.filter((interview) => {
            const statusOk = status === "ALL" || interview.status === status;
            const searchText = `${interview.candidateName} ${interview.roleTitle} ${interview.name}`.toLowerCase();
            const searchOk = !search || searchText.includes(search.toLowerCase());
            return statusOk && searchOk;
        });
    }, [interviews, search, status]);

    const scheduledCount = interviews.filter(i => i.status === "SCHEDULED").length;
    const completedCount = interviews.filter(i => i.status === "COMPLETED").length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
            {/* Stats */}
            {interviews.length > 0 && (
                <div className="flex items-center gap-6 pb-2 border-b border-[var(--border)]">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interviews.scheduled", "Planifiés")}</p>
                        <p className="text-lg font-bold text-blue-400">{scheduledCount}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interviews.completed", "Terminés")}</p>
                        <p className="text-lg font-bold text-emerald-400">{completedCount}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder={tr("interviews.search", "Chercher candidat, rôle ou entretien...")}
                        className="glass-input w-full pl-10" />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                    <select value={status} onChange={(e) => setStatus(e.target.value as AllFilter)}
                        className="glass-input w-full pl-10 appearance-none">
                        {ALL_STATUS_FILTERS.map((f) => (
                            <option key={f} value={f}>{tr(`interviews.status.${f}`, f)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-10">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
                        <CalendarRange className="w-7 h-7 text-[var(--text-muted)]" style={{ opacity: 0.4 }} />
                    </div>
                    <p className="text-[var(--text-primary)] font-bold">{tr("interviews.empty", "Aucun entretien trouvé")}</p>
                </div>
            ) : (
                <div className="divide-y divide-[var(--border)]">
                    {filtered.map((interview) => {
                        const badge = statusBadgeAll(interview.status);
                        return (
                            <Link key={interview.id} href={interviewNotesPath(interview.applicationId, interview.id)}
                                className="flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--bg-raised)] transition-colors group first:rounded-t-xl last:rounded-b-xl">
                                <div className="w-9 h-9 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent-dim)] group-hover:border-[var(--accent)] transition-all">
                                    <User2 className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    <div className="min-w-0">
                                        <p className="text-[var(--text-primary)] font-semibold text-sm truncate">{interview.candidateName}</p>
                                        <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs mt-0.5">
                                            <Briefcase className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{interview.roleTitle}</span>
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[var(--text-secondary)] text-xs truncate">{interview.name} · {interview.interviewType}</p>
                                        <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs mt-0.5">
                                            <Clock className="w-3 h-3 flex-shrink-0" />
                                            <span>{formatDateTime(interview.scheduledAt, locale)}</span>
                                        </div>
                                        {interview.meetingLocation && (
                                            <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs mt-0.5">
                                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{interview.meetingLocation}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide ${badge.classes}`}>
                                        {tr(`interviews.status.${interview.status}`, badge.label)}
                                    </span>
                                    <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors hidden sm:block" style={{ opacity: 0.4 }} />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "mine" | "all";

export default function InterviewsPage() {
    useRequireInstitution();

    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const { active } = useWorkspace();

    const role = active?.kind === "institution"
        ? active.membership.role_specialization
        : null;
    const hasAllTab = FULL_HR.includes(role ?? "");

    const [tab, setTab] = useState<Tab>("mine");

    return (
        <div className="space-y-6 pb-10">
            <PageHeader
                className="animate-fade-in-up"
                icon={<CalendarRange className="w-5 h-5 text-[var(--accent)]" />}
                title={tr("interviews.title", "Entretiens")}
                subtitle={tr("interviews.subtitle", "Vos entretiens assignés et tous les entretiens de l'institution.")}
            />

            {/* Tab selector — only show when user has access to both */}
            {hasAllTab && (
                <div className="flex gap-1 border-b border-[var(--border)]">
                    <button type="button" onClick={() => setTab("mine")}
                        className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                            tab === "mine"
                                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                    >
                        {tr("interviews.tab.mine", "Mes entretiens")}
                    </button>
                    <button type="button" onClick={() => setTab("all")}
                        className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                            tab === "all"
                                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                    >
                        {tr("interviews.tab.all", "Tous")}
                    </button>
                </div>
            )}

            {(!hasAllTab || tab === "mine") && <MyInterviewsTab />}
            {hasAllTab && tab === "all" && <AllInterviewsTab />}
        </div>
    );
}
