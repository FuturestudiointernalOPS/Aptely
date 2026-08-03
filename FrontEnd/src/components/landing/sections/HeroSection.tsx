"use client";

import React, { useRef, useCallback } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "motion/react";
import { ArrowRight, CheckCircle2, Clock, Zap } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

function MagneticLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 200, damping: 18, mass: 0.08 });
  const y = useSpring(rawY, { stiffness: 200, damping: 18, mass: 0.08 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    rawX.set((e.clientX - rect.left - rect.width / 2) * 0.28);
    rawY.set((e.clientY - rect.top - rect.height / 2) * 0.28);
  }, [rawX, rawY]);

  const handleMouseLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return (
    <motion.div ref={ref} style={{ x, y }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <Link href={href} className={className}>{children}</Link>
    </motion.div>
  );
}

export default function HeroSection() {
  const locale = getClientLocale();

  const CANDIDATES = [
    {
      initials: "SR",
      name: "Sofia Ramos",
      role: t(locale, "hs.cand1.role", "Lead Fullstack · 7 yrs"),
      match: 94,
      skills: ["React", "Node.js", "TypeScript"],
      status: t(locale, "hs.cand1.status", "Shortlisted"),
      statusClass: "text-emerald-400 bg-emerald-400/10",
      dotClass: "bg-emerald-400",
      avatarClass: "bg-[var(--accent)]",
    },
    {
      initials: "TK",
      name: "Thomas Kern",
      role: t(locale, "hs.cand2.role", "Senior Fullstack · 5 yrs"),
      match: 81,
      skills: ["Vue", "Go", "PostgreSQL"],
      status: t(locale, "hs.cand2.status", "In review"),
      statusClass: "text-amber-400 bg-amber-400/10",
      dotClass: "bg-amber-400",
      avatarClass: "bg-indigo-500",
    },
    {
      initials: "AM",
      name: "Amira Messaoud",
      role: t(locale, "hs.cand3.role", "Fullstack · 4 yrs"),
      match: 76,
      skills: ["React", "Python", "AWS"],
      status: t(locale, "hs.cand3.status", "New"),
      statusClass: "text-sky-400 bg-sky-400/10",
      dotClass: "bg-sky-400",
      avatarClass: "bg-emerald-500",
    },
  ];

  const matchColor = (score: number) =>
    score >= 90 ? "text-[var(--accent)]" : score >= 80 ? "text-amber-400" : "text-slate-400";
  const matchBarColor = (score: number) =>
    score >= 90 ? "bg-[var(--accent)]" : score >= 80 ? "bg-amber-400" : "bg-slate-400";

  return (
    <section className="relative min-h-[100dvh] flex items-center pt-28 pb-20 overflow-hidden bg-[var(--bg-deep)]">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, var(--text-muted) 1px, transparent 1px)",
          opacity: 0.08,
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 100%)",
        }}
      />

      {/* Top rule */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-14 xl:gap-20 items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="space-y-8"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] text-[11px] font-semibold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              {t(locale, "hs.badge", "Platform in pilot phase")}
            </div>

            {/* Headline */}
            <div className="space-y-1">
              <h1 className="font-display leading-[1.02] tracking-[-0.02em]">
                <span
                  className="block font-light text-[var(--text-secondary)]"
                  style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)" }}
                >
                  {t(locale, "hs.title1", "Recruit on")}
                </span>
                <span
                  className="block font-black text-[var(--text-primary)]"
                  style={{ fontSize: "clamp(3rem, 6.5vw, 4.75rem)" }}
                >
                  {t(locale, "hs.title2", "evidence.")}
                </span>
                <span
                  className="block font-light text-[var(--text-primary)]/45 mt-2"
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}
                >
                  {t(locale, "hs.title3", "Not on CVs.")}
                </span>
              </h1>
            </div>

            {/* Subline */}
            <p className="text-base md:text-lg text-[var(--text-secondary)] leading-relaxed max-w-[42ch] font-normal">
              {t(locale, "hs.subline", "Aptely verifies skills, assesses soft skills and ranks candidates by the DNA of each role — in hours, not weeks.")}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={ROUTES.register}
                className="inline-flex items-center justify-center bg-[var(--accent)] text-white px-7 py-3.5 rounded-xl font-semibold text-sm gap-2 hover:opacity-90 transition-opacity shadow-[0_4px_20px_oklch(65%_0.22_42_/_0.35)]"
              >
                {t(locale, "hs.ctaRegister", "Get started")}
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl text-sm font-semibold text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--border)]/60 hover:bg-[var(--bg-raised)] transition-all duration-200"
              >
                {t(locale, "nav.demo", "How it works")}
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex -space-x-2">
                {[
                  { init: "ML", cls: "bg-[var(--accent)]" },
                  { init: "TD", cls: "bg-indigo-500" },
                  { init: "CM", cls: "bg-emerald-500" },
                  { init: "PH", cls: "bg-blue-500" },
                ].map(({ init, cls }, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full border-2 border-[var(--bg-deep)] flex items-center justify-center text-[9px] font-bold text-white font-display flex-shrink-0 ${cls}`}
                  >
                    {init}
                  </div>
                ))}
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                <span className="text-[var(--text-secondary)] font-semibold">500+</span>{" "}
                {t(locale, "hs.socialProof", "recruiters in pilot phase")}
              </p>
            </div>
          </motion.div>

          {/* Right — candidate pipeline mock */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.75, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative"
          >
            {/* Panel */}
            <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-raised)]">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">
                    {t(locale, "hs.panel.label", "Active pipeline")}
                  </p>
                  <p className="text-[var(--text-primary)] font-semibold font-display text-sm leading-tight">
                    Lead Fullstack · SpaceX
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t(locale, "hs.panel.candidates", "{{n}} candidates", { n: 3 })}
                  </span>
                </div>
              </div>

              {/* Column labels */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 border-b border-[var(--border)]/50">
                {[
                  t(locale, "hs.col.candidate", "Candidate"),
                  t(locale, "hs.col.match", "Match"),
                  t(locale, "hs.col.status", "Status"),
                ].map((label) => (
                  <span key={label} className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    {label}
                  </span>
                ))}
              </div>

              {/* Candidate rows */}
              <div className="divide-y divide-[var(--border)]/50">
                {CANDIDATES.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.1, duration: 0.5, ease: "easeOut" }}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-4 hover:bg-[var(--bg-surface)] transition-colors duration-150"
                  >
                    {/* Candidate info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white font-display flex-shrink-0 ${c.avatarClass}`}>
                        {c.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] font-display leading-tight truncate">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                          {c.role}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {c.skills.map((skill) => (
                            <span key={skill} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-muted)] uppercase tracking-wide border border-[var(--border)]/50">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Match score */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-lg font-black font-display leading-none ${matchColor(c.match)}`}>
                        {c.match}<span className="text-xs font-semibold">%</span>
                      </span>
                      <div className="w-12 h-0.5 rounded-full bg-[var(--border)]">
                        <div className={`h-full rounded-full ${matchBarColor(c.match)}`} style={{ width: `${c.match}%` }} />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold ${c.statusClass}`}>
                        <span className={`w-1 h-1 rounded-full ${c.dotClass}`} />
                        {c.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Panel footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <Zap size={10} className="text-[var(--accent)]" />
                    {t(locale, "hs.footer.scorecards", "AI-generated scorecards")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={10} className="text-emerald-400" />
                    {t(locale, "hs.footer.verified", "Verified skills")}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <Clock size={9} />
                  {t(locale, "hs.footer.ago", "{{n}} min ago", { n: 4 })}
                </span>
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.85, duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="absolute -top-3 -right-3 flex items-center gap-2 bg-[var(--accent)] text-white text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-[0_4px_16px_oklch(65%_0.22_42_/_0.4)]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
              {t(locale, "hs.badge.ready", "Shortlist ready")}
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border border-[var(--border)] flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-[var(--text-muted)]" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
