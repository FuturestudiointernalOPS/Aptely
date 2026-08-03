"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace";
import { getClientLocale, localizePath, removeLocalePrefix, t } from "@/lib/i18n";
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    CalendarRange,
    MessageSquare,
    Shield,
    MoreHorizontal,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";

interface BottomTabBarProps {
    setIsMobileOpen: (v: boolean) => void;
}

type Tab = { name: string; baseHref: string; href: string; icon: React.ElementType };

export default function BottomTabBar({ setIsMobileOpen }: BottomTabBarProps) {
    const pathname = usePathname() ?? "";
    const { isPersonal, active } = useWorkspace();
    const locale = getClientLocale(pathname);
    const tr = (key: string, fallback: string) => t(locale, key, fallback);
    const pathNoLocale = removeLocalePrefix(pathname);

    // Company tabs are role-gated to mirror the sidebar: only HR family sees
    // Applications/Interviews. Others (e.g. MEMBER) get Dashboard + Agenda only.
    const wsRole = active.kind === "institution" ? active.membership.role_specialization : null;
    const wsStatus = active.kind === "institution" ? active.membership.status : null;
    const effectiveRole = wsRole ?? (wsStatus === "OWNER" ? "OWNER" : wsStatus === "ADMIN" ? "ADMIN" : "MEMBER");
    const HR_FAMILY = ["OWNER", "ADMIN", "HR_LEAD", "STANDARD_HR", "RECRUITER", "HIRING_MANAGER"];
    const isHrFamily = HR_FAMILY.includes(effectiveRole);

    const tabs: Tab[] = isPersonal
        ? [
            { name: tr("nav.dashboard", "Accueil"), baseHref: ROUTES.candidate.dashboard, href: ROUTES.candidate.dashboard, icon: LayoutDashboard },
            { name: tr("nav.messages", "Messages"), baseHref: ROUTES.candidate.messages, href: ROUTES.candidate.messages, icon: MessageSquare },
            { name: tr("nav.vault", "Vault"), baseHref: ROUTES.candidate.vault, href: ROUTES.candidate.vault, icon: Shield },
        ]
        : [
            { name: tr("nav.dashboard", "Accueil"), baseHref: ROUTES.company.dashboard, href: localizePath(ROUTES.company.dashboard, locale), icon: LayoutDashboard },
            ...(isHrFamily ? [
                { name: tr("nav.applications", "Candidatures"), baseHref: ROUTES.company.recruitment.applications, href: localizePath(ROUTES.company.recruitment.applications, locale), icon: Users },
                { name: tr("nav.interviews", "Entretiens"), baseHref: ROUTES.company.recruitment.interviews, href: localizePath(ROUTES.company.recruitment.interviews, locale), icon: CalendarRange },
            ] : []),
            { name: tr("nav.calendar", "Agenda"), baseHref: ROUTES.company.calendar, href: localizePath(ROUTES.company.calendar, locale), icon: CalendarDays },
        ];

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-[var(--bg-surface)] border-t border-[var(--border)] pb-safe"
            aria-label={tr("nav.mobileTabs", "Navigation")}
        >
            <div className="flex items-stretch">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = pathNoLocale === tab.baseHref || pathNoLocale.startsWith(`${tab.baseHref}/`);
                    return (
                        <Link
                            key={tab.baseHref}
                            href={tab.href}
                            className={`flex-1 touch-target flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors ${
                                isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                            }`}
                        >
                            <Icon size={20} className="flex-shrink-0" />
                            <span className="text-[10px] font-medium leading-none whitespace-nowrap">{tab.name}</span>
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setIsMobileOpen(true)}
                    className="flex-1 touch-target flex flex-col items-center justify-center gap-0.5 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label={tr("nav.more", "Plus")}
                >
                    <MoreHorizontal size={20} className="flex-shrink-0" />
                    <span className="text-[10px] font-medium leading-none whitespace-nowrap">{tr("nav.more", "Plus")}</span>
                </button>
            </div>
        </nav>
    );
}
