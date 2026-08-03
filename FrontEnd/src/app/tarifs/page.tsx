"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollProgress from "@/components/landing/ScrollProgress";
import { FadeIn, TiltCard, PulsingCTA } from "@/components/landing/animations";
import { getClientLocale, t } from "@/lib/i18n";

export default function Tarifs() {
  const locale = getClientLocale();
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="landing-page pt-20 bg-[var(--bg-deep)] font-jakarta">
      <ScrollProgress />
      <Navbar />

      {/* Hero */}
      <section className="bg-[var(--bg-deep)] py-40 relative overflow-hidden">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-[var(--accent-dim)] rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-[var(--accent)]/5 rounded-full blur-3xl animate-float pointer-events-none" />

        <div className="container mx-auto px-6 text-center max-w-5xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-5 py-2 bg-[var(--accent-dim)] border border-[var(--accent)]/20 rounded-full text-[10px] font-black text-[var(--accent)] uppercase tracking-[0.3em] mb-10">
              {t(locale, "tarifs.badge", "Pricing")}
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="text-6xl md:text-8xl font-black mb-10 tracking-tighter leading-[0.9] text-[var(--text-primary)]"
          >
            {t(locale, "tarifs.hero.titlePre", "Plans tailored")} <br />
            <span className="text-[var(--accent)] italic">{t(locale, "tarifs.hero.titleAccent", "to your hiring volume.")}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl text-[var(--text-muted)] mb-16 leading-relaxed font-medium"
          >
            {t(locale, "tarifs.hero.subtitle", "Choose your level of access to verified talents, scoring and insights.")}
          </motion.p>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[var(--text-primary)] font-black hover:text-[var(--accent)] transition-colors flex items-center gap-3 mx-auto uppercase tracking-widest text-xs"
          >
            {t(locale, "tarifs.compare", "Compare plans")} <ArrowRight size={16} />
          </motion.button>
        </div>
      </section>

      {/* Toggle */}
      <section className="py-20 flex justify-center items-center gap-6">
        <span
          className={`text-sm font-black uppercase tracking-widest transition-colors ${
            !isAnnual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
          }`}
        >
          {t(locale, "tarifs.monthly", "Monthly")}
        </span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className="w-16 h-8 bg-[var(--text-primary)] rounded-full p-1 relative transition-colors"
        >
          <motion.div
            animate={{ x: isAnnual ? 32 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-6 h-6 bg-[var(--accent)] rounded-full"
          />
        </button>
        <span
          className={`text-sm font-black uppercase tracking-widest transition-colors ${
            isAnnual ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
          }`}
        >
          {t(locale, "tarifs.annual", "Annual")}
        </span>
        {isAnnual && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[10px] font-black uppercase tracking-[0.2em] bg-[var(--accent)] text-white px-3 py-1 rounded-full"
          >
            {t(locale, "tarifs.preferential", "Preferential terms")}
          </motion.span>
        )}
      </section>

      {/* Plan cards */}
      <section className="py-20 container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8 items-start">
          {[
            {
              name: t(locale, "tarifs.plan1.name", "Starter — SMB"),
              desc: t(locale, "tarifs.plan1.desc", "To get started with matching and structured profiles."),
              cta: t(locale, "tarifs.plan1.cta", "Request a demo"),
              features: [t(locale, "tarifs.plan1.f1", "Standard profiling"), t(locale, "tarifs.plan1.f2", "Basic scoring"), t(locale, "tarifs.plan1.f3", "Platform access")],
            },
            {
              name: t(locale, "tarifs.plan2.name", "Pro — Scale-up"),
              desc: t(locale, "tarifs.plan2.desc", "To hire faster with advanced insights."),
              cta: t(locale, "tarifs.plan2.cta", "Book a demo"),
              badge: t(locale, "tarifs.plan2.badge", "Recommended"),
              features: [t(locale, "tarifs.plan2.f1", "Advanced insights"), t(locale, "tarifs.plan2.f2", "Prioritized workflow"), t(locale, "tarifs.plan2.f3", "Risk analysis"), t(locale, "tarifs.plan2.f4", "Interview guides")],
            },
            {
              name: t(locale, "tarifs.plan3.name", "Premium — Enterprise / Agencies"),
              desc: t(locale, "tarifs.plan3.desc", "For volume, specific needs and dedicated support."),
              cta: t(locale, "tarifs.plan3.cta", "Contact the team"),
              features: [t(locale, "tarifs.plan3.f1", "Tailor-made"), t(locale, "tarifs.plan3.f2", "ATS integrations"), t(locale, "tarifs.plan3.f3", "Dedicated account"), t(locale, "tarifs.plan3.f4", "Unlimited analyses")],
            },
          ].map((plan, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <TiltCard
                className={`bg-[var(--bg-surface)] p-12 rounded-[3.5rem] border border-[var(--border)] flex flex-col h-full shadow-2xl relative ${
                  plan.badge ? "ring-4 ring-[var(--accent)] scale-105 z-10" : ""
                }`}
              >
                {plan.badge && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--accent)] text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-3xl font-black text-[var(--text-primary)] mb-6 leading-tight tracking-tight">{plan.name}</h3>
                <p className="text-[var(--text-secondary)] mb-10 leading-relaxed font-medium flex-1">{plan.desc}</p>
                <ul className="space-y-4 mb-12">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm font-bold text-[var(--text-secondary)]">
                      <CheckCircle2 size={16} className="text-[var(--accent)]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/demo"
                  className={`w-full py-5 rounded-2xl font-black text-center transition-all hover:scale-[1.02] ${
                    plan.badge
                      ? "bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/20"
                      : "bg-[var(--text-primary)] text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </TiltCard>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-40 bg-[var(--bg-surface)]">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <FadeIn>
            <h2 className="text-4xl font-black text-[var(--text-primary)] mb-20 tracking-tight">{t(locale, "tarifs.faq.title", "Pricing FAQ")}</h2>
          </FadeIn>
          <div className="space-y-12 text-left">
            {[
              { q: t(locale, "tarifs.faq.q1", "Is there a commitment?"), a: t(locale, "tarifs.faq.a1", "Our plans are designed to offer maximum flexibility.") },
              { q: t(locale, "tarifs.faq.q2", "Can we try before subscribing?"), a: t(locale, "tarifs.faq.a2", "Absolutely, contact us for trial access.") },
              { q: t(locale, "tarifs.faq.q3", "Which payment methods are accepted?"), a: t(locale, "tarifs.faq.a3", "Bank transfer, credit card and direct debit.") },
            ].map((faq, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="pb-8 border-b border-[var(--border)] group hover:pl-4 transition-all duration-300">
                  <h4 className="text-xl font-black text-[var(--text-primary)] mb-4 tracking-tight leading-tight group-hover:text-[var(--accent)] transition-colors">{faq.q}</h4>
                  <p className="text-[var(--text-muted)] leading-relaxed font-medium">{faq.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn className="mt-20">
            <button className="text-[var(--accent)] font-black hover:text-[var(--text-primary)] transition-colors flex items-center gap-3 mx-auto uppercase tracking-widest text-xs">
              {t(locale, "tarifs.faq.talk", "Talk to an advisor")} <ArrowRight size={16} />
            </button>
          </FadeIn>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-40 bg-[var(--bg-deep)] overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,107,0,0.08),transparent_60%)] pointer-events-none" />
        <motion.div
          className="absolute -top-20 -right-20 w-80 h-80 border-[3px] border-[var(--border)] rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-20 -left-20 w-60 h-60 border-[3px] border-[var(--border)] rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <div className="container mx-auto px-6 text-center relative z-10">
          <FadeIn>
            <h2 className="text-6xl md:text-8xl font-black mb-12 tracking-tighter leading-none text-[var(--text-primary)]">
              {t(locale, "tarifs.cta.titlePre", "Choose evidence-based")} <br />
              <span className="text-[var(--accent)] italic">{t(locale, "tarifs.cta.titleAccent", "recruiting.")}</span>
            </h2>
            <PulsingCTA href="/demo">{t(locale, "tarifs.cta.book", "Book a demo")}</PulsingCTA>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
