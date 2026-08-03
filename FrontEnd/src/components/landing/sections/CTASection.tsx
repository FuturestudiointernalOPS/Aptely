"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Zap } from "lucide-react";
import { FadeIn } from "@/components/landing/animations";
import { ROUTES } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";

export default function CTASection() {
  const locale = getClientLocale();
  return (
    <section className="relative py-40 overflow-hidden bg-[var(--bg-deep)]">
      {/* Horizontal rule top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/15 to-transparent" />

      <div className="container mx-auto px-6 max-w-4xl relative z-10 text-center">
        <FadeIn className="space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold uppercase tracking-widest">
            <Zap size={10} className="fill-[var(--accent)]" />
            {t(locale, "cs.badge", "Pilot phase · Free access")}
          </div>

          {/* Headline */}
          <h2 className="text-5xl md:text-6xl xl:text-7xl font-bold text-[var(--text-primary)] leading-[1.05] font-display">
            {t(locale, "cs.titlePre", "Recruit better.")}{" "}
            <span className="text-[var(--accent)]">
              {t(locale, "cs.titleAccent", "Right now.")}
            </span>
          </h2>

          <p className="text-[var(--text-secondary)] text-xl leading-relaxed max-w-xl mx-auto">
            {t(locale, "cs.subtitle", "Join the first teams to recruit on real evidence.")}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href={ROUTES.register}
              className="group inline-flex items-center justify-center bg-[var(--accent)] text-white px-10 py-4 rounded-xl font-semibold text-base gap-2 hover:opacity-90 transition-opacity shadow-[0_8px_30px_oklch(65%_0.22_42_/_0.3)]"
            >
              {t(locale, "cs.ctaStart", "Start for free")}
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Trust line */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex items-center justify-center gap-6 pt-2"
          >
            <p className="text-[var(--text-muted)] text-xs tracking-wide">
              {t(locale, "cs.trust", "No credit card · Cancel anytime · Hosted in Europe")}
            </p>
          </motion.div>
        </FadeIn>
      </div>
    </section>
  );
}
