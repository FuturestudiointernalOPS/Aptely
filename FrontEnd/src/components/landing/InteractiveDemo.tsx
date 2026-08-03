"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { analyzeCandidate } from "@/services/geminiService";
import { CandidateAnalysis } from "@/types/landing";
import { getClientLocale, t } from "@/lib/i18n";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

type MockCandidate = {
  name: string;
  score: number;
  fit: CandidateAnalysis["fit"];
  risk: CandidateAnalysis["risk"];
  color: string;
};

const InteractiveDemo: React.FC = () => {
  const locale = getClientLocale();
  const riskLow = t(locale, "id.risk.low", "Low") as CandidateAnalysis["risk"];
  const riskHigh = t(locale, "id.risk.high", "High") as CandidateAnalysis["risk"];
  const mockCandidates: MockCandidate[] = [
    { name: "Sarah L.", score: 94, fit: "High Fit", risk: riskLow, color: "text-emerald-500" },
    { name: "Mehdi B.", score: 88, fit: "High Fit", risk: riskLow, color: "text-emerald-400" },
    { name: "Thomas R.", score: 92, fit: "High Fit", risk: riskLow, color: "text-[var(--accent)]" },
    { name: "Julie D.", score: 65, fit: "Moderate Fit", risk: riskHigh, color: "text-[var(--accent)]" },
  ];
  const [role, setRole] = useState("Fullstack Developer");
  const [stack, setStack] = useState("React / Node.js");
  const [seniority, setSeniority] = useState("Senior");
  const [context, setContext] = useState("Fintech / Scale-up");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"input" | "list" | "detail">("input");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateAnalysis | null>(null);

  const handleSimulateSearch = async () => {
    setLoading(true);
    setView("list");
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
  };

  const handleSelectProfile = async (candidateName: string) => {
    setLoading(true);

    const candInfo = mockCandidates.find((c) => c.name === candidateName);
    const displayScore = candInfo ? candInfo.score : 92;
    const displayFit = candInfo ? candInfo.fit : "High Fit";
    const displayRisk = candInfo ? candInfo.risk : "Faible";

    try {
      const data = await analyzeCandidate(role, stack, seniority, context);
      setSelectedCandidate({
        ...data,
        role: candidateName,
        score: displayScore,
        fit: displayFit,
        risk: displayRisk,
      });
      setView("detail");
    } catch {
      const fallbackData: CandidateAnalysis = {
        role: candidateName,
        score: displayScore,
        fit: displayFit,
        risk: displayRisk,
        explanation: t(locale, "id.fallback.explanation", "Profile perfectly aligned with the requirements of {{ctx}}.", { ctx: context }),
        proofs: [
          t(locale, "id.fallback.proof1", "Technical demonstration validated during the test phase."),
          t(locale, "id.fallback.proof2", "Structural analysis of components performed successfully."),
          t(locale, "id.fallback.proof3", "Data flow optimization demonstrated in a recent project."),
          t(locale, "id.fallback.proof4", "Resolution of complex issues in a production environment."),
        ],
        softSkills: ["PRAGMATIC DECISION MAKING", "OWNERSHIP", "COMMUNICATION"],
      };
      setSelectedCandidate(fallbackData);
      setView("detail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-deep)] rounded-[3rem] p-8 lg:p-16 shadow-3xl relative overflow-hidden border border-[var(--border)] min-h-[720px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--accent-dim),transparent_50%)]" />

      <AnimatePresence mode="wait">
        {view === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid lg:grid-cols-2 gap-16 relative z-10"
          >
            <div className="space-y-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-black uppercase tracking-widest">
                <Activity size={14} /> {t(locale, "id.badge", "Decision Intelligence")}
              </div>
              <h3 className="text-4xl lg:text-5xl font-black text-[var(--text-primary)] leading-tight">
                {t(locale, "id.headingLine1", "The AI that sees")} <br />
                <span className="text-[var(--accent)] italic">{t(locale, "id.headingAccent", "beyond paper.")}</span>
              </h3>
              <p className="text-[var(--text-muted)] text-lg font-medium">
                {t(locale, "id.subtitle", "No more manual sorting. Identify the talents that match your specific ecosystem.")}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">{t(locale, "id.label.role", "Role")}</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] appearance-none"
                  >
                    <option value="Fullstack Developer">{t(locale, "id.opt.fullstack", "Fullstack Dev")}</option>
                    <option value="Product Manager">Product Manager</option>
                    <option value="Data Engineer">Data Engineer</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">{t(locale, "id.label.experience", "Experience")}</label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] appearance-none"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid">{t(locale, "id.opt.mid", "Mid-level")}</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">{t(locale, "id.label.stack", "Tech stack")}</label>
                  <input
                    type="text"
                    value={stack}
                    onChange={(e) => setStack(e.target.value)}
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-2">{t(locale, "id.label.ecosystem", "Ecosystem")}</label>
                  <input
                    type="text"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder={t(locale, "id.ecosystemPlaceholder", "e.g. Fintech, Crypto...")}
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <button
                onClick={handleSimulateSearch}
                className="w-full bg-[var(--accent)] text-white font-black py-5 rounded-xl transition-all hover:scale-[1.02] shadow-xl shadow-[var(--accent)]/20 uppercase tracking-widest"
              >
                {t(locale, "id.cta", "Identify Talents")}
              </button>
            </div>
            <div className="hidden lg:flex flex-col justify-center space-y-4">
              {/* Pipeline preview */}
              {[
                { step: "01", label: t(locale, "id.pipeline.s1.label", "Role published"), sub: t(locale, "id.pipeline.s1.sub", "Structured job post"), done: true },
                { step: "02", label: t(locale, "id.pipeline.s2.label", "Candidates evaluated"), sub: t(locale, "id.pipeline.s2.sub", "Verified skills · Soft skills"), done: true },
                { step: "03", label: t(locale, "id.pipeline.s3.label", "AI shortlist"), sub: t(locale, "id.pipeline.s3.sub", "Justified, explainable score"), done: true },
                { step: "04", label: t(locale, "id.pipeline.s4.label", "Decision"), sub: t(locale, "id.pipeline.s4.sub", "Recommendation → Offer"), done: false },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${s.done ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)]"}`}>
                      {s.done ? "✓" : s.step}
                    </div>
                    {i < 3 && <div className={`w-px h-8 mt-1 ${s.done ? "bg-[var(--accent)]/40" : "bg-[var(--bg-raised)]"}`} />}
                  </div>
                  <div className="pt-1 space-y-0.5">
                    <p className={`text-sm font-bold ${s.done ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{s.label}</p>
                    <p className={`text-[11px] ${s.done ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]"}`}>{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative z-10 space-y-8"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-[var(--border)] pb-6 gap-4">
              <div>
                <h4 className="text-2xl font-black text-[var(--text-primary)]">
                  {t(locale, "id.list.heading", "Talents filtered for")} <span className="text-[var(--accent)]">{role}</span>
                </h4>
                <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest mt-1">
                  {t(locale, "id.list.ecosystem", "Ecosystem:")} {context}
                </p>
              </div>
              <button
                onClick={() => setView("input")}
                className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] border border-[var(--accent)]/30 px-6 py-3 rounded-full hover:bg-[var(--accent-dim)] transition-colors"
              >
                {t(locale, "id.list.modify", "Modify search")}
              </button>
            </div>

            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-8">
                <div className="w-16 h-16 border-4 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
                <p className="text-[var(--text-primary)] font-black uppercase tracking-widest text-xs">
                  {t(locale, "id.list.searching", "Searching for the best scores...")}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {mockCandidates.map((cand, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => handleSelectProfile(cand.name)}
                    className="group bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] border border-[var(--border)] hover:border-[var(--accent)]/30 rounded-2xl p-6 flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-deep)] flex items-center justify-center font-black text-[var(--accent)] border border-[var(--border)] group-hover:scale-110 transition-transform">
                        {cand.name[0]}
                      </div>
                      <div>
                        <div className="text-[var(--text-primary)] font-black text-xl">{cand.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${cand.color}`}>
                            {cand.fit}
                          </span>
                          <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                            {t(locale, "id.risk", "Risk {{level}}", { level: cand.risk })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div className="text-right">
                        <div className={`text-3xl font-black ${cand.color}`}>{cand.score}%</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                          {t(locale, "id.match", "Aptely Match")}
                        </div>
                      </div>
                      <div className="bg-[var(--accent-dim)] p-2 rounded-xl group-hover:bg-[var(--accent)] transition-colors">
                        <ChevronRight className="text-[var(--accent)] group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {view === "detail" && selectedCandidate && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <button
              onClick={() => setView("list")}
              className="mb-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--accent)] hover:translate-x-[-4px] transition-transform"
            >
              <ChevronRight className="rotate-180" size={16} /> {t(locale, "id.detail.back", "Back to list")}
            </button>

            <div className="bg-[var(--bg-raised)] rounded-[3rem] border border-[var(--border)] p-12 space-y-12">
              <div className="flex flex-col md:flex-row justify-between items-center md:items-start border-b border-[var(--border)] pb-10 gap-8">
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 rounded-3xl bg-[var(--accent)] p-1 flex items-center justify-center">
                    <div className="w-full h-full bg-[var(--bg-deep)] rounded-2xl flex items-center justify-center font-black text-white text-4xl shadow-inner">
                      {selectedCandidate.role[0]}
                    </div>
                  </div>
                  <div className="text-center md:text-left">
                    <h4 className="text-[var(--text-primary)] font-black text-4xl mb-2">{selectedCandidate.role}</h4>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                      <span className="px-4 py-1.5 bg-[var(--accent)]/20 text-[var(--accent)] rounded-full text-[10px] font-black uppercase tracking-widest border border-[var(--accent)]/20">
                        {selectedCandidate.fit}
                      </span>
                      <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                        {t(locale, "id.risk", "Risk {{level}}", { level: selectedCandidate.risk })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-center bg-[var(--bg-raised)] px-10 py-6 rounded-3xl border border-[var(--border)]">
                  <div className="text-6xl font-black text-[var(--text-primary)] mb-1">{selectedCandidate.score}%</div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    {t(locale, "id.detail.confidence", "Certified AI Confidence")}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                <div className="bg-[var(--bg-raised)] p-8 rounded-3xl border border-[var(--border)] space-y-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-[var(--accent)]" size={28} />
                    <h5 className="text-lg font-black text-[var(--text-primary)] tracking-tight">{t(locale, "id.detail.skillVerif", "Skill Verification")}</h5>
                  </div>
                  <ul className="space-y-4">
                    {selectedCandidate.proofs.map((p, i) => (
                      <li
                        key={i}
                        className="text-[var(--text-secondary)] text-base font-medium flex items-start gap-4 p-4 bg-[var(--bg-raised)] rounded-2xl border border-[var(--border)]"
                      >
                        <CheckCircle2 size={18} className="text-[var(--accent)] mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-8">
                  <div className="bg-[var(--bg-raised)] p-8 rounded-3xl border border-[var(--border)] space-y-6">
                    <div className="flex items-center gap-3">
                      <Zap className="text-[var(--accent)]" size={28} />
                      <h5 className="text-lg font-black text-[var(--text-primary)] tracking-tight">{t(locale, "id.detail.softSkills", "Validated Soft Skills")}</h5>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selectedCandidate.softSkills.map((s, i) => (
                        <span
                          key={i}
                          className="px-5 py-2.5 bg-[var(--bg-raised)] rounded-xl text-xs font-black text-[var(--text-primary)] uppercase tracking-widest border border-[var(--border)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 bg-[var(--accent-dim)] rounded-3xl border border-[var(--accent)]/20">
                    <h5 className="text-xs font-black text-[var(--accent)] uppercase tracking-widest mb-4">
                      {t(locale, "id.detail.contextual", "Contextual Analysis")}
                    </h5>
                    <p className="text-[var(--text-secondary)] font-medium leading-relaxed italic text-sm">
                      {t(locale, "id.detail.contextualText", "“Profile perfectly aligned with the requirements of {{ctx}}. The evidence provided demonstrates immediate success capability.”", { ctx: context })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractiveDemo;
