"use client";

import React, { useRef } from "react";
import { motion, useInView } from "motion/react";
import { CheckCircle2, Zap, Search, Heart, ArrowRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

/* ─── Card sub-components ─── */

function ProfileCard() {
  const locale = getClientLocale();
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4 w-full h-full shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-raised)] flex items-center justify-center text-[var(--text-primary)] text-xs font-bold font-display">SB</div>
          <div>
            <div className="text-[var(--text-primary)] text-sm font-semibold font-display leading-tight">Sarah Benali</div>
            <div className="text-[var(--text-muted)] text-[10px]">{t(locale, "sc.card.role", "Lead Fullstack · 5 yrs")}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[var(--accent)] font-black font-display text-xl leading-none">
          92<span className="text-xs font-semibold text-[var(--text-muted)]">%</span>
        </div>
      </div>
      <div className="h-px bg-[var(--border)]" />
      <div className="space-y-2.5">
        {[
          { name: "React / Next.js", pct: 94, colorClass: "bg-[var(--accent)]" },
          { name: "Node.js / API", pct: 88, colorClass: "bg-blue-500" },
          { name: "Architecture", pct: 82, colorClass: "bg-emerald-500" },
          { name: "Leadership", pct: 79, colorClass: "bg-purple-500" },
        ].map((skill, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-[var(--text-muted)]">{skill.name}</span>
              <span className="text-[var(--text-secondary)]">{skill.pct}%</span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${skill.pct}%` }}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                className={`h-full ${skill.colorClass} rounded-full`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <div className="px-2.5 py-1 bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] text-[9px] font-semibold rounded-full">High Fit</div>
        <div className="px-2.5 py-1 bg-[var(--bg-raised)] border border-[var(--border)] text-emerald-400 text-[9px] font-semibold rounded-full">{t(locale, "sc.card.proofs", "8 proofs")}</div>
      </div>
    </div>
  );
}

function AICard() {
  const locale = getClientLocale();
  return (
    <div className="bg-[var(--bg-deep)] border border-[var(--border)] rounded-2xl p-4 space-y-3 w-full h-full">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
          <Search size={12} className="text-[var(--accent)]" />
        </div>
        <span className="text-[var(--text-muted)] text-[10px] font-semibold uppercase tracking-wider">{t(locale, "sc.ai.title", "AI Analysis")}</span>
      </div>
      <div className="space-y-2">
        {[
          { text: t(locale, "sc.ai.1", "Perfectly aligned stack"), colorClass: "text-emerald-400" },
          { text: t(locale, "sc.ai.2", "Remote-first culture confirmed"), colorClass: "text-emerald-400" },
          { text: t(locale, "sc.ai.3", "Adaptive leadership detected"), colorClass: "text-blue-400" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}
            className="flex items-center gap-2"
          >
            <CheckCircle2 size={11} className={item.colorClass} />
            <span className="text-[var(--text-muted)] text-[10px]">{item.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SoftSkillsCard() {
  const locale = getClientLocale();
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3 w-full h-full">
      <div className="flex items-center gap-2">
        <Heart size={12} className="text-pink-400" />
        <span className="text-[var(--text-muted)] text-[10px] font-semibold uppercase tracking-wider">{t(locale, "sc.soft.title", "Soft Skills")}</span>
      </div>
      <div className="space-y-2.5">
        {[
          { label: t(locale, "sc.soft.1", "Communication"), score: 91 },
          { label: t(locale, "sc.soft.2", "Adaptability"), score: 87 },
          { label: t(locale, "sc.soft.3", "Collaboration"), score: 94 },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[var(--text-muted)] text-[10px]">{s.label}</span>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, j) => (
                <motion.div
                  key={j}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: j < Math.round(s.score / 20) ? 1 : 0.15 }}
                  transition={{ delay: 0.7 + i * 0.1 + j * 0.05 }}
                  className={`w-2.5 h-2.5 rounded-sm ${j < Math.round(s.score / 20) ? "bg-pink-400" : "bg-[var(--border)]"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowCard() {
  const locale = getClientLocale();
  return (
    <div className="bg-[var(--bg-deep)] border border-[var(--border)] rounded-2xl p-4 space-y-2 w-full h-full">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">{t(locale, "sc.wf.title", "Pipeline")}</div>
      {[
        { label: t(locale, "sc.wf.1", "Sourced"), done: true, active: false },
        { label: t(locale, "sc.wf.2", "AI analyzed"), done: true, active: true },
        { label: t(locale, "sc.wf.3", "Shortlisted"), done: false, active: false },
        { label: t(locale, "sc.wf.4", "Offer"), done: false, active: false },
      ].map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 200 }}
            className={`w-3 h-3 rounded-full flex-shrink-0 ${step.done ? step.active ? "bg-[var(--accent)]" : "bg-emerald-400" : "bg-[var(--border)]"}`}
          />
          <div className={`text-[10px] ${step.active ? "text-[var(--accent)] font-semibold" : step.done ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]/40"}`}>
            {step.label}
          </div>
          {step.active && (
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="ml-auto">
              <Zap size={9} className="text-[var(--accent)]" />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Cards layout (4 cards, no ScoreBadge hero-metric) ─── */
const CARDS = [
  {
    id: "profile",
    component: ProfileCard,
    pos: { left: 0, top: 30, width: 235, height: 345 },
    from: { x: 250, y: -60, rotate: -22, scale: 0.75 },
    to: { rotate: -1 },
    delay: 0.0,
    zIndex: 20,
  },
  {
    id: "ai",
    component: AICard,
    pos: { left: 252, top: 20, width: 215, height: 155 },
    from: { x: -100, y: -200, rotate: 18, scale: 0.7 },
    to: { rotate: 1 },
    delay: 0.1,
    zIndex: 15,
  },
  {
    id: "softskills",
    component: SoftSkillsCard,
    pos: { left: 252, top: 192, width: 215, height: 175 },
    from: { x: 50, y: 250, rotate: 20, scale: 0.65 },
    to: { rotate: -1 },
    delay: 0.15,
    zIndex: 10,
  },
  {
    id: "workflow",
    component: WorkflowCard,
    pos: { left: 0, top: 392, width: 467, height: 110 },
    from: { x: -200, y: 150, rotate: -15, scale: 0.7 },
    to: { rotate: 0 },
    delay: 0.25,
    zIndex: 12,
  },
];

/* ─── Section ─── */
export default function ShowcaseSection() {
  const locale = getClientLocale();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  return (
    <section className="relative bg-[var(--bg-deep)] py-28 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-[var(--border)]" />

      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">
              {t(locale, "sc.badge", "Platform")}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] leading-tight font-display">
              {t(locale, "sc.titlePre", "An interface built for the")}{" "}
              <span className="text-[var(--accent)]">
                {t(locale, "sc.titleAccent", "decisions that matter")}
              </span>
            </h2>
            <p className="text-[var(--text-secondary)] text-lg leading-relaxed">
              {t(locale, "sc.subtitle", "Global score, verifiable evidence, soft skills, pipeline — everything your team needs, at a glance.")}
            </p>
            <div className="space-y-3">
              {[
                t(locale, "sc.li1", "Real-time AI analysis on every profile"),
                t(locale, "sc.li2", "Detailed scores with contextual explanation"),
                t(locale, "sc.li3", "Team collaboration integrated into the pipeline"),
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 size={14} className="text-[var(--accent)] flex-shrink-0" />
                  <span className="text-[var(--text-secondary)] text-sm">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — assembled cards (desktop) */}
          <div ref={ref} className="relative hidden lg:block" style={{ height: 510 }}>
            {CARDS.map((card) => {
              const Component = card.component;
              return (
                <motion.div
                  key={card.id}
                  initial={{ x: card.from.x, y: card.from.y, rotate: card.from.rotate, scale: card.from.scale, opacity: 0 }}
                  animate={inView ? { x: 0, y: 0, rotate: card.to.rotate, scale: 1, opacity: 1 } : {}}
                  transition={{
                    delay: card.delay,
                    type: "spring",
                    stiffness: 80,
                    damping: 18,
                    opacity: { duration: 0.3, delay: card.delay },
                  }}
                  className="absolute"
                  style={{ left: card.pos.left, top: card.pos.top, width: card.pos.width, height: card.pos.height, zIndex: card.zIndex }}
                >
                  <Component />
                </motion.div>
              );
            })}

            {/* AI powered badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.7, type: "spring" }}
              className="absolute bottom-0 right-0 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 flex items-center gap-2"
              style={{ zIndex: 30 }}
            >
              <div className="w-5 h-5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
                <Zap size={9} className="text-[var(--accent)]" />
              </div>
              <span className="text-[var(--text-muted)] text-[10px]">{t(locale, "sc.poweredBy", "Powered by Our AI")}</span>
            </motion.div>
          </div>

          {/* Mobile: stacked */}
          <div className="lg:hidden space-y-4">
            <ProfileCard />
            <AICard />
            <SoftSkillsCard />
            <WorkflowCard />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--border)]" />
    </section>
  );
}
