import { useState, useEffect } from "react";
import { getApplicationById } from "@/lib/api";
import {
    X, ChevronLeft, ChevronRight, Brain, Target, Zap, Users,
    ShieldCheck, AlertCircle, CheckCircle2, Loader2, Activity as ProgressIcon, RotateCcw
} from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import Modal from "@/components/ui/Modal";

interface CandidateDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    applicationId: string | null;
    onNavigateNext: () => void;
    onNavigatePrev: () => void;
    hasNext: boolean;
    hasPrev: boolean;
    onStatusChange: (appId: string, status: string) => void;
}

function ScoreCard({ label, value, icon: Icon, color, bg, locale }: { label: string; value: number | null; icon: React.ElementType; color: string; bg: string; locale: any }) {
    const displayValue = value !== null ? Math.round(value * 100) : "--";
    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center border border-[var(--border)]`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-xl font-display font-bold ${color}`}>{displayValue}%</p>
        </div>
    );
}

export default function CandidateDrawer({
    isOpen,
    onClose,
    applicationId,
    onNavigateNext,
    onNavigatePrev,
    hasNext,
    hasPrev,
    onStatusChange
}: CandidateDrawerProps) {
    const [appData, setAppData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const locale = getClientLocale();

    useEffect(() => {
        if (!isOpen || !applicationId) return;

        let isMounted = true;
        const loadData = async () => {
            setLoading(true);
            try {
                const data = await getApplicationById(applicationId);
                if (isMounted) {
                    setAppData(data);
                }
            } catch (err) {
                console.error("Failed to load application data:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        return () => { isMounted = false; };
    }, [isOpen, applicationId]);

    const match = appData?.match_results;
    const candidate = appData?.profiles;
    const currentStatus = appData?.status;
    const overallScore = match ? Math.round((match.final_score || match.overall_score || 0) * 100) : null;
    const aiExplanation = match?.ai_explanation || {};
    const strengths = Array.isArray(aiExplanation.strengths) ? aiExplanation.strengths : [];
    const gaps = Array.isArray(aiExplanation.gaps) ? aiExplanation.gaps : [];
    const recommendation = aiExplanation.recommendation || "";

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            slideOver
            size="md"
            headerActions={
                <div className="flex items-center gap-1">
                    <button
                        onClick={onNavigatePrev}
                        disabled={!hasPrev}
                        aria-label={t(locale, "common.previous", "Previous")}
                        className="tap p-2 rounded-lg hover:bg-[var(--bg-raised)] disabled:opacity-30 text-[var(--text-muted)]"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={onNavigateNext}
                        disabled={!hasNext}
                        aria-label={t(locale, "common.next", "Next")}
                        className="tap p-2 rounded-lg hover:bg-[var(--bg-raised)] disabled:opacity-30 text-[var(--text-muted)]"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            }
            footer={
                <div className="flex w-full gap-3">
                    <button
                        onClick={() => {
                            onStatusChange(applicationId!, "REJECTED");
                            onClose();
                        }}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${currentStatus === "REJECTED" ? "bg-red-400/10 text-red-400 border border-red-400/20" : "bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-red-400/30 hover:text-red-400"}`}
                    >
                        <X className="w-5 h-5" /> {t(locale, "candidate.drawer.reject", "REJECT")}
                    </button>
                    {(currentStatus === "VALIDATED" || currentStatus === "REJECTED") && (
                        <button
                            onClick={() => {
                                onStatusChange(applicationId!, "FINISHED");
                                onClose();
                            }}
                            aria-label={t(locale, "candidate.drawer.reopen", "Re-open")}
                            className="py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)] hover:border-amber-400/30 hover:text-amber-400"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            onStatusChange(applicationId!, "VALIDATED");
                            onClose();
                        }}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${currentStatus === "VALIDATED" ? "bg-emerald-500 text-white" : "bg-[var(--accent)] text-white hover:opacity-90"}`}
                    >
                        <CheckCircle2 className="w-5 h-5" /> {t(locale, "candidate.drawer.validate", "VALIDATE")}
                    </button>
                </div>
            }
        >
            <div className="space-y-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
                        <p className="text-[var(--text-muted)] font-bold animate-pulse">{t(locale, "candidate.drawer.preparing", "Preparing candidate evaluation...")}</p>
                    </div>
                ) : !match ? (
                    <div className="text-center py-20 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl">
                        <Brain className="w-16 h-16 text-[var(--text-muted)]/20 mx-auto mb-4" />
                        <h2 className="text-xl font-display font-bold text-[var(--text-primary)]">{t(locale, "candidate.drawer.notFound", "Analysis Not Found")}</h2>
                        <p className="text-[var(--text-muted)] mt-2">{t(locale, "candidate.drawer.notFoundHint", "The evaluation is not available for this candidate yet.")}</p>
                    </div>
                ) : (
                    <>
                        {/* Candidate Profile Header */}
                        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-display font-bold text-[var(--text-primary)] tracking-tight">{candidate?.full_name || t(locale, "common.unknown", "Unknown")}</h1>
                                <div className="flex items-center gap-3 mt-3 hidden md:flex">
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-surface)] rounded-lg text-sm font-bold text-[var(--text-primary)] border border-[var(--border)]">
                                        <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                                        {t(locale, "candidate.drawer.topCandidate", "Top {{rank}} Candidate").replace("{{rank}}", (match.rank || 1).toString())}
                                    </div>
                                    <span className="text-[var(--text-muted)]/30">•</span>
                                    <div className="text-sm font-bold text-[var(--text-muted)]">
                                        {Math.round((match.ai_confidence || 0) * 100)}% {t(locale, "candidate.drawer.matchConfidence", "Match confidence")}
                                    </div>
                                </div>
                            </div>

                            <div className="text-center">
                                <div className="relative w-24 h-24 flex items-center justify-center">
                                    <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle className="text-white/[0.06]" strokeWidth="8" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
                                        <circle
                                            className="text-[var(--accent)]"
                                            strokeWidth="8"
                                            strokeDasharray={264}
                                            strokeDashoffset={264 - (264 * (overallScore || 0)) / 100}
                                            strokeLinecap="round"
                                            stroke="currentColor"
                                            fill="transparent"
                                            r="42" cx="50" cy="50"
                                        />
                                    </svg>
                                    <div className="text-center">
                                        <span className="text-3xl font-display font-bold block leading-none text-[var(--text-primary)]">{overallScore}</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{t(locale, "candidate.drawer.match", "Match")}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Score Breakdown Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <ScoreCard label={t(locale, "candidate.drawer.roleFit", "Role Fit")} value={match.role_fit} icon={Target} color="text-emerald-400" bg="bg-emerald-400/10" locale={locale} />
                            <ScoreCard label={t(locale, "candidate.drawer.skillValidity", "Skill Validity")} value={match.skill_validity} icon={Zap} color="text-amber-400" bg="bg-amber-400/10" locale={locale} />
                            <ScoreCard label={t(locale, "candidate.drawer.envFit", "Env. Fit")} value={match.environment_fit} icon={Users} color="text-blue-400" bg="bg-blue-400/10" locale={locale} />
                            <ScoreCard label={t(locale, "candidate.drawer.motivation", "Motivation")} value={match.motivation_fit} icon={ProgressIcon} color="text-purple-400" bg="bg-purple-400/10" locale={locale} />
                        </div>

                        {/* Strengths & Gaps */}
                        <div className="grid grid-cols-1 gap-6">
                            {strengths.length > 0 && (
                                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-6 relative overflow-hidden border-emerald-400/10">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <CheckCircle2 className="w-20 h-20 text-emerald-400" />
                                    </div>
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        {t(locale, "candidate.drawer.signals", "Top Selection Signals")}
                                    </h3>
                                    <ul className="space-y-3 relative z-10">
                                        {strengths.map((s: string, idx: number) => (
                                            <li key={idx} className="flex gap-3 items-start">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{s}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {gaps.length > 0 && (
                                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <AlertCircle className="w-20 h-20 text-[var(--text-muted)]" />
                                    </div>
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-[var(--text-muted)]" />
                                        {t(locale, "candidate.drawer.consideration", "Points for Consideration")}
                                    </h3>
                                    <ul className="space-y-3 relative z-10">
                                        {gaps.map((g: string, idx: number) => (
                                            <li key={idx} className="flex gap-3 items-start">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-t-muted flex-shrink-0" />
                                                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{g}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Final Recommendation */}
                        {recommendation && (
                            <div className="bg-[var(--accent)]/[0.06] border border-[var(--accent)]/20 rounded-3xl p-6 relative">
                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--accent)] mb-2 block">
                                    {t(locale, "candidate.drawer.recommendation", "Final Recommendation")}
                                </span>
                                <p className="text-[var(--text-primary)] text-base leading-relaxed italic bg-[var(--accent-dim)] rounded-xl px-4 py-3">
                                    &quot;{recommendation}&quot;
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}
