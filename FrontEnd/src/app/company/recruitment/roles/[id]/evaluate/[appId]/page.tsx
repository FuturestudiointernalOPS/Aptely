"use client";
import { rolePath, roleFinalizePath } from "@/lib/routes";

import { useState, useEffect } from "react";
import { getApplicationById } from "@/lib/api";
import { useRequireInstitution } from "@/lib/auth";
import { 
    Brain, 
    Target, 
    Zap, 
    ShieldCheck, 
    Users, 
    Clock, 
    TrendingUp, 
    CheckCircle2, 
    AlertCircle, 
    User,
    Briefcase,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Activity as ProgressIcon,
    Award
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getClientLocale, t } from "@/lib/i18n";


interface ScoreCardProps {
    label: string;
    value: number | null;
    icon: any;
    color: string;
    bg: string;
}

function ScoreCard({ label, value, icon: Icon, color, bg }: ScoreCardProps) {
    const locale = getClientLocale();
    const displayValue = value !== null ? Math.round(value * 100) : "--";
    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 border border-[var(--border)] shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-display font-bold ${color}`}>{displayValue}%</p>
            </div>
        </div>
    );
}

export default function CapabilityMappingPage() {
    useRequireInstitution();
    
    const routeParams = useParams<{ id: string; appId: string }>();
    const roleId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
    const appId = Array.isArray(routeParams.appId) ? routeParams.appId[0] : routeParams.appId;
    const [loading, setLoading] = useState(true);
    const [appData, setAppData] = useState<any>(null);
    const locale = getClientLocale();

    useEffect(() => {
        const loadData = async () => {
            if (!appId) {
                setLoading(false);
                return;
            }
            try {
                const response = await getApplicationById(appId);
                setAppData(response);
            } catch (err) {
                console.error("[Page] Error:", err);
            }
            setLoading(false);
        };

        loadData();
    }, [appId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <Loader2 className="w-12 h-12 text-[var(--accent)] animate-spin" />
                <p className="text-[var(--text-muted)] font-bold animate-pulse">{t(locale, "evaluate.preparing", "Preparing candidate evaluation...")}</p>
            </div>
        );
    }

    const match = appData?.match_results;
    const candidate = appData?.profiles;
    const role = appData?.roles;
    
    if (!match) {
        return (
            <div className="max-w-2xl mx-auto mt-20 text-center p-10 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl border border-[var(--border)] shadow-xl">
                <Brain className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t(locale, "evaluate.notFound", "Analysis Not Found")}</h1>
                <p className="text-[var(--text-muted)] mt-2">{t(locale, "evaluate.notFoundHint", "The evaluation is not available for this application yet.")}</p>
                <Link href={rolePath(roleId)} className="mt-6 inline-flex items-center gap-2 text-[var(--accent)] font-bold hover:underline">
                    <ChevronLeft className="w-4 h-4" /> {t(locale, "evaluate.backToRole", "Back to Role")}
                </Link>
            </div>
        );
    }

    const overallScore = Math.round((match.final_score || match.overall_score || 0) * 100);
    const aiExplanation = match.ai_explanation || {};
    const gaps = Array.isArray(aiExplanation.gaps) ? aiExplanation.gaps : [];
    const strengths = Array.isArray(aiExplanation.strengths) ? aiExplanation.strengths : [];
    const recommendation = aiExplanation.recommendation || "";

    const isAiFailed = overallScore === 0 && recommendation.toLowerCase().includes("failed");

    if (isAiFailed) {
        return (
            <div className="max-w-2xl mx-auto mt-20 text-center p-12 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl border border-red-500/20 shadow-xl bg-red-500/5">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                     <h1 className="text-3xl font-display font-bold text-red-500 mb-4">{t(locale, "evaluate.failed", "Evaluation Failed")}</h1>
                <p className="text-[var(--text-primary)] text-lg font-medium mb-2">
                         "{gaps[0] || t(locale, "evaluate.errorDefault", "The evaluation engine encountered an error while processing this candidate profile.")}"
                </p>
                <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto mb-8">
                         {t(locale, "evaluate.errorHint", "This usually occurs due to malformed input data or a timeout. Please return to the selection pipeline and click refresh to relaunch the evaluation.")}
                </p>
                <Link href={rolePath(roleId)} className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold rounded-xl transition-colors">
                    <ChevronLeft className="w-5 h-5" /> {t(locale, "evaluate.backToPipeline", "Back to Candidate Pipeline")}
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4 sm:px-0">
            {/* Nav */}
            <nav className="flex items-center justify-between">
                <Link 
                    href={rolePath(roleId)}
                    className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-bold text-sm"
                >
                    <ChevronLeft className="w-4 h-4" />
                    {t(locale, "evaluate.backToSelection", "Back to Selection")}
                </Link>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-400/10 text-emerald-400 rounded-full text-[10px] font-display font-bold uppercase tracking-widest border border-emerald-400/20">
                    <ShieldCheck className="w-3 h-3" />
                    {t(locale, "evaluate.badge", "Candidate Evaluation")}
                </div>
            </nav>

            {/* Header Section */}
            <div className="bg-[var(--bg-deep)] rounded-[2rem] p-8 sm:p-12 text-[var(--text-primary)] relative overflow-hidden shadow-2xl">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] rounded-xl text-xs font-bold text-[var(--accent)]/80 border border-white/5">
                            <Brain className="w-4 h-4" />
                            {t(locale, "evaluate.capability", "Capability Mapping")}
                        </div>
                        <div>
                            <h1 className="text-4xl font-display font-bold tracking-tight">{candidate?.full_name || t(locale, "evaluate.defaultAnalysis", "Candidate Analysis")}</h1>
                            <p className="text-[var(--text-muted)] mt-2 text-lg font-medium">{t(locale, "evaluate.evaluationFor", "Evaluation for")} <span className="text-[var(--accent)] font-bold">{role?.title || t(locale, "evaluate.defaultRole", "Job post")}</span></p>
                        </div>
                        <div className="flex items-center gap-6 pt-2">
                            <div className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-yellow-400" />
                                <span className="text-sm font-bold">{t(locale, "evaluate.topCandidate", "Top {rank} Candidate", { rank: match.rank || 1 })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                                <span className="text-sm font-bold">{t(locale, "evaluate.matchConfidence", "{confidence}% Match confidence", { confidence: Math.round((match.ai_confidence || 0) * 100) })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-8 bg-[var(--bg-surface)] rounded-[2rem] border border-[var(--border)]">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle className="text-white/10" strokeWidth="8" stroke="currentColor" fill="transparent" r="42" cx="50" cy="50" />
                                <circle 
                                    className="text-[var(--accent)]" 
                                    strokeWidth="8" 
                                    strokeDasharray={264}
                                    strokeDashoffset={264 - (264 * overallScore) / 100}
                                    strokeLinecap="round" 
                                    stroke="currentColor" 
                                    fill="transparent" 
                                    r="42" cx="50" cy="50" 
                                />
                            </svg>
                             <div className="text-center">
                                <span className="text-4xl font-display font-bold block leading-none">{overallScore}</span>
                                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-[var(--accent)]">{t(locale, "evaluate.match", "Match")}</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Decorative background blobs */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/20 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/100/10 blur-[100px] -ml-32 -mb-32 rounded-full"></div>
            </div>

            {/* Score Breakdown Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ScoreCard label={t(locale, "evaluate.roleFit", "Role Fit")} value={match.role_fit} icon={Target} color="text-emerald-500" bg="bg-emerald-400/10" />
                <ScoreCard label={t(locale, "evaluate.skillValidity", "Skill Validity")} value={match.skill_validity} icon={Zap} color="text-amber-400" bg="bg-amber-400/10" />
                <ScoreCard label={t(locale, "evaluate.envFit", "Env. Fit")} value={match.environment_fit} icon={Users} color="text-blue-400" bg="bg-blue-400/10" />
                <ScoreCard label={t(locale, "evaluate.motivation", "Motivation")} value={match.motivation_fit} icon={ShieldCheck} color="text-purple-400" bg="bg-purple-400/10" />
            </div>

            {/* Evaluation Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-8  border border-emerald-400/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-24 h-24 text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, "evaluate.topSignals", "Top Selection Signals")}</h3>
                    </div>
                    <ul className="space-y-4">
                        {strengths.map((s: string, idx: number) => (
                            <li key={idx} className="flex gap-4 items-start">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400/100 flex-shrink-0" />
                                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{s}</p>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Gaps */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-8  border border-[var(--border)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <AlertCircle className="w-24 h-24 text-[var(--text-muted)]" />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-[var(--text-muted)]" />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, "evaluate.consideration", "Points for Consideration")}</h3>
                    </div>
                    <ul className="space-y-4">
                        {gaps.map((g: string, idx: number) => (
                            <li key={idx} className="flex gap-4 items-start">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-t-muted flex-shrink-0" />
                                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{g}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Final Recommendation */}
            <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/10 rounded-[2rem] p-8 sm:p-10  relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-[var(--accent)] flex items-center justify-center flex-shrink-0 shadow-none">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <div className="space-y-3">
                        <span className="text-[10px] font-display font-bold tracking-[0.2em] uppercase text-[var(--accent)]">{t(locale, "evaluate.finalRecommendation", "Final Recommendation")}</span>
                        <h3 className="text-2xl font-bold text-[var(--text-primary)]">{t(locale, "evaluate.selectionRuling", "The Selection Ruling")}</h3>
                        <p className="text-lg text-[var(--text-primary)] leading-relaxed italic bg-[var(--accent-dim)] rounded-xl px-6 py-4">
                            "{recommendation}"
                        </p>
                    </div>
                </div>
            </div>

            {/* Talent DNA Snapshot Details */}
            {match.talent_dna_snapshot && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2rem] p-8  border border-[var(--border)] space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center">
                                <Target className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, "evaluate.talentDna", "Talent DNA Snapshot")}</h3>
                        </div>
                        <div className="text-xs font-bold text-[var(--text-muted)] capitalize">
                            {t(locale, "evaluate.source", "Source: {source} profile", { source: match.talent_dna_snapshot.talent_identity?.workAuth || t(locale, "evaluate.candidate", "Candidate") })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Profile Summary */}
                        <div className="space-y-4">
                            <div className="p-5 bg-[var(--bg-surface)] rounded-2xl space-y-3">
                                <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-sm">
                                    <User className="w-4 h-4 text-[var(--accent)]" />
                                    {t(locale, "evaluate.identityLogistics", "Identity & Logistics")}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[var(--text-muted)]">{t(locale, "evaluate.location", "Location")}</span>
                                        <span className="font-bold text-[var(--text-primary)]">{match.talent_dna_snapshot.talent_identity?.location}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[var(--text-muted)]">{t(locale, "evaluate.availability", "Availability")}</span>
                                        <span className="font-bold text-emerald-400">{match.talent_dna_snapshot.talent_identity?.availability}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[var(--text-muted)]">{t(locale, "evaluate.expRange", "Exp. Range")}</span>
                                        <span className="font-bold text-[var(--text-primary)]">{match.talent_dna_snapshot.talent_identity?.salaryExpectation}</span>
                                    </div>
                                </div>
                            </div>

                             <div className="p-5 bg-[var(--bg-surface)] rounded-2xl space-y-3">
                                <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-sm">
                                    <Briefcase className="w-4 h-4 text-[var(--accent)]" />
                                    {t(locale, "evaluate.proSnapshot", "Professional Snapshot")}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[var(--text-muted)]">{t(locale, "evaluate.yearsExp", "Years Exp.")}</span>
                                        <span className="font-bold text-[var(--text-primary)]">{match.talent_dna_snapshot.talent_snapshot?.yearsExp} {t(locale, "common.years", "Years")}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[var(--text-muted)]">{t(locale, "evaluate.primaryRole", "Primary Role")}</span>
                                        <span className="font-bold text-[var(--text-primary)]">{match.talent_dna_snapshot.talent_snapshot?.primaryRole}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Traits / Style */}
                        <div className="lg:col-span-2 space-y-6">
                             <h4 className="text-sm font-display font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                                <ProgressIcon className="w-4 h-4 text-[var(--accent)]" />
                                {t(locale, "evaluate.operatingStyle", "Operating Style Match")}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                                {Object.entries(match.talent_dna_snapshot.talent_style || {}).map(([key, val]: [string, any]) => (
                                    <div key={key} className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                            <span className="text-[var(--text-muted)]">{key.replace(/([A-Z])/g, ' $1')}</span>
                                            <span className="text-[var(--accent)]">{val}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[var(--bg-surface)] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-[var(--bg-deep)] rounded-full" 
                                                style={{ width: `${val}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Key Experience */}
                    <div className="pt-6 border-t border-[var(--border)] space-y-4">
                         <h4 className="text-sm font-display font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[var(--accent)]" />
                            {t(locale, "evaluate.validatedExp", "Validated Experience Highlights")}
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                            {match.talent_dna_snapshot.talent_experience?.slice(0, 2).map((exp: any, idx: number) => (
                                <div key={idx} className="p-6 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h5 className="font-display font-bold text-[var(--text-primary)]">{exp.role}</h5>
                                            <p className="text-xs font-bold text-[var(--accent)]">{exp.company}</p>
                                        </div>
                                        <span className="text-[10px] font-display font-bold bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1 rounded-md border border-[var(--border)]">
                                            {exp.period}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {Array.isArray(exp.keyAchievements) && exp.keyAchievements.map((ach: string, aIdx: number) => (
                                            <p key={aIdx} className="text-xs text-[var(--text-muted)] leading-relaxed">• {ach}</p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-center pt-8">
                 <Link 
                    href={roleFinalizePath(roleId, appId)}
                    className="flex items-center justify-center gap-3 px-12 py-5 bg-[var(--bg-deep)] hover:bg-elevated text-[var(--text-primary)] font-bold rounded-2xl transition-all duration-200 shadow-xl hover:scale-[1.02]"
                >
                    {t(locale, "evaluate.proceed", "PROCEED TO FINAL SELECTION")}
                    <ChevronRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    );
}
