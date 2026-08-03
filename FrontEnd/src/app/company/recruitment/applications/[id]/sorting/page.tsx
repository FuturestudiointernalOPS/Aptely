"use client";
import { applicationSortedTalentApi, appEmailPreviewPath, appPath, appReportPath } from "@/lib/routes";

import { useState, useEffect } from "react";
import { getSortedTalents, SortedTalent } from "@/lib/api";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import {
    ArrowLeft,
    Eye,
    ToggleRight,
    ToggleLeft,
    Download,
    ChevronRight, Star,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function TalentSortingPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const router = useRouter();
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const [talents, setTalents] = useState<SortedTalent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSortedTalents(id).then((data) => {
            setTalents(data);
            setLoading(false);
        });
    }, [id]);

    const toggleApproval = async (talentId: string) => {
        const talent = talents.find((t) => t.talentId === talentId);
        if (!talent) return;
        // Optimistic update
        setTalents((prev) =>
            prev.map((t) => t.talentId === talentId ? { ...t, approved: !t.approved } : t)
        );
        // Persist to backend — roll back on failure
        const res = await apiFetch(applicationSortedTalentApi(id, talentId), "HR", {
            method: "PATCH",
            body: JSON.stringify({ approved: !talent.approved }),
        });
        if (res === null) {
            setTalents((prev) =>
                prev.map((t) => t.talentId === talentId ? { ...t, approved: talent.approved } : t)
            );
        }
    };

    const reviewed = talents.length;
    const approved = talents.filter((t) => t.approved === true).length;
    const aiConfidence = talents.length > 0 ? Math.round(talents.reduce((s, t) => s + (t.score || 0), 0) / talents.length) : 0;

    const handleExportSummary = () => {
        const payload = {
            applicationId: id,
            reviewed,
            approved,
            aiConfidence,
            talents,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `application-${id.slice(-6)}-summary.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <Link
                    href={appPath(id)}
                    className="flex items-center gap-2 text-[var(--accent)] font-semibold text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {tr("application.sorting.backApplication", "Application")}
                </Link>
                <div className="text-right">
                    <h1 className="text-[var(--text-primary)] font-bold text-lg">{tr("application.sorting.title", "Review talents")}</h1>
                    <p className="text-[var(--text-muted)] text-xs uppercase tracking-wide">{tr("application.sorting.application", "Application")} #{id.slice(-6).toUpperCase()}</p>
                </div>
                <button
                    onClick={() => router.push(appEmailPreviewPath(id))}
                    className="text-[var(--accent)] font-semibold text-sm hover:underline"
                >
                    {tr("application.sorting.finalize", "Finalize")}
                </button>
            </div>

            {/* Stats Row */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5  animate-fade-in-up delay-100">
                <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
                    <div className="px-4">
                        <p className="text-[var(--text-primary)] font-bold text-3xl">{reviewed}</p>
                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mt-0.5">{tr("application.sorting.reviewed", "Reviewed")}</p>
                    </div>
                    <div className="px-4">
                        <p className="text-[var(--accent)] font-bold text-3xl">{aiConfidence}%</p>
                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mt-0.5">{tr("application.sorting.aiConfidence", "AI confidence")}</p>
                    </div>
                    <div className="px-4">
                        <p className="text-[var(--text-primary)] font-bold text-3xl">{approved}</p>
                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mt-0.5">{tr("application.sorting.approved", "Approved")}</p>
                    </div>
                </div>
            </div>

            <p className="text-[var(--text-muted)] text-sm animate-fade-in-up delay-200">
                {tr("application.sorting.subtitle", "Review and refine Aptely's proof-based ranking. Approve talents to move them to the final shortlist.")}
            </p>

            {/* Talent List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border)] p-5  animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-[var(--bg-surface)]" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-[var(--bg-surface)] rounded w-1/3" />
                                    <div className="h-3 bg-[var(--bg-surface)] rounded w-1/2" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <ul className="space-y-4">
                    {talents.map((talent, i) => {
                        const isRemoved = talent.approved === false;
                        return (
                            <li
                                key={talent.talentId}
                                className={`bg-[var(--bg-surface)] border border-[var(--border)] p-5  transition-all duration-300 animate-fade-in-up ${isRemoved ? "opacity-50" : "-hover"
                                    }`}
                                style={{ animationDelay: `${i * 80}ms` }}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Rank Badge */}
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold ${i === 0
                                            ? "bg-[var(--bg-deep)] text-[var(--text-primary)]"
                                            : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                                            }`}
                                    >
                                        {i === 0 && (
                                            <span className="absolute w-5 h-5 bg-[var(--accent)] rounded-full -bottom-1 -right-1 flex items-center justify-center text-white border-2 border-white">
                                                <Star className="w-3 h-3 fill-white text-white" />
                                            </span>
                                        )}
                                        <span className="relative">{talent.rank}</span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[var(--text-primary)] font-bold">{talent.name}</p>
                                            <p className="text-[var(--accent)] font-bold text-sm">
                                                {tr("application.sorting.match", "Match")}{" "}
                                                <span className="text-xl font-display font-bold">{talent.score}</span>
                                            </p>
                                        </div>
                                        <p className="text-[var(--text-muted)] text-sm mb-2">
                                            {talent.yearsExp} {tr("application.sorting.yearsExp", "years exp")} · {talent.context}
                                        </p>
                                        <div className="flex gap-2 flex-wrap">
                                            {talent.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="px-2.5 py-1 bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-medium rounded-full"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
                                    <Link
                                        href={appReportPath(id)}
                                        className="flex items-center gap-1.5 text-[var(--text-primary)] text-sm font-medium hover:text-[var(--accent)] transition-colors"
                                    >
                                        <Eye className="w-4 h-4" />
                                        {tr("application.sorting.viewReport", "View report")}
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        {isRemoved ? (
                                            <span className="text-[var(--text-muted)] text-xs italic">{tr("application.sorting.removed", "Removed from selection")}</span>
                                        ) : (
                                            <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wide">
                                                {tr("application.sorting.approved", "Approved")}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => toggleApproval(talent.talentId)}
                                            className="transition-transform hover:scale-110"
                                        >
                                            {talent.approved ? (
                                                <ToggleRight className="w-8 h-8 text-[var(--accent)]" />
                                            ) : (
                                                <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Bottom actions */}
            <div className="flex gap-3 pb-4">
                <button
                    onClick={handleExportSummary}
                    className="flex items-center gap-2 px-6 py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
                >
                    <Download className="w-4 h-4" />
                    {tr("application.sorting.pdfSummary", "PDF summary")}
                </button>
                <Link
                    href={appEmailPreviewPath(id)}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[var(--accent)] text-white font-bold rounded-xl hover:bg-[var(--accent)]-soft transition-all shadow-none uppercase text-sm tracking-wide"
                >
                    {tr("application.sorting.confirmSend", "Confirm & send emails")}
                    <Star className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
