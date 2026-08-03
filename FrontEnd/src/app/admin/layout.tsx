"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiHelper";
import { adminStatsApi, ROUTES } from "@/lib/routes";
import { getClientLocale, t } from "@/lib/i18n";
import {
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  ShieldAlert,
} from "lucide-react";

const navItems = [
  { href: ROUTES.admin.root,         label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: ROUTES.admin.users,        label: "Utilisateurs",   icon: Users },
  { href: ROUTES.admin.institutions, label: "Entreprises",    icon: Building2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const locale = getClientLocale();

  useEffect(() => {
    apiFetch(adminStatsApi).then((data) => {
      // null = 403 (not super admin) / network error; isAuthError = 401 (not logged in).
      // Both mean no admin access — without this check the 401 object passed the gate
      // and the page crashed rendering invalid stats ("une erreur est survenue").
      if (data === null || (data as { isAuthError?: boolean }).isAuthError) {
        router.replace(ROUTES.login);
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Aptely Admin</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Platform Control</p>
        </div>

        <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== ROUTES.admin.root && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-[var(--border)]">
          <Link
            href={ROUTES.candidate.dashboard}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors"
          >
            <LogOut size={16} />
            {t(locale, "admin.backToSpace", "Retour à l'espace")}
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
