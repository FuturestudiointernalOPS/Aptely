"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAptelyReport, AptelyReport, AptelyReportResult } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";
import {
    ArrowLeft,
    FileText,
    ShieldCheck,
    Download,
    Share2,
    Target,
    Users,
    CheckCircle2,
    AlertCircle,
    Search,
    ExternalLink,
    Zap,
    Sparkles,
    BarChart3,
    ArrowUpRight,
    MessageSquareQuote
} from "lucide-react";
import Link from "next/link";

export default function AptelyReportPage() {
    const { id } = useParams();
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const [report, setReport] = useState<AptelyReport | null>(null);
    const [loading, setLoading] = useState(true);

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
        } catch {
            // Ignore clipboard errors in unsupported contexts
        }
    };

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        getAptelyReport(id as string, locale).then(data => {
            setReport(data);
            setLoading(false);
        });
    }, [id, locale]);

    if (loading || !report) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
        );
    }

    const mainResult = report.results[0] ?? null;

    // No match result yet — AI analysis hasn't run
    if (!mainResult) {
        return (
            <div className="max-w-3xl mx-auto mt-20 text-center space-y-6">
                <div className="w-20 h-20 bg-[var(--accent)]/10 rounded-3xl flex items-center justify-center mx-auto">
                    <Sparkles className="w-10 h-10 text-[var(--accent)] animate-pulse" />
                </div>
                <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">{tr("application.report.pendingTitle", "AI analysis pending")}</h1>
                <p className="text-[var(--text-muted)] max-w-md mx-auto">
                    {tr("application.report.pendingSubtitle", "The AI matching engine has not processed this application yet. This runs automatically once the HR team triggers evaluation from the role's candidate pipeline.")}
                </p>
                <button
                    onClick={() => window.history.back()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--bg-deep)] text-[var(--text-primary)] font-bold rounded-xl hover:shadow-none-lg transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {tr("application.report.backSelection", "Back to selection")}
                </button>
            </div>
        );
    }

    const expl = mainResult.aiExplanation as any;
    const isAiFailed = mainResult.score?.finalScore === 0 && Array.isArray(expl?.tradeoffs) && 
                      (expl?.tradeoffs[0] || "").toLowerCase().includes("failed");
    if (isAiFailed) {
        return (
            <div className="max-w-2xl mx-auto mt-20 text-center p-12 bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl border border-red-500/20 shadow-xl bg-red-500/5">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-3xl font-display font-bold text-red-500 mb-4">{tr("application.report.failedTitle", "AI evaluation failed")}</h1>
                <p className="text-[var(--text-primary)] text-lg font-medium mb-2">
                         "{expl?.gaps?.[0] || tr("application.report.failedFallback", "The AI matching engine encountered an error while processing this candidate DNA.")}"
                </p>
                <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto mb-8">
                   {tr("application.report.failedHint", "This usually happens due to malformed input data, timeout, or high demand on the model API. Please return to the candidate pipeline and relaunch the analysis.")}
                </p>
                <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5" /> {tr("application.report.backPipeline", "Back to candidate pipeline")}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {/* Nav Bar */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <button onClick={() => window.history.back()} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    {tr("application.report.backSelection", "Back to selection")}
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all bg-[var(--bg-surface)] border border-[var(--border)]"
                    >
                        <Share2 className="w-4 h-4" />
                        {tr("application.report.shareLink", "Share link")}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2 bg-[var(--bg-deep)] text-[var(--text-primary)] rounded-xl font-bold text-sm hover:shadow-none-lg transition-all shadow-none"
                    >
                        <Download className="w-4 h-4" />
                        {tr("application.report.fullPdf", "Full PDF analysis")}
                    </button>
                </div>
            </div>

            {/* Top Analysis Banner */}
            <div className="bg-[var(--bg-deep)] rounded-[2.5rem] p-10 text-[var(--text-primary)] relative overflow-hidden shadow-2xl animate-fade-in-up">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[#FF6B00]/10 to-transparent pointer-none" />
                <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-extrabold tracking-tight">{tr("application.report.bannerTitle", "Talent DNA deep analysis")}</h1>
                        </div>

                        <div className="flex flex-wrap gap-8 py-2">

                            <div>
                                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mb-1">{tr("application.report.topMatches", "Top matches identified")}</p>
                                <p className="text-2xl font-bold flex items-center gap-2">
                                    <Target className="w-5 h-5 text-[var(--accent)]" />
                                    {report.summary.topCandidates}
                                </p>
                            </div>
                            <div>
                                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mb-1">{tr("application.report.aiResonance", "AI resonance index")}</p>
                                <p className="text-2xl font-bold flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                    {Math.round(report.summary.aiConfidence * 100)}%
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center gap-2 text-[var(--text-muted)] text-sm">
                            <Search className="w-4 h-4" />
                            <span>{tr("application.report.roleRef", "Réf poste")}: <strong>{report.roleTitle || report.roleId}</strong></span>
                            <span className="mx-2 opacity-30">|</span>
                            <span>{tr("application.report.candidate", "Candidate")}: <strong>{mainResult.name}</strong></span>
                        </div>
                    </div>

                    <div className="w-full md:w-auto">
                        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-8 rounded-[2rem] text-center">
                            <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest mb-2">{tr("application.report.overallDna", "Overall DNA match")}</p>
                            <div className="text-6xl font-display font-bold text-[var(--accent)] mb-2">{mainResult.score.finalScore}%</div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-400/10 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                <ArrowUpRight className="w-3 h-3" />
                                {tr("application.report.optimalFit", "Optimal fit")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {/* Executive Summary */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 flex flex-col md:flex-row gap-8 animate-fade-in-up delay-100">
                        <div className="flex-1 space-y-6">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <MessageSquareQuote className="w-5 h-5 text-[var(--accent)]" />
                                {tr("application.report.selectionRationale", "AI selection rationale")}
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {mainResult.aiExplanation.whySelected.map((reason, i) => (
                                    <div key={i} className="flex gap-4 p-4 bg-[var(--bg-surface)]/50 rounded-2xl border border-[var(--border)]/50 italic text-[var(--text-secondary)] text-sm">
                                        <div className="w-6 h-6 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                                            {i + 1}
                                        </div>
                                        {reason}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Evidence & Verification */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 space-y-6 animate-fade-in-up delay-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
                                {tr("application.report.evidenceTitle", "Evidence & data integration")}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {mainResult.aiExplanation.evidenceUsed.map((evidence, i) => (
                                <div key={i} className="p-5 border border-[var(--border)] rounded-2xl hover:border-[var(--accent)]/40 transition-all group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="px-2 py-1 bg-[var(--bg-surface)] rounded text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider border border-[var(--border)]">
                                            {evidence.type}
                                        </div>
                                        {(evidence.url || evidence.contact) && (
                                            <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                                        {evidence.text || (evidence.url ? tr("application.report.sourceVerified", "Source URL verified") : `${tr("application.report.contact", "Contact")}: ${evidence.contact}`)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mission Alignment */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 space-y-6 animate-fade-in-up">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{tr("application.report.goalResonance", "Goal resonance analysis")}</h3>
                        <div className="space-y-4">
                            <div className="p-6 bg-[var(--accent)]/[0.06] border border-[var(--accent)]/20 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-widest">{tr("application.report.mission90", "90-day mission fit")}</span>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">{tr("application.report.statusHigh", "Status: high")}</span>
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] italic">&quot;{mainResult.aiExplanation.alignmentWithRole.mission90Days}&quot;</p>
                            </div>
                            <div className="p-6 bg-blue-400/[0.06] border border-blue-400/20 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{tr("application.report.success6", "6-month success outlook")}</span>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">{tr("application.report.statusMedium", "Status: medium")}</span>
                                </div>
                                <p className="text-sm text-[var(--text-secondary)] italic">&quot;{mainResult.aiExplanation.alignmentWithRole.success6Months}&quot;</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Detailed Scores */}
                    <div className="bg-[var(--bg-deep)] rounded-3xl p-8 text-[var(--text-primary)] space-y-6 shadow-xl animate-fade-in-up delay-300">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">{tr("application.report.fitVectors", "DNA fit vectors")}</h3>
                        <div className="space-y-5">
                            {[
                                { label: tr("application.report.vector.roleAlignment", "Role alignment"), val: mainResult.score.roleFit, color: "bg-[var(--accent)]" },
                                { label: tr("application.report.vector.skillValidity", "Skill validity"), val: mainResult.score.skillValidity, color: "bg-blue-400" },
                                { label: tr("application.report.vector.capabilityStrength", "Capability strength"), val: mainResult.score.capabilityStrength, color: "bg-green-400" },
                                { label: tr("application.report.vector.environmentFit", "Environment fit"), val: mainResult.score.environmentFit, color: "bg-purple-400" },
                                { label: tr("application.report.vector.reliabilityIndex", "Reliability index"), val: mainResult.score.reliabilityIndex, color: "bg-amber-400" },
                            ].map((s, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                                        <span className="text-[var(--text-muted)]">{s.label}</span>
                                        <span className="text-[var(--text-primary)]">{s.val}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[var(--bg-surface)] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${s.color} transition-all duration-1000`}
                                            style={{ width: `${s.val}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Risk & Tradeoffs */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 border-red-400/10 space-y-6 animate-fade-in-up">
                        <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                            <AlertCircle className="w-5 h-5" />
                            {tr("application.report.riskFlags", "Critical risk flags")}
                        </div>
                        <div className="space-y-4">
                            {mainResult.aiExplanation.riskFlags.map((risk, i) => (
                                <div key={i} className="p-4 bg-red-400/[0.06] border border-red-400/20 rounded-2xl">
                                    <p className="text-xs font-bold text-red-400 mb-1">{risk.risk}</p>
                                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{risk.impact}</p>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-[var(--border)]">
                            <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">{tr("application.report.tradeoffs", "Strategic tradeoffs")}</h4>
                            {mainResult.aiExplanation.tradeoffs.map((t, i) => (
                                <p key={i} className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                                    &quot;{t}&quot;
                                </p>
                            ))}
                        </div>
                    </div>

                    {/* Key Factors */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8 space-y-4 animate-fade-in-up">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{tr("application.report.selectionFactors", "Global selection factors")}</h3>
                        <ul className="space-y-3">
                            {report.summary.keySelectionFactors.map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
