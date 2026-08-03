"use client";

import React from "react";
import { motion } from "motion/react";
import { FadeIn } from "@/components/landing/animations";
import { getClientLocale, t } from "@/lib/i18n";

export default function TestimonialsSection() {
  const locale = getClientLocale();

  const [featured, ...compact] = [
    {
      quote: t(locale, "ts.1.quote", ""),
      name: "Marie Lefebvre",
      role: t(locale, "ts.1.role", "Head of Talent Acquisition"),
      company: t(locale, "ts.1.company", "Fintech Scale-up · 120 people"),
      initials: "ML",
      avatarClass: "bg-[var(--accent)]",
    },
    {
      quote: t(locale, "ts.2.quote", ""),
      name: "Thomas Durand",
      role: t(locale, "ts.2.role", "CTO & Co-founder"),
      company: t(locale, "ts.2.company", "B2B SaaS · 45 people"),
      initials: "TD",
      avatarClass: "bg-indigo-500",
    },
    {
      quote: t(locale, "ts.3.quote", ""),
      name: "Camille Martin",
      role: t(locale, "ts.3.role", "HR Director"),
      company: t(locale, "ts.3.company", "Tech Agency · 80 people"),
      initials: "CM",
      avatarClass: "bg-emerald-600",
    },
  ];

  return (
    <section className="relative bg-[var(--bg-deep)] py-28 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-[var(--border)]" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">
            {t(locale, "ts.badge", "Testimonials")}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] leading-tight font-display">
            {t(locale, "ts.titlePre", "What")}{" "}
            <span className="text-[var(--accent)]">
              {t(locale, "ts.titleAccent", "our recruiters say")}
            </span>
          </h2>
        </FadeIn>

        {/* Asymmetric layout: 1 featured + 2 compact */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-5 items-stretch">

          {/* Featured — left, full height */}
          <FadeIn delay={0}>
            <motion.div
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="group h-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 flex flex-col justify-between hover:border-[var(--accent)]/20 transition-all duration-300 cursor-default"
            >
              {/* Large quote mark */}
              <div className="text-[var(--accent)]/20 text-8xl font-serif leading-none select-none mb-2">&ldquo;</div>
              <p className="text-[var(--text-secondary)] text-lg leading-relaxed flex-1 -mt-6">
                {featured.quote || t(locale, "ts.1.quote", "Aptely changed how we evaluate candidates. We stopped making gut-feel decisions and started trusting the data. Our time-to-hire dropped by 40%.")}
              </p>
              <div className="flex items-center gap-4 pt-6 mt-4 border-t border-[var(--border)]">
                <div className={`w-12 h-12 rounded-full ${featured.avatarClass} flex items-center justify-center text-white text-sm font-bold font-display flex-shrink-0`}>
                  {featured.initials}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)] font-display">{featured.name}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{featured.role}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{featured.company}</div>
                </div>
              </div>
            </motion.div>
          </FadeIn>

          {/* Compact — right column, stacked */}
          <div className="flex flex-col gap-5">
            {compact.map((item, i) => (
              <FadeIn key={i} delay={0.15 + i * 0.1} className="flex-1">
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="group h-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col space-y-4 hover:border-[var(--border)]/80 transition-all duration-300 cursor-default"
                >
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed flex-1 italic">
                    &ldquo;{item.quote || (i === 0
                      ? t(locale, "ts.2.quote", "The AI matching is surprisingly accurate. It surfaces candidates I would have missed and explains exactly why.")
                      : t(locale, "ts.3.quote", "Our hiring managers trust the scores because they can see the evidence behind each rating."))}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-3 border-t border-[var(--border)]">
                    <div className={`w-9 h-9 rounded-full ${item.avatarClass} flex items-center justify-center text-white text-xs font-bold font-display flex-shrink-0`}>
                      {item.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)] font-display">{item.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{item.role} · {item.company}</div>
                    </div>
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--border)]" />
    </section>
  );
}
