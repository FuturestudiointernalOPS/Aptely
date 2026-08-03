"use client";

import React from "react";
import { motion } from "motion/react";
import { FadeIn } from "@/components/landing/animations";
import { getClientLocale, t } from "@/lib/i18n";

export default function TrustBar() {
  const locale = getClientLocale();
  const PROOF_STATEMENTS = [
    t(locale, "tb.proof1", ""),
    t(locale, "tb.proof2", ""),
    t(locale, "tb.proof3", ""),
    t(locale, "tb.proof4", ""),
    t(locale, "tb.proof5", ""),
    t(locale, "tb.proof6", ""),
    t(locale, "tb.proof7", ""),
    t(locale, "tb.proof10", ""),
  ];
  const MARQUEE_ITEMS = [...PROOF_STATEMENTS, ...PROOF_STATEMENTS];
  const TRUST_BADGES = [
    t(locale, "fs.spot2.tag", "Aptely AI"),
    "Supabase",
    t(locale, "tb.badge.gdpr", "GDPR Compliant"),
    t(locale, "tb.badge.hosted", "Hosted in Europe"),
    t(locale, "tb.badge.soc2", "SOC 2 in progress"),
  ];

  return (
    <section className="relative bg-[var(--bg-deep)] overflow-hidden py-16">
      <div className="absolute top-0 left-0 right-0 h-px bg-[var(--border)]" />

      <div className="relative z-10">
        {/* Lead line */}
        <FadeIn className="container mx-auto px-6 max-w-6xl mb-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
            <div className="flex-shrink-0 space-y-1">
              <p className="text-[var(--text-primary)] font-display font-semibold text-lg leading-tight">
                {t(locale, "tb.leadTitle", "Built to recruit differently.")}
              </p>
            </div>
            <div className="w-px h-10 bg-[var(--border)] hidden md:block flex-shrink-0" />
            <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-xl">
              {t(locale, "tb.leadDesc", "Aptely replaces CVs and gut feeling with verified evidence, explainable scoring, and a unified hiring pipeline.")}
            </p>
          </div>
        </FadeIn>

        {/* Marquee */}
        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-r from-[var(--bg-deep)] to-transparent" />
          <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-l from-[var(--bg-deep)] to-transparent" />

          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
            className="flex gap-6 w-max"
          >
            {MARQUEE_ITEMS.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 flex-shrink-0 px-5 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)]"
              >
                <div className="w-1 h-1 rounded-full bg-[var(--accent)]/50 flex-shrink-0" />
                <span className="text-sm text-[var(--text-muted)] whitespace-nowrap">{item}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Trust badges */}
        <FadeIn delay={0.2} className="container mx-auto px-6 max-w-6xl mt-10">
          <div className="h-px bg-[var(--border)] mb-7" />
          <div className="flex flex-wrap items-center gap-3">
            {TRUST_BADGES.map((label) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/30" />
                <span className="text-xs text-[var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--border)]" />
    </section>
  );
}
