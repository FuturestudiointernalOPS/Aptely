"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { getClientLocale, localizePath, setLocaleCookie, t, type Locale } from "@/lib/i18n";

const LOCALE_OPTIONS: Locale[] = ["fr", "en"];

const Navbar: React.FC = () => {
  const pathname = usePathname();
  const locale = getClientLocale();
  const howItWorksHref = `${localizePath("/", locale)}#how-it-works`;

  const switchLocale = (nextLocale: Locale) => {
    if (typeof window === "undefined") return;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setLocaleCookie(nextLocale);
    window.location.assign(localizePath(currentPath, nextLocale));
  };

  const NAV_LINKS: { label: string; path: string }[] = [
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] px-6 pt-5">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 22, stiffness: 120 }}
          className={`container mx-auto max-w-6xl rounded-2xl px-5 py-3 flex items-center justify-between transition-all duration-300 ${
            scrolled
              ? "bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border)] shadow-2xl shadow-black/20"
              : "bg-transparent border border-transparent"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full text-[var(--text-primary)] group-hover:rotate-12 transition-transform duration-300">
                <circle cx="55" cy="45" r="30" fill="none" stroke="currentColor" strokeWidth="10" />
                <line x1="15" y1="85" x2="35" y2="65" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
                <path d="M55 25 L58 42 L75 45 L58 48 L55 65 L52 48 L35 45 L52 42 Z" fill="#FF6B00" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-display">Aptely</span>
          </Link>

          {/* Nav links — desktop */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((item) => {
              const active = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-colors font-sans ${
                    active
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-[var(--accent-dim)]"
                      transition={{ type: "spring", damping: 20, stiffness: 200 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Actions — desktop */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] overflow-hidden mr-1">
              {LOCALE_OPTIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => switchLocale(loc)}
                  className={`px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                    locale === loc
                      ? "bg-[var(--bg-surface)] text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
            <Link
              href={ROUTES.login}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-sans"
            >
              {t(locale, "footer.link.login", "Sign in")}
            </Link>
            <Link
              href={howItWorksHref}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all font-sans"
            >
              {t(locale, "nav.demo", "How it works")}
            </Link>
            <Link
              href={ROUTES.register}
              className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 transition-all active:scale-95 font-sans"
            >
              {t(locale, "nav.start", "Get started →")}
            </Link>
          </div>

          {/* Hamburger — mobile */}
          <button
            className="md:hidden p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </motion.nav>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed top-[76px] left-4 right-4 z-[99] bg-[var(--bg-surface)] backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-2xl shadow-black/20 p-4 flex flex-col gap-1"
          >
            {NAV_LINKS.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all font-sans ${
                  pathname === item.path
                    ? "text-[var(--text-primary)] bg-[var(--accent-dim)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)]"
                }`}
              >
                {item.label}
              </Link>
            ))}

            <div className="h-px bg-[var(--border)] my-1" />

            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-xs text-[var(--text-muted)]">{t(locale, "locale.language", "Language")}</span>
              <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
                {LOCALE_OPTIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => switchLocale(loc)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
                      locale === loc
                        ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <Link
              href={ROUTES.login}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-all font-sans"
            >
              {t(locale, "footer.link.login", "Sign in")}
            </Link>
            <Link
              href={ROUTES.register}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-white bg-[var(--accent)] text-center shadow-lg shadow-[var(--accent)]/20 font-sans"
            >
              {t(locale, "nav.start", "Get started →")}
            </Link>
            <Link
              href={howItWorksHref}
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-[var(--text-secondary)] border border-[var(--border)] text-center font-sans"
            >
              {t(locale, "footer.link.requestDemo", "How it works")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
