"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getClientLocale, t } from "@/lib/i18n";
import { AlertTriangle, CheckCircle2, Building2, ArrowRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";


export default function InstitutionAccessStatusPage() {
  const searchParams = useSearchParams();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const state = searchParams.get("state") || "incomplete";
  const reason = searchParams.get("reason") || "";

  const isApproved = state === "approved";
  const isForbidden = state === "forbidden";

  const title = isApproved
    ? tr("institution.accessStatus.title.approved", "Compte déjà actif")
    : isForbidden
      ? tr("institution.accessStatus.title.forbidden", "Accès non autorisé")
      : tr("institution.accessStatus.title.incomplete", "Configuration institution requise");

  const description = isApproved
    ? tr("institution.accessStatus.description.approved", "Votre compte est déjà rattaché à une institution. Passez directement à votre tableau de bord.")
    : isForbidden
      ? tr("institution.accessStatus.description.forbidden", "Cette section est réservée aux membres RH.")
      : tr("institution.accessStatus.description.incomplete", "Vous devez créer ou rejoindre une institution avant d’accéder à cette section.");

  const ctaHref = isApproved
    ? ROUTES.company.dashboard
    : isForbidden
      ? "/"
      : ROUTES.company.settings.onboarding;

  const ctaLabel = isApproved
    ? tr("institution.accessStatus.cta.approved", "Ouvrir le dashboard")
    : isForbidden
      ? tr("institution.accessStatus.cta.forbidden", "Retour à l’accueil")
      : tr("institution.accessStatus.cta.incomplete", "Configurer mon institution");

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
            {isApproved ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : isForbidden ? (
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            ) : (
              <Building2 className="w-6 h-6 text-[var(--accent)]" />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--text-primary)]">{title}</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2">{description}</p>
            {reason && <p className="text-xs text-[var(--text-muted)] mt-2">{tr("institution.accessStatus.reason", "Motif")}: {reason}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent)]-soft transition-colors"
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href={ROUTES.company.dashboard} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            {tr("institution.accessStatus.goDashboard", "Aller au dashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
