"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Send, ArrowRight } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ScrollProgress from "@/components/landing/ScrollProgress";
import { FadeIn, TiltCard } from "@/components/landing/animations";
import { ROUTES } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";


type FormState = {
  name: string;
  email: string;
  company: string;
  teamSize: string;
  message: string;
};

export default function Demo() {
  const locale = getClientLocale();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.company) {
      setError(t(locale, "demo.error.required", "Please fill in the required fields."));
      return;
    }
    setError("");
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="pt-20 bg-brand-light font-jakarta">
      <ScrollProgress />
      <Navbar />

      {/* Hero */}
      <section className="bg-brand-navy text-white py-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,107,0,0.08),transparent_60%)] pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
        <motion.div
          className="absolute -top-20 -right-20 w-80 h-80 border-[2px] border-white/5 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-60 h-60 border-[2px] border-white/5 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />

        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10">
          {/* Left */}
          <div className="space-y-12">
            <motion.h1
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9]"
            >
              {t(locale, "demo.hero.titlePre", "Book your")} <br />
              <span className="text-brand-orange italic">{t(locale, "demo.hero.titleAccent", "Aptely demo.")}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="text-2xl text-white/50 leading-relaxed font-medium"
            >
              {t(locale, "demo.hero.subtitle", "In 20 minutes, discover how Aptely ranks talents and surfaces the evidence that matters for the decision.")}
            </motion.p>

            <div className="space-y-6">
              <h4 className="text-xs font-black text-brand-orange uppercase tracking-widest italic">{t(locale, "demo.willSee.title", "You'll see:")}</h4>
              <ul className="grid sm:grid-cols-2 gap-5">
                {[
                  t(locale, "demo.willSee.1", "A Capability Record example"),
                  t(locale, "demo.willSee.2", "A detailed, explainable score"),
                  t(locale, "demo.willSee.3", "A recruiter dashboard (sorting + alerts)"),
                  t(locale, "demo.willSee.4", "A generated interview guide"),
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.1 }}
                    className="flex items-start gap-3 text-white/80 font-bold"
                  >
                    <CheckCircle2 size={18} className="text-brand-orange mt-0.5 flex-shrink-0" />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="pt-8 border-t border-white/10 space-y-4"
            >
              <p className="text-white/30 font-black uppercase tracking-[0.3em] text-[10px]">
                {t(locale, "demo.haveAccount", "Already have an account?")}
              </p>
              <Link
                href={ROUTES.login}
                className="inline-flex items-center gap-2 text-brand-orange font-black text-sm hover:gap-3 transition-all"
              >
                {t(locale, "demo.signIn", "Sign in to your space")} <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>

          {/* Right — form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <TiltCard className="bg-white rounded-[3rem] shadow-3xl overflow-hidden">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-16 text-center flex flex-col items-center gap-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                      className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle2 size={48} className="text-emerald-500" />
                    </motion.div>
                    <div className="space-y-4">
                      <h3 className="text-3xl font-black text-brand-deep tracking-tight">{t(locale, "demo.success.title", "Request sent!")}</h3>
                      <p className="text-brand-deep/60 font-medium leading-relaxed">
                        {t(locale, "demo.success.desc", "We'll get back to you within 24h to schedule your personalized demo.")}
                      </p>
                    </div>
                    <div className="px-6 py-3 bg-brand-light rounded-2xl border border-brand-deep/5">
                      <span className="text-xs font-black text-brand-deep/40 uppercase tracking-widest">
                        {t(locale, "demo.success.spam", "Also check your spam folder.")}
                      </span>
                    </div>
                    <div className="pt-4 space-y-3 w-full">
                      <Link
                        href={ROUTES.register}
                        className="block w-full py-4 bg-brand-orange text-white rounded-2xl font-black text-center text-sm uppercase tracking-widest hover:bg-brand-orange/90 transition-colors hover:scale-[1.02]"
                      >
                        {t(locale, "demo.success.createAccount", "Create my account now")}
                      </Link>
                      <Link
                        href="/"
                        className="block w-full py-4 bg-brand-deep/5 text-brand-deep rounded-2xl font-black text-center text-sm uppercase tracking-widest hover:bg-brand-deep/10 transition-colors"
                      >
                        {t(locale, "demo.success.backHome", "Back to home")}
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    onSubmit={handleSubmit}
                    className="p-10 space-y-6"
                  >
                    <div className="mb-8">
                      <h3 className="text-2xl font-black text-brand-deep tracking-tight mb-1">{t(locale, "demo.form.title", "Let's talk about your needs")}</h3>
                      <p className="text-brand-deep/40 font-medium text-sm">
                        {t(locale, "demo.form.subtitle", "We'll prepare a tailored demo based on your criteria.")}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-deep/50 uppercase tracking-widest">
                          {t(locale, "demo.form.name", "First & Last name")} <span className="text-brand-orange">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Marie Dupont"
                          className="w-full px-4 py-3 rounded-xl border border-brand-deep/10 bg-brand-light text-brand-deep font-bold placeholder:text-brand-deep/30 focus:outline-none focus:border-brand-orange text-sm transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-deep/50 uppercase tracking-widest">
                          {t(locale, "demo.form.email", "Work email")} <span className="text-brand-orange">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="marie@entreprise.com"
                          className="w-full px-4 py-3 rounded-xl border border-brand-deep/10 bg-brand-light text-brand-deep font-bold placeholder:text-brand-deep/30 focus:outline-none focus:border-brand-orange text-sm transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-deep/50 uppercase tracking-widest">
                          {t(locale, "demo.form.company", "Company")} <span className="text-brand-orange">*</span>
                        </label>
                        <input
                          type="text"
                          name="company"
                          value={form.company}
                          onChange={handleChange}
                          placeholder="Acme Corp"
                          className="w-full px-4 py-3 rounded-xl border border-brand-deep/10 bg-brand-light text-brand-deep font-bold placeholder:text-brand-deep/30 focus:outline-none focus:border-brand-orange text-sm transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-deep/50 uppercase tracking-widest">
                          {t(locale, "demo.form.teamSize", "HR team size")}
                        </label>
                        <select
                          name="teamSize"
                          value={form.teamSize}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-brand-deep/10 bg-brand-light text-brand-deep font-bold focus:outline-none focus:border-brand-orange text-sm appearance-none transition-colors"
                        >
                          <option value="">{t(locale, "demo.form.select", "Select")}</option>
                          <option value="solo">{t(locale, "demo.form.solo", "I recruit alone")}</option>
                          <option value="1-5">{t(locale, "demo.form.range1", "1 – 5 recruiters")}</option>
                          <option value="5-20">{t(locale, "demo.form.range2", "5 – 20 recruiters")}</option>
                          <option value="20+">{t(locale, "demo.form.range3", "20+ recruiters")}</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-brand-deep/50 uppercase tracking-widest">
                        {t(locale, "demo.form.context", "Your context (optional)")}
                      </label>
                      <textarea
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        rows={3}
                        placeholder={t(locale, "demo.form.contextPlaceholder", "What profiles are you hiring for? What is your main challenge?")}
                        className="w-full px-4 py-3 rounded-xl border border-brand-deep/10 bg-brand-light text-brand-deep font-bold placeholder:text-brand-deep/30 focus:outline-none focus:border-brand-orange text-sm resize-none transition-colors"
                      />
                    </div>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-xs font-black uppercase tracking-widest"
                      >
                        {error}
                      </motion.p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="relative w-full py-4 bg-brand-orange text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-brand-orange/90 transition-all hover:scale-[1.01] active:scale-95 shadow-xl shadow-brand-orange/20 flex items-center justify-center gap-3 disabled:opacity-60 disabled:scale-100"
                    >
                      <span className="absolute inset-0 rounded-2xl bg-brand-orange animate-ping opacity-10 pointer-events-none" />
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t(locale, "demo.form.submitting", "Sending...")}
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          {t(locale, "demo.form.submit", "Request my personalized demo")}
                        </>
                      )}
                    </button>

                    <p className="text-center text-[10px] font-black text-brand-deep/30 uppercase tracking-widest">
                      {t(locale, "demo.form.noCommit", "No commitment · Response within 24h")}
                    </p>

                    <div className="pt-2 border-t border-brand-deep/5 text-center">
                      <span className="text-xs text-brand-deep/40 font-medium">{t(locale, "demo.form.alreadyRegistered", "Already registered?")} </span>
                      <Link href={ROUTES.login} className="text-xs font-black text-brand-orange hover:underline">
                        {t(locale, "demo.form.signIn", "Sign in")}
                      </Link>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </TiltCard>
          </motion.div>
        </div>
      </section>

      {/* Rassurance */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { icon: <ShieldCheck size={28} />, t: t(locale, "demo.reassure.1.t", "Data protected"), d: t(locale, "demo.reassure.1.d", "Minimization principles and strict confidentiality.") },
              { icon: <CheckCircle2 size={28} />, t: t(locale, "demo.reassure.2.t", "No commitment"), d: t(locale, "demo.reassure.2.d", "The demo commits you to nothing. No credit card required.") },
              { icon: <Send size={28} />, t: t(locale, "demo.reassure.3.t", "Response within 24h"), d: t(locale, "demo.reassure.3.d", "Our team gets back to you quickly.") },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <TiltCard className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-brand-light border border-brand-deep/5 h-full">
                  <div className="w-14 h-14 bg-brand-orange/10 rounded-2xl flex items-center justify-center text-brand-orange">
                    {item.icon}
                  </div>
                  <h4 className="font-black text-brand-deep tracking-tight">{item.t}</h4>
                  <p className="text-brand-deep/50 text-sm font-medium leading-relaxed">{item.d}</p>
                </TiltCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
