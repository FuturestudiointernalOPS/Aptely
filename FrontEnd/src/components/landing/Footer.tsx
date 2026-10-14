"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/routes";
import { getClientLocale, localizePath, t } from "@/lib/i18n";

const Footer: React.FC = () => {
  const locale = getClientLocale();
  const howItWorksHref = `${localizePath("/", locale)}#how-it-works`;
  return (
    <footer className="bg-[var(--bg-deep)] pt-20 pb-10 border-t border-[var(--border)]">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid md:grid-cols-12 gap-12 mb-16">

          {/* Brand col */}
          <div className="md:col-span-4 space-y-6">
            <Link href="/" className="flex items-center gap-3 group w-fit">
              <Image
                src="/logo.png"
                alt="Aptely"
                width={120}
                height={32}
                className="h-8 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity"
              />
            </Link>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed font-sans max-w-xs">
              {t(locale, "footer.tagline", "Talent intelligence for tech and digital recruiters. Verified skills, AI matching, evidence-based decisions.")}
            </p>
          </div>

          {/* Product col */}
          <div className="md:col-span-2 space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] font-sans">{t(locale, "footer.col.product", "Product")}</p>
            <nav className="flex flex-col gap-3">
              {[
                { label: t(locale, "footer.link.demo", "How it works"), href: howItWorksHref },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-sans">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Account + Legal col */}
          <div className="md:col-span-6 space-y-8">
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] font-sans">{t(locale, "footer.col.account", "Account")}</p>
              <nav className="flex flex-col gap-3">
                {[
                  { label: t(locale, "footer.link.login", "Sign in"), href: ROUTES.login },
                  { label: t(locale, "footer.link.register", "Create account"), href: ROUTES.register },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-sans">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] font-sans">{t(locale, "footer.col.legal", "Legal")}</p>
              <nav className="flex flex-col gap-3">
                {[
                  { label: t(locale, "footer.link.privacy", "Privacy"), href: ROUTES.privacy },
                  { label: t(locale, "footer.link.terms", "Terms of use"), href: ROUTES.terms },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-sans">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-[var(--text-muted)] font-sans">
            {t(locale, "footer.copyright", "© {{year}} Aptely — A Future Studio initiative.", { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[var(--text-muted)] font-sans">{t(locale, "footer.pilotPhase", "Pilot phase active")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
