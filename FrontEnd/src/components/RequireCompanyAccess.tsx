"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import { useCompanyPageAccess, type RestrictedCompanyPage } from "@/lib/companyAccess";

/** Renders its children only for roles allowed on `page`; others get an "access denied" screen. */
export function RequireCompanyAccess({
  page,
  children,
}: {
  page: RestrictedCompanyPage;
  children: React.ReactNode;
}) {
  const access = useCompanyPageAccess(page);
  const locale = getClientLocale();

  if (access === "loading") return null;
  if (access === "allowed") return <>{children}</>;

  return (
    <div className="max-w-md mx-auto mt-20 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
      <ShieldAlert className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
      <h2 className="text-lg font-bold text-[var(--text-primary)]">
        {t(locale, "access.denied.title", "Access denied")}
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        {t(locale, "access.denied.desc", "Your role does not give you access to this page.")}
      </p>
      <Link
        href={ROUTES.company.dashboard}
        className="inline-block rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
      >
        {t(locale, "access.denied.back", "Back to dashboard")}
      </Link>
    </div>
  );
}
