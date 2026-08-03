"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Minus } from "lucide-react";
import { FadeIn } from "@/components/landing/animations";
import { getClientLocale, t } from "@/lib/i18n";

type Faq = { question: string; answer: string };

function FaqItem({ faq, index }: { faq: Faq; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <FadeIn delay={index * 0.06}>
      <div className="border-b border-[var(--border)] last:border-0 transition-colors">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between py-5 text-left gap-4 group"
        >
          <span className={`font-medium text-base font-display transition-colors ${open ? "text-[var(--accent)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
            {faq.question}
          </span>
          <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${open ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-raised)] text-[var(--text-muted)] group-hover:bg-[var(--bg-raised)]"}`}>
            {open ? <Minus size={13} /> : <Plus size={13} />}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <p className="pb-5 text-[var(--text-muted)] text-sm leading-relaxed font-sans max-w-2xl">
                {faq.answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
}

export default function FaqSection() {
  const locale = getClientLocale();
  const faqs: Faq[] = [
    { question: t(locale, "faq.q1", ""), answer: t(locale, "faq.a1", "") },
    { question: t(locale, "faq.q2", ""), answer: t(locale, "faq.a2", "") },
    { question: t(locale, "faq.q3", ""), answer: t(locale, "faq.a3", "") },
    { question: t(locale, "faq.q4", ""), answer: t(locale, "faq.a4", "") },
    { question: t(locale, "faq.q5", ""), answer: t(locale, "faq.a5", "") },
  ];
  return (
    <section className="bg-[var(--bg-deep)] py-28">
      <div className="container mx-auto px-6 max-w-3xl">
        <FadeIn className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--accent)] text-xs font-semibold uppercase tracking-widest font-sans">
            {t(locale, "faq.badge", "FAQ")}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] leading-tight font-display">
            {t(locale, "faq.headingPre", "Frequently asked")} <span className="text-[var(--accent)]">{t(locale, "faq.headingAccent", "questions")}</span>
          </h2>
          <p className="text-[var(--text-muted)] text-base font-sans">
            {t(locale, "faq.subtitle", "Everything you want to know before getting started.")}
          </p>
        </FadeIn>

        <div>
          {faqs.map((faq, i) => (
            <FaqItem key={i} faq={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
