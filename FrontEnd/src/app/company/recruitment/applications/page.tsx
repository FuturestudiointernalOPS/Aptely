"use client";
import { ROUTES, appPath } from "@/lib/routes";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAllApplications, type Application } from "@/lib/api";
import { useRequireInstitution } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import { Users, Search, Filter, ArrowUpRight, Briefcase, Calendar, User2, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";

const FILTERS = ["ALL", "PENDING", "ANALYSING", "FINISHED", "VALIDATED", "REJECTED", "STOPPED"] as const;
type StatusFilter = (typeof FILTERS)[number];

function formatDate(dateIso: string, locale: string): string {
    if (!dateIso) return "—";
    const dateLocale = locale === "en" ? "en-US" : "fr-FR";
    return new Date(dateIso).toLocaleDateString(dateLocale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
}

function statusBadge(status: string): string {
    switch (status) {
        case "VALIDATED":
            return "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20";
        case "REJECTED":
            return "bg-rose-400/10 text-rose-400 border border-rose-400/20";
        case "ANALYSING":
            return "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20";
        case "PENDING":
            return "bg-amber-400/10 text-amber-400 border border-amber-400/20";
        case "FINISHED":
            return "bg-blue-400/10 text-blue-400 border border-blue-400/20";
        case "STOPPED":
            return "bg-slate-400/10 text-slate-400 border border-slate-400/20";
        default:
            return "bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border)]";
    }
}

export default function ApplicationsPage() {
    useRequireInstitution();
    const locale = getClientLocale();

    const [loading, setLoading] = useState(true);
    const [applications, setApplications] = useState<Application[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<StatusFilter>("ALL");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const data = await getAllApplications();
            setApplications(data);
            setLoading(false);
        };
        load();
    }, []);

    const filtered = useMemo(() => {
        return applications.filter((application) => {
            const statusOk = status === "ALL" || application.status === status;
            const searchText = `${application.candidateName} ${application.roleTitle}`.toLowerCase();
            const searchOk = !search || searchText.includes(search.toLowerCase());
            return statusOk && searchOk;
        });
    }, [applications, search, status]);

    const getStatusLabel = (value: string) => {
        const keyMap: Record<string, string> = {
            ALL: "applications.status.all",
            PENDING: "applications.status.pending",
            ANALYSING: "applications.status.analysing",
            FINISHED: "applications.status.finished",
            VALIDATED: "applications.status.validated",
            REJECTED: "applications.status.rejected",
            STOPPED: "applications.status.stopped",
        };
        return t(locale, keyMap[value] || "applications.status.unknown", value);
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-10">
            {/* Header */}
            <PageHeader
                className="animate-fade-in-up"
                icon={<Users className="w-5 h-5 text-[var(--accent)]" />}
                title={t(locale, "applications.title", "Applications")}
                subtitle={t(locale, "applications.subtitle", "Track applications and pipeline transitions.")}
                actions={
                    !loading ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">{t(locale, "applications.total", "Total")}</span>
                            <span className="text-sm font-display font-bold text-[var(--text-primary)]">{filtered.length}</span>
                        </div>
                    ) : undefined
                }
            />

            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            id="applications-search"
                            name="applications-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t(locale, "applications.search.placeholder", "Search candidate or role...")}
                            className="glass-input w-full pl-10"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                        <select
                            id="applications-status-filter"
                            name="applications-status-filter"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as StatusFilter)}
                            className="glass-input w-full pl-10 appearance-none"
                        >
                            {FILTERS.map((filter) => (
                                <option key={filter} value={filter}>
                                    {getStatusLabel(filter)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="divide-y divide-[var(--border)]">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5">
                                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-3.5 w-44" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                                <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={<Users className="w-6 h-6" />}
                        title={status !== "ALL" || search
                            ? t(locale, "applications.empty.filteredTitle", "Aucune candidature pour ce filtre")
                            : t(locale, "applications.empty.title", "No applications found")}
                        description={status !== "ALL" || search
                            ? t(locale, "applications.empty.filteredSubtitle", "Modifiez les filtres ou effacez la recherche pour voir d'autres candidatures.")
                            : t(locale, "applications.empty.subtitle", "Adjust filters or create a role to start receiving applications.")}
                        action={status !== "ALL" || search ? (
                            <button
                                onClick={() => { setStatus("ALL"); setSearch(""); }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-sm font-semibold hover:bg-[var(--accent)] hover:text-white transition-all"
                            >
                                <Filter className="w-4 h-4" />
                                {t(locale, "applications.empty.clearFilters", "Effacer les filtres")}
                            </button>
                        ) : (
                            <Link
                                href={ROUTES.company.recruitment.rolesCreate}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-sm font-semibold hover:bg-[var(--accent)] hover:text-white transition-all"
                            >
                                <Briefcase className="w-4 h-4" />
                                {t(locale, "applications.empty.cta", "Create a role")}
                            </Link>
                        )}
                    />
                ) : (
                    <div className="divide-y divide-[var(--border)]">
                        {filtered.map((application) => (
                            <Link
                                key={application.applicationId}
                                href={appPath(application.applicationId)}
                                className="flex items-center gap-3 sm:gap-4 bg-[var(--bg-surface)] px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-[var(--bg-raised)] transition-colors group first:rounded-t-xl last:rounded-b-xl"
                            >
                                <div className="w-9 h-9 rounded-xl bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] transition-all">
                                    <User2 className="w-4 h-4 text-[var(--accent)] group-hover:text-white transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                                    <div className="min-w-0">
                                        <p className="text-[var(--text-primary)] font-semibold text-sm truncate">{application.candidateName}</p>
                                        <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs mt-0.5">
                                            <Briefcase className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{application.roleTitle || t(locale, "applications.roleFallback", "Role")}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs">
                                        <Calendar className="w-3 h-3 flex-shrink-0" />
                                        <span>{t(locale, "applications.submittedOn", "Submitted")} {formatDate(application.submittedAt, locale)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="hidden sm:flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)]">
                                        <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: application.matchScore != null ? "var(--accent)" : "var(--text-muted)" }} />
                                        <span style={{ color: application.matchScore != null ? "var(--accent)" : "var(--text-muted)" }}>
                                            {application.matchScore != null ? `${application.matchScore}%` : t(locale, "applications.iaWaiting", "IA en attente…")}
                                        </span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide ${statusBadge(application.status)}`}>
                                        {getStatusLabel(application.status)}
                                    </span>
                                    <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors hidden sm:block" style={{ opacity: 0.4 }} />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
