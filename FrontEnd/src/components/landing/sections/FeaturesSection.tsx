"use client";

import React from "react";
import { motion } from "motion/react";
import { Database, ScanSearch, Workflow, Heart, Trophy } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 90, damping: 20 } },
};

export default function FeaturesSection() {
  const locale = getClientLocale();

  const SPOTLIGHT_FEATURES = [
    {
      icon: Database,
      eyebrow: t(locale, "fs.spot1.eyebrow", "Foundation"),
      title: t(locale, "fs.spot1.title", "Capability Records"),
      description: t(locale, "fs.spot1.desc", ""),
      detail: t(locale, "fs.spot1.detail", ""),
      iconColor: "text-[var(--accent)]",
      tag: t(locale, "fs.spot1.tag", "Core of the system"),
      flip: false,
    },
    {
      icon: ScanSearch,
      eyebrow: t(locale, "fs.spot2.eyebrow", "Intelligence"),
      title: t(locale, "fs.spot2.title", "Explainable AI matching"),
      description: t(locale, "fs.spot2.desc", ""),
      detail: t(locale, "fs.spot2.detail", ""),
      iconColor: "text-blue-400",
      tag: t(locale, "fs.spot2.tag", "Aptely AI"),
      flip: true,
    },
  ];

  const SECONDARY_FEATURES = [
    {
      icon: Workflow,
      title: t(locale, "fs.sec1.title", "Workflow Manager"),
      description: t(locale, "fs.sec1.desc", ""),
      iconColor: "text-purple-400",
      tag: t(locale, "fs.sec1.tag", "Pipeline"),
      span: "sm:col-span-4",
      accent: "border-purple-400/10 hover:border-purple-400/20",
    },
    {
      icon: Heart,
      title: t(locale, "fs.sec2.title", "Scored soft skills"),
      description: t(locale, "fs.sec2.desc", ""),
      iconColor: "text-emerald-400",
      tag: t(locale, "fs.sec2.tag", "Human + AI"),
      span: "sm:col-span-2",
      accent: "border-emerald-400/10 hover:border-emerald-400/20",
    },
    {
      icon: Trophy,
      title: t(locale, "fs.sec3.title", "Success context"),
      description: t(locale, "fs.sec3.desc", ""),
      iconColor: "text-amber-400",
      tag: t(locale, "fs.sec3.tag", "Predictive"),
      span: "sm:col-span-6",
      accent: "border-amber-400/10 hover:border-amber-400/20",
    },
  ];

  return (
    <section className="relative bg-[var(--bg-deep)] py-32 overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl relative z-10">

        {/* Section header — stagger in */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="max-w-xl mb-20 space-y-5"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">
            {t(locale, "fs.badge", "Features")}
          </motion.div>
          <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] leading-tight font-display">
            {t(locale, "fs.titlePre", "Everything you need to")}{" "}
            <span className="text-[var(--accent)]">{t(locale, "fs.titleAccent", "hire right")}</span>
          </motion.h2>
          <motion.p variants={itemVariants} className="text-[var(--text-secondary)] text-lg leading-relaxed">
            {t(locale, "fs.subtitle", "A platform built for tech recruiters who want decisions grounded in real data.")}
          </motion.p>
        </motion.div>

        {/* Spotlight features — stagger */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="space-y-6 mb-6"
        >
          {SPOTLIGHT_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={i} variants={itemVariants} className="group relative bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--bg-raised)] transition-all duration-300 p-8 md:p-12">
                <div className={`relative flex flex-col ${f.flip ? "md:flex-row-reverse" : "md:flex-row"} gap-10 items-start`}>
                  <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={f.iconColor} />
                      <span className={`text-[10px] font-semibold uppercase tracking-widest opacity-60 ${f.iconColor}`}>
                        {f.eyebrow}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] font-display leading-snug">
                      {f.title}
                    </h3>
                    <p className="text-[var(--text-secondary)] text-base leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                  <div className="flex-1 md:max-w-[44%]">
                    <div className="border-l border-[var(--border)] pl-5">
                      <p className="text-[var(--text-muted)] text-sm leading-relaxed italic">
                        {f.detail}
                      </p>
                    </div>
                    <div className={`mt-6 inline-flex items-center gap-1.5 text-xs font-semibold ${f.iconColor} opacity-0 group-hover:opacity-100 transition-all duration-300`}>
                      {t(locale, "fs.learnMore", "Learn more")}
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Secondary features — bento stagger */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="grid grid-cols-1 sm:grid-cols-6 gap-4"
        >
          {SECONDARY_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={i} variants={itemVariants} className={f.span}>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`group relative h-full bg-[var(--bg-surface)] border ${f.accent} border-[var(--border)] rounded-2xl p-6 space-y-4 transition-all duration-300 cursor-default overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
                      <Icon size={16} className={f.iconColor} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)]">
                      {f.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] font-display text-base leading-snug mb-2">
                      {f.title}
                    </h3>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
