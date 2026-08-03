"use client";
import { ROUTES, appPath } from "@/lib/routes";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCandidateProfile, CandidateProfile } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";
import {
    ArrowLeft,
    MapPin,
    Globe,
    DollarSign,
    Calendar,
    Briefcase,
    Target,
    Award,
    Link as LinkIcon,
    ChevronRight,
    Search,
    MessageSquare,
    Zap,
    Sparkles,
    ShieldCheck,
    AlertCircle,
    User,
    CheckCircle2,
    Binary,
    Code2,
    Layers,
    Cpu,
    ExternalLink
} from "lucide-react";
import Link from "next/link";

export default function CandidateProfilePage() {
    const { id } = useParams();
    const locale = getClientLocale();
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const [profile, setProfile] = useState<CandidateProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const handleExportDna = () => {
        if (!profile) return;
        const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `candidate-dna-${profile.identity.name.replace(/\s+/g, "-").toLowerCase()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        // Load candidate profile from application dna_snapshot (filled during apply)
        const load = async () => {
            try {
                const { apiFetch } = await import("@/lib/apiHelper");
                const { applicationApiPath } = await import("@/lib/routes");
                const app = await apiFetch(applicationApiPath(id as string), "HR");
                const snap = app?.dnaSnapshot ?? app?.dna_snapshot ?? app?.data?.dna_snapshot ?? null;
                if (snap) {
                    // Map dna_snapshot structure to CandidateProfile interface
                    const ti = snap.talent_identity ?? {};
                    const ts = snap.talent_snapshot ?? {};
                    const mapped: CandidateProfile = {
                        candidateId: snap.candidate_id ?? "",
                        identity: {
                            name: ti.name ?? "—",
                            location: ti.location ?? "—",
                            timezone: ti.timezone ?? "—",
                            workAuth: ti.workAuth ?? ti.work_auth ?? "—",
                            availability: ti.availability ?? "—",
                            contracts: ti.contracts ?? [],
                            salaryExpectation: ti.salaryExpectation ?? ti.salary ?? "—",
                            links: {
                                cv: ti.links?.cv ?? ti.cv ?? "",
                                linkedin: ti.links?.linkedin ?? ti.linkedin ?? "",
                                portfolio: ti.links?.portfolio ?? ti.portfolio ?? "",
                            },
                        },
                        snapshot: {
                            primaryRole: ts.primaryRole ?? ti.primaryRole ?? "—",
                            secondarySkills: ts.secondarySkills ?? [],
                            yearsExp: ts.yearsExp ?? ti.yearsExp ?? 0,
                            experienceMix: ts.experienceMix ?? [],
                            trustedProblemSolving: ts.trustedProblemSolving ?? "—",
                        },
                        capabilities: snap.talent_skills ?? [],
                        workEvidence: snap.talent_evidence ?? [],
                        motivation: snap.talent_motivation ?? {},
                        scenarioJudgment: snap.talent_scenario ?? {},
                        operatingStyle: snap.talent_style ?? {},
                    };
                    setProfile(mapped as unknown as CandidateProfile);
                }
            } catch (e) {
                console.error("Failed to load candidate profile", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading || !profile) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-32">
            {/* Header / Nav */}
            <div className="flex items-center justify-between animate-fade-in-up">
                <Link href={appPath(id as string)} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    {tr("application.candidate.backSelection", "Back to selection")}
                </Link>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportDna}
                        className="px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                    >
                        {tr("application.candidate.exportDna", "Export DNA")}
                    </button>
                </div>
            </div>

            {/* SECTION 1 — Identity & Logistics */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[2.5rem] p-10  border border-[var(--border)] flex flex-col md:flex-row gap-12 animate-fade-in-up">
                <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6">
                    <div className="w-32 h-32 rounded-3xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] relative group">
                        <User className="w-16 h-16" />
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-400/100 border-4 border-white rounded-full flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-[var(--text-primary)] mb-1">{profile.identity.name}</h1>
                        <p className="text-[var(--accent)] font-bold text-sm tracking-wide uppercase">{profile.snapshot.primaryRole}</p>
                    </div>
                    <div className="flex gap-3">
                        {Object.entries(profile.identity.links).map(([key, url]) => (
                            <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-xl transition-all capitalize text-[10px] font-bold">
                                {key}
                            </a>
                        ))}
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12">
                    <LogisticItem icon={MapPin} label={tr("application.candidate.location", "Location")} value={profile.identity.location} />
                    <LogisticItem icon={Globe} label={tr("application.candidate.timezone", "Timezone")} value={profile.identity.timezone} />
                    <LogisticItem icon={ShieldCheck} label={tr("application.candidate.workAuth", "Work authorization")} value={profile.identity.workAuth} />
                    <LogisticItem icon={Calendar} label={tr("application.candidate.availability", "Availability")} value={profile.identity.availability} />
                    <LogisticItem icon={Briefcase} label={tr("application.candidate.contractsAccepted", "Contracts accepted")} value={profile.identity.contracts.join(", ")} />
                    <LogisticItem icon={DollarSign} label={tr("application.candidate.salaryExpectations", "Salary expectations")} value={profile.identity.salaryExpectation} />
                </div>
            </div>

            {/* SECTION 2 — Professional Snapshot */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8  border border-[var(--border)] space-y-6 animate-fade-in-up delay-100">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Award className="w-5 h-5 text-[var(--accent)]" />
                            {tr("application.candidate.snapshotTitle", "The \"Vetting Gold\" snapshot")}
                        </h3>
                        <div className="p-6 bg-[var(--accent)]/10/30 border border-[var(--accent)]/20 rounded-2xl italic text-[var(--text-secondary)] text-sm leading-relaxed">
                            <span className="text-[var(--accent)] font-display font-bold mr-2">{tr("application.candidate.problemSolvingDna", "Problem solving DNA")}:</span>
                            &quot;{profile.snapshot.trustedProblemSolving}&quot;
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {profile.snapshot.secondarySkills.map(skill => (
                                <span key={skill} className="px-3 py-1.5 bg-[var(--bg-surface)] text-[var(--text-muted)] rounded-lg text-xs font-bold border border-[var(--border)] italic">
                                    #{skill}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 3 — Capability Mapping */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8  border border-[var(--border)] space-y-8 animate-fade-in-up delay-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Binary className="w-5 h-5 text-[var(--accent)]" />
                                {tr("application.candidate.skillMapping", "Major skill mapping")}
                            </h3>

                        </div>
                        <div className="space-y-6">
                            {profile.capabilities.map((cap, i) => (
                                <div key={i} className="group p-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-raised)] hover:border-[var(--accent)]/20 hover:shadow-xl transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h4 className="font-bold text-[var(--text-primary)] text-base">{cap.skillName}</h4>
                                            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-0.5">
                                                {cap.yearsUsed} {tr("application.candidate.years", "years")} • {cap.context.join(", ")}
                                            </p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-display font-bold uppercase tracking-wider ${cap.ownership === 'architected systems' ? 'bg-purple-100 text-purple-400' :
                                            cap.ownership === 'led others' ? 'bg-blue-100 text-blue-400' :
                                                'bg-green-100 text-emerald-400'
                                            }`}>
                                            {cap.ownership}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                        <div className="space-y-1">
                                            <p className="text-[var(--text-muted)] font-bold uppercase text-[9px]">{tr("application.candidate.theOutcome", "The outcome")}</p>
                                            <p className="text-[var(--text-secondary)] italic">&quot;{cap.explanation.outcome}&quot;</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[var(--text-muted)] font-bold uppercase text-[9px]">{tr("application.candidate.proofLink", "Proof link")}</p>
                                            <a href={cap.proofLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[var(--accent)] font-bold hover:underline">
                                                <ExternalLink className="w-3 h-3" />
                                                {tr("application.candidate.viewProof", "View proof")}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 4 — Real Work Evidence */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8  border border-[var(--border)] space-y-8 animate-fade-in-up">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Code2 className="w-5 h-5 text-[var(--accent)]" />
                                {tr("application.candidate.deepWorkEvidence", "Deep work evidence")}
                            </h3>
                            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{profile.workEvidence.length} {tr("application.candidate.entries", "entries")}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {profile.workEvidence.map((project, i) => (
                                <div key={i} className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-[var(--text-primary)]">{project.projectName}</h4>
                                        <LinkIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                    </div>
                                    <div className="space-y-4">
                                        <ProjectSection label={tr("application.candidate.projectProblem", "The problem")} text={project.problemSolved} />
                                        <ProjectSection label={tr("application.candidate.projectAction", "The action")} text={project.personalContribution} />
                                        <ProjectSection label={tr("application.candidate.projectHardship", "The hardship")} text={project.hardship} />
                                        <div className="pt-2">
                                            <p className="text-[8px] font-display font-bold text-[var(--accent)] uppercase tracking-tighter mb-1.5">{tr("application.candidate.stackUsed", "Stack used")}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {project.toolsUsed.map(tool => (
                                                    <span key={tool} className="px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border)] border border-[var(--border)] rounded text-[9px] font-bold text-[var(--text-muted)]">{tool}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-emerald-400/10/50 p-3 rounded-xl border border-emerald-400/20">
                                            <p className="text-[8px] font-display font-bold text-emerald-400 uppercase tracking-tighter mb-1">{tr("application.candidate.impact", "Impact")}</p>
                                            <p className="text-[11px] text-emerald-400 font-medium">{project.result}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* SECTION 6 — Operating Style Sliders */}
                    <div className="bg-[var(--bg-deep)] rounded-3xl p-8 text-[var(--text-primary)] space-y-8 shadow-xl animate-fade-in-up">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">{tr("application.candidate.operatingResonance", "Operating resonance")}</h3>
                        <div className="space-y-8">
                            <Slider labelL={tr("application.candidate.chaos", "Chaos")} labelR={tr("application.candidate.structure", "Structure")} value={profile.operatingStyle.chaosVsStructure} />
                            <Slider labelL={tr("application.candidate.speed", "Speed")} labelR={tr("application.candidate.quality", "Quality")} value={profile.operatingStyle.speedVsQuality} />
                            <Slider labelL={tr("application.candidate.autonomy", "Autonomy")} labelR={tr("application.candidate.guidance", "Guidance")} value={profile.operatingStyle.autonomyVsGuidance} />
                            <Slider labelL={tr("application.candidate.depth", "Depth")} labelR={tr("application.candidate.variety", "Variety")} value={profile.operatingStyle.depthVsVariety} />
                            <Slider labelL={tr("application.candidate.pressureComfort", "Pressure comfort")} labelR={tr("application.candidate.high", "High")} value={profile.operatingStyle.pressureComfort} iconOnly />
                        </div>
                        <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                            <div>
                                <p className="text-[9px] text-[var(--accent)] font-display font-bold uppercase mb-1">{tr("application.candidate.frictionPoint", "Friction point")}</p>
                                <p className="text-xs text-[var(--text-muted)] leading-relaxed italic">&quot;{profile.operatingStyle.struggleEnvironment}&quot;</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-green-400 font-display font-bold uppercase mb-1">{tr("application.candidate.growthCatalyst", "Growth catalyst")}</p>
                                <p className="text-xs text-[var(--text-muted)] leading-relaxed italic">&quot;{profile.operatingStyle.thriveEnvironment}&quot;</p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 5 — Scenario & Judgment */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-8  border border-[var(--border)] space-y-6 animate-fade-in-up">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Zap className="w-4 h-4 text-[var(--accent)]" />
                            {tr("application.candidate.scenarioJudgment", "Scenario judgment")}
                        </h3>
                        <div className="space-y-6">
                            <JudgmentItem label={tr("application.candidate.judgment.difficultProblem", "A difficult problem solved")} text={profile.scenarioJudgment.difficultProblem} />
                            <JudgmentItem label={tr("application.candidate.judgment.failedProject", "A project that failed")} text={profile.scenarioJudgment.failedProject} />
                            <JudgmentItem label={tr("application.candidate.judgment.approach", "Approach to challenges")} text={profile.scenarioJudgment.approachToChallenges} />
                        </div>
                    </div>

                    {/* SECTION 7 — Motivation & Trajectory */}
                    <div className="bg-[var(--bg-surface)] rounded-3xl p-8 space-y-6 animate-fade-in-up">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                            {tr("application.candidate.motivationDna", "Motivation DNA")}
                        </h3>
                        <div className="space-y-6 text-xs text-[var(--text-muted)] leading-relaxed">
                            <MotivationItem label={tr("application.candidate.motivation.growthGoals", "Growth goals")} text={profile.motivation.growthGoals} />
                            <MotivationItem label={tr("application.candidate.motivation.excitementTriggers", "Excitement triggers")} text={profile.motivation.excitementTriggers} />
                            <MotivationItem label={tr("application.candidate.motivation.vision", "3-year vision")} text={profile.motivation.threeYearVision} />
                            <MotivationItem label={tr("application.candidate.motivation.meaningfulProblems", "Meaningful problems")} text={profile.motivation.meaningfulProblems} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

 
function LogisticItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">{value}</p>
        </div>
    );
}

function ProjectSection({ label, text }: { label: string, text: string }) {
    return (
        <div className="space-y-1">
            <p className="text-[8px] font-display font-bold text-[var(--text-muted)] uppercase tracking-tighter">{label}</p>
            <p className="text-[11px] text-[var(--text-secondary)] leading-normal">{text}</p>
        </div>
    );
}

function Slider({ labelL, labelR, value, iconOnly }: { labelL: string, labelR: string, value: number, iconOnly?: boolean }) {
    return (
        <div className="space-y-2">
            {!iconOnly && (
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight text-[var(--text-muted)]">
                    <span>{labelL}</span>
                    <span>{labelR}</span>
                </div>
            )}
            {iconOnly && (
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight text-[var(--text-muted)]">
                    <span>{labelL}</span>
                    <span className="text-[var(--text-primary)]">{value}%</span>
                </div>
            )}
            <div className="h-1 w-full bg-[var(--bg-surface)] rounded-full relative">
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-[var(--accent)] rounded-full shadow-lg shadow-none-500/50"
                    style={{ left: `${value}%`, transform: 'translate(-50%, -50%)' }}
                />
            </div>
        </div>
    );
}

function JudgmentItem({ label, text }: { label: string, text: string }) {
    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-display font-bold text-[var(--accent)] uppercase tracking-widest">{label}</h4>
            <p className="text-xs text-[var(--text-muted)] italic leading-relaxed">&quot;{text}&quot;</p>
        </div>
    );
}

function MotivationItem({ label, text }: { label: string, text: string }) {
    return (
        <div className="space-y-2">
            <h4 className="text-[var(--text-primary)] font-bold">{label}</h4>
            <p className="italic">&quot;{text}&quot;</p>
        </div>
    );
}
