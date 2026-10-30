"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, Cpu, ListOrdered, CheckCircle2, Search, Play } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import { LANDING_YOUTUBE_URL, isRealYoutubeVideoUrl, toYoutubeEmbedUrl } from "@/lib/landingMedia";

/* ─── Step Mock UIs ─── */

function MockPublish({ active }: { active: boolean }) {
  const locale = getClientLocale();
  const fields = [
    { label: t(locale, "hiw.mock.publish.jobTitle", "Job title"), value: "Lead Fullstack Engineer", filled: true },
    { label: t(locale, "hiw.mock.publish.stack", "Tech stack"), value: "React · Node.js · PostgreSQL", filled: true },
    { label: t(locale, "hiw.mock.publish.seniority", "Seniority"), value: t(locale, "hiw.mock.publish.seniorityValue", "Senior (5+ yrs)"), filled: true },
  ];
  return (
    <div className="bg-[var(--bg-raised)] rounded-2xl border border-[var(--border)] p-6 space-y-4 w-full">
      <div className="text-sm font-semibold text-[var(--text-primary)] font-display mb-2">{t(locale, "hiw.mock.publish.title", "New job post")}</div>
      {fields.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: i * 0.15, duration: 0.4 }}
          className="space-y-1"
        >
          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide font-sans">{f.label}</div>
          <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] font-sans">
            {active ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.15 }}
              >
                {f.value}
              </motion.span>
            ) : ""}
          </div>
        </motion.div>
      ))}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 200 }}
        className="w-full bg-[var(--accent)] text-white py-3 rounded-xl text-sm font-semibold font-sans shadow-lg shadow-[var(--accent)]/25 flex items-center justify-center gap-2"
      >
        <Upload size={14} />
        {t(locale, "hiw.mock.publish.cta", "Publish post")}
      </motion.button>
    </div>
  );
}

function MockAnalyse({ active }: { active: boolean }) {
  const locale = getClientLocale();
  const metrics = [
    { label: t(locale, "hiw.mock.analyse.m1", "Technical skills"), pct: 94, color: "from-[var(--accent)] to-orange-400" },
    { label: t(locale, "hiw.mock.analyse.m2", "Soft skills"), pct: 87, color: "from-blue-500 to-blue-400" },
    { label: t(locale, "hiw.mock.analyse.m3", "Culture fit"), pct: 91, color: "from-emerald-500 to-emerald-400" },
    { label: t(locale, "hiw.mock.analyse.m4", "Success context"), pct: 88, color: "from-purple-500 to-purple-400" },
  ];
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-2xl p-6 space-y-5 w-full">
      <div className="flex items-center gap-3">
        <motion.div
          animate={active ? { rotate: 360 } : { rotate: 0 }}
          transition={{ repeat: active ? Infinity : 0, duration: 2, ease: "linear" }}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-orange-400 flex items-center justify-center shadow-lg shadow-[var(--accent)]/30"
        >
          <Search size={18} className="text-white" />
        </motion.div>
        <div>
          <div className="text-[var(--text-primary)] text-sm font-semibold font-display">{t(locale, "hiw.mock.analyse.title", "Our AI")}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {active && (
              <>
                <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              </>
            )}
            <span className="text-[var(--text-muted)] text-[10px] font-sans">{t(locale, "hiw.mock.analyse.running", "Analyzing")}</span>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {metrics.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-sans">
              <span className="text-[var(--text-muted)]">{m.label}</span>
              <motion.span
                initial={{ opacity: 0 }}
                animate={active ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
                className="text-[var(--text-secondary)]"
              >
                {m.pct}%
              </motion.span>
            </div>
            <div className="h-1.5 bg-[var(--bg-raised)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={active ? { width: `${m.pct}%` } : { width: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.9, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${m.color} rounded-full`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockShortlist({ active }: { active: boolean }) {
  const locale = getClientLocale();
  const candidates = [
    { name: "Sarah Benali", role: "Lead Fullstack", score: 92, color: "bg-[var(--accent)]" },
    { name: "Lucas Moreau", role: "Senior Fullstack", score: 87, color: "bg-blue-500" },
    { name: "Emma Rousseau", role: "Tech Lead", score: 83, color: "bg-emerald-500" },
  ];
  return (
    <div className="bg-[var(--bg-raised)] rounded-2xl border border-[var(--border)] p-5 space-y-3 w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] font-display">{t(locale, "hiw.mock.shortlist.title", "Prioritized shortlist")}</div>
        <div className="text-[10px] text-[var(--text-muted)] font-sans">{t(locale, "hiw.mock.shortlist.meta", "3 candidates · 48h")}</div>
      </div>
      {candidates.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 40 }}
          animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
          transition={{ delay: i * 0.18, type: "spring", stiffness: 120, damping: 18 }}
          className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-raised)] transition-colors group"
        >
          <div className={`w-9 h-9 rounded-full ${c.color} flex items-center justify-center text-white text-xs font-bold font-display flex-shrink-0`}>
            {c.name.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--text-primary)] font-display">{c.name}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-sans">{c.role}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-[var(--text-primary)] font-display leading-none">{c.score}<span className="text-xs text-[var(--text-muted)]">%</span></div>
            {i === 0 && <div className="text-[8px] text-[var(--accent)] font-semibold font-sans">{t(locale, "hiw.mock.shortlist.bestMatch", "Best match")}</div>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function MockDecision({ active }: { active: boolean }) {
  const locale = getClientLocale();
  return (
    <div className="bg-[var(--bg-raised)] rounded-2xl border border-[var(--border)] p-5 space-y-4 w-full">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent)] to-orange-400 flex items-center justify-center text-white font-bold font-display">SB</div>
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)] font-display">Sarah Benali</div>
          <div className="text-[10px] text-[var(--text-muted)] font-sans">{t(locale, "hiw.mock.decision.meta", "Score 92% · Lead Fullstack")}</div>
        </div>
        <div className="ml-auto px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-semibold rounded-full font-sans">{t(locale, "hiw.mock.decision.highFit", "High Fit")}</div>
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide font-sans">{t(locale, "hiw.mock.decision.team", "Team involved")}</div>
        <div className="flex items-center gap-2">
          {["CTO", "RH", "TL"].map((role, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={active ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
              className="flex items-center gap-1.5 bg-[var(--bg-raised)] border border-[var(--border)] rounded-full px-2.5 py-1"
            >
              <div className="w-4 h-4 rounded-full bg-[var(--bg-raised)] flex items-center justify-center text-[7px] font-bold text-[var(--text-primary)]">{role[0]}</div>
              <span className="text-[9px] text-[var(--text-muted)] font-sans">{role}</span>
              <CheckCircle2 size={9} className="text-emerald-400" />
            </motion.div>
          ))}
        </div>
      </div>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={active ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 180 }}
      >
        <button
          type="button"
          className="w-full bg-[var(--accent)] text-white py-3 rounded-xl text-sm font-semibold font-sans flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,107,0,0.25)]"
        >
          <CheckCircle2 size={15} />
          {t(locale, "hiw.mock.decision.cta", "Make an offer")}
        </button>
      </motion.div>
    </div>
  );
}

/* ─── Main Section ─── */
export default function HowItWorksSection() {
  const locale = getClientLocale();
  const STEPS = [
    {
      number: "01",
      icon: Upload,
      title: t(locale, "hiw.step1.title", "Publish your job post"),
      description: t(locale, "hiw.step1.desc", ""),
      color: "text-[var(--accent)]",
      activeTabClass: "bg-[var(--accent-dim)] border-[var(--accent)]/40 text-[var(--accent)]",
      dotClass: "bg-[var(--accent)]",
      Mock: MockPublish,
    },
    {
      number: "02",
      icon: Cpu,
      title: t(locale, "hiw.step2.title", "AI analyzes candidates"),
      description: t(locale, "hiw.step2.desc", ""),
      color: "text-blue-400",
      activeTabClass: "bg-blue-400/10 border-blue-400/40 text-blue-400",
      dotClass: "bg-blue-400",
      Mock: MockAnalyse,
    },
    {
      number: "03",
      icon: ListOrdered,
      title: t(locale, "hiw.step3.title", "Prioritized shortlist"),
      description: t(locale, "hiw.step3.desc", ""),
      color: "text-emerald-400",
      activeTabClass: "bg-emerald-400/10 border-emerald-400/40 text-emerald-400",
      dotClass: "bg-emerald-400",
      Mock: MockShortlist,
    },
    {
      number: "04",
      icon: CheckCircle2,
      title: t(locale, "hiw.step4.title", "Informed decision"),
      description: t(locale, "hiw.step4.desc", ""),
      color: "text-purple-400",
      activeTabClass: "bg-purple-400/10 border-purple-400/40 text-purple-400",
      dotClass: "bg-purple-400",
      Mock: MockDecision,
    },
  ];
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];
  const StepMock = step.Mock;

  const youtubeEmbedUrl = isRealYoutubeVideoUrl(LANDING_YOUTUBE_URL) ? toYoutubeEmbedUrl(LANDING_YOUTUBE_URL) : null;

  return (
    <section id="how-it-works" className="bg-[var(--bg-surface)] py-24 overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl">

        {/* Header */}
        <div className="text-center mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold uppercase tracking-widest font-sans">
            {t(locale, "hiw.badge", "How it works")}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] leading-tight font-display">
            {t(locale, "hiw.headingPre", "From posting to")} <span className="text-[var(--accent)]">{t(locale, "hiw.headingAccent", "the decision")}</span>
          </h2>
          <p className="text-[var(--text-muted)] text-lg font-sans max-w-xl mx-auto">
            {t(locale, "hiw.subtitle", "A complete pipeline in 4 steps — without juggling ten tools.")}
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex flex-wrap gap-2 justify-center mb-12">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold font-sans transition-all border ${
                i === activeStep
                  ? s.activeTabClass
                  : "text-[var(--text-muted)] bg-[var(--bg-raised)] border-[var(--border)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <s.icon size={14} />
              {s.number}. {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="space-y-6"
            >
              <div className={`inline-flex items-center gap-2 text-sm font-semibold font-sans ${step.color}`}>
                <step.icon size={16} />
                {t(locale, "hiw.stepLabel", "Step {{n}} / {{total}}", { n: parseInt(step.number), total: STEPS.length })}
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] font-display leading-tight">
                {step.title}
              </h3>
              <p className="text-[var(--text-muted)] text-lg leading-relaxed font-sans">
                {step.description}
              </p>
              {/* Progress dots */}
              <div className="flex items-center gap-2 pt-2">
                {STEPS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveStep(i)}
                    className={`h-2 rounded-full transition-all ${i <= activeStep ? s.dotClass : "bg-[var(--border)]"}`}
                    style={{ width: i === activeStep ? 28 : 8 }}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Right — mock */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 40, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.97 }}
              transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="relative"
            >
              <StepMock active={true} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Demo video — hidden until a real YouTube link replaces the placeholder */}
        {youtubeEmbedUrl && (
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 justify-center mb-4 text-[var(--text-muted)] text-sm font-sans">
              <Play size={14} className="text-[var(--accent)]" />
              {t(locale, "hiw.video.title", "Watch how it works")}
            </div>
            <div className="relative w-full rounded-2xl border border-[var(--border)] overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src={youtubeEmbedUrl}
                title={t(locale, "hiw.video.title", "Watch how it works")}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
