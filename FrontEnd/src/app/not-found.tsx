"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">

        {/* Logo Aptely */}
        <div className="flex items-center justify-center gap-2.5">
          <svg viewBox="0 0 100 100" className="w-8 h-8" aria-hidden="true">
            <circle cx="55" cy="45" r="30" fill="none" stroke="currentColor" strokeWidth="10" className="text-[var(--text-primary)]" />
            <line x1="15" y1="85" x2="35" y2="65" stroke="currentColor" strokeWidth="12" strokeLinecap="round" className="text-[var(--text-primary)]" />
            <path d="M55 25 L58 42 L75 45 L58 48 L55 65 L52 48 L35 45 L52 42 Z" fill="var(--accent)" />
          </svg>
          <span className="text-lg font-semibold text-[var(--text-primary)]">Aptely</span>
        </div>

        {/* 404 */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {tr("notFound.errorCode", "Erreur 404")}
          </p>
          <h1 className="text-5xl font-extrabold text-[var(--text-primary)]">
            Page introuvable
          </h1>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
            {tr("notFound.description", "La page que vous recherchez n'existe pas dans notre pipeline actuel. Elle a peut-être été déplacée, supprimée, ou vous avez suivi un lien invalide.")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={ROUTES.company.dashboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            <Home className="h-4 w-4" />
            {tr("notFound.returnDashboard", "Retourner au tableau de bord")}
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-colors"
          >
            {tr("notFound.goHomepage", "Accueil")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mx-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr("notFound.goBack", "Revenir à la page précédente")}
        </button>

        {/* Conseil */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{tr("notFound.tipsTitle", "Conseil")}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {tr("notFound.tipsBody", "Vérifiez la structure de l'URL. Si vous avez cliqué sur un lien candidat partagé, assurez-vous qu'il correspond exactement sans caractère manquant.")}
          </p>
        </div>
      </div>
    </div>
  );
}
