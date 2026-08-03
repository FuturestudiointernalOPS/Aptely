"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Menu, MessageSquare, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import {
    getClientLocale,
    localizePath,
    removeLocalePrefix,
    setLocaleCookie,
    t,
    type Locale,
} from "@/lib/i18n";
import {
  API,
  ROUTES,
  rolesSubPathPrefix,
  applicationsSubPathPrefix,
  offersSubPathPrefix,
  candidateReflectionPrefix,
} from "@/lib/routes";
import { apiFetch } from "@/lib/apiHelper";
import NotificationBell from "@/components/NotificationBell";

const LOCALE_OPTIONS: Locale[] = ["fr", "en"];

const getBreadcrumbMap = (locale: Locale): Record<string, string[]> => ({
    [ROUTES.company.dashboard]: [t(locale, "nav.dashboard", "Dashboard")],
    [ROUTES.company.recruitment.applications]: [t(locale, "nav.applications", "Applications")],
    [ROUTES.company.recruitment.interviews]: [t(locale, "nav.interviews", "Interviews")],
    [ROUTES.company.recruitment.roles]: [t(locale, "nav.roles", "Job Post Sheets")],
    [ROUTES.company.recruitment.offers]: [t(locale, "nav.offers", "Offers")],
    [ROUTES.company.settings.hr]: [t(locale, "nav.team", "Team"), t(locale, "nav.management", "Management")],
    [ROUTES.company.settings.permissions]: [t(locale, "nav.team", "Team"), t(locale, "nav.permissions", "Permissions")],
    [ROUTES.company.settings.settings]: [t(locale, "nav.settings", "Settings"), t(locale, "nav.institution", "Institution")],
    [ROUTES.company.settings.accessStatus]: [t(locale, "nav.institution", "Institution"), t(locale, "nav.accessStatus", "Access status")],
    [ROUTES.company.recruitment.onboarding]: [t(locale, "nav.onboarding", "Onboarding")],
    [ROUTES.company.settings.onboarding]: [t(locale, "nav.institution", "Institution"), t(locale, "nav.onboarding", "Onboarding")],
    [ROUTES.company.settings.organization]: [t(locale, "nav.module.admin", "Administration"), t(locale, "nav.organization", "Organisation")],
    [ROUTES.company.calendar]:  [t(locale, "nav.calendar", "Agenda")],
    [ROUTES.company.interviewer]: [t(locale, "nav.interviewer", "Interviewer")],
    [ROUTES.company.hr.root]:  [t(locale, "nav.module.employees", "Employés")],
    [ROUTES.company.hr.leave]: [t(locale, "nav.module.employees", "Employés"), t(locale, "nav.leave", "Congés")],
    [ROUTES.company.analytics]: [t(locale, "nav.analytics", "Analytiques")],
    [ROUTES.company.analyticsRetention]: [t(locale, "nav.analytics", "Analytiques"), t(locale, "nav.retention", "Rétention")],
    [ROUTES.company.payroll]: [t(locale, "nav.payroll", "Paie")],
    [ROUTES.company.goals]: [t(locale, "nav.goals", "Goals & OKRs")],
    [ROUTES.candidate.dashboard]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.candidateDashboard", "Mes candidatures")],
    [ROUTES.candidate.profile]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.candidateProfile", "Mon profil")],
    [ROUTES.candidate.vault]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.vault", "Coffre")],
    [ROUTES.candidate.messages]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.messages", "Messages")],
    [ROUTES.candidate.offers]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.offers", "Offres")],
    [ROUTES.candidate.onboarding]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.onboarding", "Intégration")],
    [ROUTES.candidate.export]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.export", "Partager mon profil")],
    [ROUTES.candidate.prep]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.prep", "Préparation")],
    [ROUTES.candidate.calendar]: [t(locale, "topbar.role.candidate", "Candidat"), t(locale, "nav.candidateCalendar", "Mon Agenda")],
});

const SEGMENT_LABELS: Record<string, Record<string, string>> = {
    company:    { fr: "Entreprise",   en: "Company" },
    employees:  { fr: "Employés",     en: "Employees" },
    analytics:  { fr: "Analytiques",  en: "Analytics" },
    retention:  { fr: "Rétention",    en: "Retention" },
    payroll:    { fr: "Paie",         en: "Payroll" },
    goals:      { fr: "Goals",        en: "Goals" },
    calendar:   { fr: "Agenda",       en: "Calendar" },
    recruitment:{ fr: "Recrutement",  en: "Recruitment" },
    interviews: { fr: "Entretiens",   en: "Interviews" },
    offers:     { fr: "Offres",       en: "Offers" },
    roles:      { fr: "Fiches de poste", en: "Job Posts" },
    candidates: { fr: "Candidats",    en: "Candidates" },
    settings:   { fr: "Paramètres",   en: "Settings" },
    learning:   { fr: "Learning",     en: "Learning" },
    compensation: { fr: "Rémunération", en: "Compensation" },
    offboarding:{ fr: "Offboarding",  en: "Offboarding" },
    new:        { fr: "Nouveau",      en: "New" },
};

const mapPathSegment = (segment: string, locale: Locale) => {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(segment)) {
        return t(locale, "nav.details", "Détails");
    }
    const known = SEGMENT_LABELS[segment.toLowerCase()];
    if (known) return known[locale] ?? known.en;
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
};

interface TopBarProps {
    isMobileOpen: boolean;
    setIsMobileOpen: (v: boolean) => void;
}

export default function TopBar({ isMobileOpen, setIsMobileOpen }: TopBarProps) {
    void isMobileOpen;
    const pathname = usePathname() ?? "";
    const router = useRouter();
    const { user } = useAuth();
    const { active } = useWorkspace();
    const [query, setQuery] = useState("");
    const membershipBadge = useMemo<"OWNER" | "ADMIN" | "MEMBER" | null>(() => {
        if (active.kind !== "institution") return null;
        const status = active.membership.status;
        if (status === "OWNER") return "OWNER";
        if (status === "ADMIN") return "ADMIN";
        return "MEMBER";
    }, [active]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (active.kind !== "personal" || !user) return;
        const load = async () => {
            try {
                const data = await apiFetch(API.messages, "HR", { method: "GET", cache: "no-store" }) as Array<{ unread_count: number }> | null;
                const total = Array.isArray(data) ? data.reduce((s, msg) => s + (msg.unread_count ?? 0), 0) : 0;
                setUnreadCount(total);
            } catch { /* ignore */ }
        };
        void load();
    }, [active.kind, user, pathname]);

    const currentLocale = useMemo<Locale>(() => {
        return getClientLocale(pathname);
    }, [pathname]);

    const switchLocale = (nextLocale: Locale) => {
        if (typeof window === "undefined") return;
        const currentPath = `${window.location.pathname || "/"}${window.location.search}${window.location.hash}`;
        const nextPath = localizePath(currentPath, nextLocale);
        setLocaleCookie(nextLocale);
        window.location.assign(nextPath);
    };

    const translate = useMemo(() => {
        return (key: string, fallback: string) => t(currentLocale, key, fallback);
    }, [currentLocale]);

    // Display label is role-aware (custom roles show their own name); color keys off membershipBadge.
    const membershipLabel = useMemo<string | null>(() => {
        if (active.kind !== "institution") return null;
        const rs = active.membership.role_specialization;
        const customLabel = active.membership.role_custom_label;
        if (customLabel) return customLabel;  // custom label for ANY role (incl. OWNER)
        const map: Record<string, string> = {
            OWNER: translate("perm.role.owner", "Propriétaire"),
            ADMIN: translate("perm.role.admin", "Administrateur"),
            HR_LEAD: translate("perm.role.hrLead", "Responsable RH"),
            STANDARD_HR: translate("perm.role.standardHr", "RH"),
            HIRING_MANAGER: translate("perm.role.hiringManager", "Manager recruteur"),
            RECRUITER: translate("perm.role.recruiter", "Recruteur"),
            MEMBER: translate("perm.role.member", "Membre"),
        };
        if (rs && map[rs]) return map[rs];
        return membershipBadge;
    }, [active, translate, membershipBadge]);

    const pathnameWithoutLocale = useMemo(() => removeLocalePrefix(pathname), [pathname]);

    const quickRoutes = useMemo(
        () => {
            const isInstitution = active.kind === "institution";
            if (isInstitution) {
                return [
                    { label: translate("nav.dashboard", "Dashboard"), href: localizePath(ROUTES.company.dashboard, currentLocale) },
                    { label: translate("nav.applications", "Applications"), href: localizePath(ROUTES.company.recruitment.applications, currentLocale) },
                    { label: translate("nav.interviews", "Interviews"), href: localizePath(ROUTES.company.recruitment.interviews, currentLocale) },
                    { label: translate("nav.roles", "Job Post Sheets"), href: localizePath(ROUTES.company.recruitment.roles, currentLocale) },
                    { label: translate("nav.team", "Team"), href: localizePath(ROUTES.company.settings.hr, currentLocale) },
                    { label: translate("nav.permissions", "Permissions"), href: localizePath(ROUTES.company.settings.permissions, currentLocale) },
                    { label: translate("nav.settings", "Settings"), href: localizePath(ROUTES.company.settings.settings, currentLocale) },
                ];
            }
            return [
                { label: translate("nav.dashboard", "Dashboard"), href: localizePath(ROUTES.candidate.dashboard, currentLocale) },
                { label: translate("nav.profile", "Profile"), href: localizePath(ROUTES.candidate.profile, currentLocale) },
                { label: translate("nav.vault", "Vault"), href: localizePath(ROUTES.candidate.vault, currentLocale) },
                { label: translate("nav.cvStudio", "CV Studio"), href: localizePath(ROUTES.candidate.cvStudio, currentLocale) },
                { label: translate("nav.opportunities", "Opportunities"), href: localizePath(ROUTES.candidate.opportunities, currentLocale) },
                { label: translate("nav.settings", "Settings"), href: localizePath(ROUTES.candidate.settings, currentLocale) },
            ];
        },
        [currentLocale, translate, active.kind]
    );

    const crumbs = pathnameWithoutLocale.startsWith(rolesSubPathPrefix)
        ? [translate("nav.roles", "Job Post Sheets"), translate("nav.pipeline", "Pipeline")]
        : pathnameWithoutLocale.startsWith(applicationsSubPathPrefix)
            ? [translate("nav.applications", "Applications"), translate("nav.details", "Details")]
            : pathnameWithoutLocale.startsWith(offersSubPathPrefix)
                ? [translate("nav.offers", "Offers"), translate("nav.details", "Details")]
                : pathnameWithoutLocale.startsWith(candidateReflectionPrefix)
                    ? [translate("topbar.role.candidate", "Candidat"), translate("individual.reflection.title", "Réflexion post-entretien")]
                    : getBreadcrumbMap(currentLocale)[pathnameWithoutLocale]
                    ?? pathnameWithoutLocale
                        .split("/")
                        .filter(Boolean)
                        .map((segment) => mapPathSegment(segment, currentLocale));

    const filteredQuickRoutes = useMemo(() => {
        if (!query.trim()) return quickRoutes;
        const term = query.trim().toLowerCase();
        return quickRoutes.filter((item) => item.label.toLowerCase().includes(term));
    }, [quickRoutes, query]);

    const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const target = filteredQuickRoutes[0];
        if (!target) return;
        router.push(target.href);
        setQuery("");
    };

    const initial = user?.email ? user.email.charAt(0).toUpperCase() : "?";
    // In an institution workspace the pill shows the institution logo (falls back to the
    // user avatar / initial). Kept in sync via workspace.refresh() after a logo change.
    const institutionLogoUrl =
        active.kind === "institution" ? active.membership.institution_logo_url : null;
    return (
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="mx-auto flex h-[52px] w-full items-center justify-between gap-3 px-4 sm:px-6">

                {/* LEFT — mobile menu + breadcrumb */}
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={() => setIsMobileOpen(true)}
                        className="p-1.5 lg:hidden rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
                        aria-label={translate("topbar.openSidebar", "Open sidebar")}
                    >
                        <Menu size={18} />
                    </button>
                    {/* Mobile: show current page name */}
                    <span className="sm:hidden text-sm font-semibold text-[var(--text-primary)] truncate max-w-[160px]">
                        {crumbs[crumbs.length - 1]}
                    </span>
                    <nav className="hidden sm:flex items-center gap-1" aria-label={translate("topbar.breadcrumb", "Breadcrumb")}>
                        {crumbs.map((c, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <span className={i === crumbs.length - 1
                                    ? "text-sm font-semibold text-[var(--text-primary)]"
                                    : "text-xs text-[var(--text-muted)]"
                                }>{c}</span>
                                {i < crumbs.length - 1 && <ChevronRight size={11} className="text-[var(--text-muted)]" />}
                            </div>
                        ))}
                    </nav>
                </div>

                {/* RIGHT — search · workspace · messages · avatar */}
                <div className="flex items-center gap-1.5">

                    {/* Search */}
                    <form onSubmit={onSearchSubmit} className="relative hidden md:block">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
                        <input
                            id="quick-navigation"
                            name="quick-navigation"
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={translate("topbar.searchPlaceholder", "Aller à…")}
                            className="w-44 rounded-lg py-1.5 pl-7 pr-3 text-xs bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
                            aria-label={translate("topbar.quickNavigation", "Quick navigation")}
                        />
                        {query.trim().length > 0 && (
                            <div className="absolute right-0 top-full mt-1.5 w-52 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg z-50">
                                {filteredQuickRoutes.length > 0 ? filteredQuickRoutes.slice(0, 4).map((route) => (
                                    <button key={route.href} type="button"
                                        onClick={() => { router.push(route.href); setQuery(""); }}
                                        className="block w-full px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)] transition-colors">
                                        {route.label}
                                    </button>
                                )) : (
                                    <p className="px-3 py-2 text-xs text-[var(--text-muted)]">{translate("topbar.noMatchingPage", "No matching page.")}</p>
                                )}
                            </div>
                        )}
                    </form>

                    {/* Notification bell (all users) */}
                    <NotificationBell />

                    {/* Messages bell (candidate only) */}
                    {active.kind === "personal" && (
                        <button type="button"
                            onClick={() => router.push(ROUTES.candidate.messages)}
                            className="relative p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
                            title={translate("topbar.messages", "Messages")}>
                            <MessageSquare className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-white text-[8px] font-bold flex items-center justify-center">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Locale switcher */}
                    <div className="hidden sm:flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] overflow-hidden">
                        {LOCALE_OPTIONS.map((loc) => (
                            <button
                                key={loc}
                                type="button"
                                onClick={() => switchLocale(loc)}
                                className={`px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                                    currentLocale === loc
                                        ? "bg-[var(--bg-surface)] text-[var(--accent)]"
                                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                }`}
                                aria-label={`${translate("locale.switchTo", "Switch to")} ${loc.toUpperCase()}`}
                            >
                                {loc}
                            </button>
                        ))}
                    </div>

                    {/* Avatar — compact pill: initiale + rôle badge au hover */}
                    <button
                        type="button"
                        onClick={() => {
                            const target = active.kind === "personal"
                                ? ROUTES.candidate.profile
                                : ROUTES.company.settings.settings;
                            router.push(localizePath(target, currentLocale));
                        }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--bg-raised)] transition-colors group"
                        aria-label={translate("topbar.accountSettings", "Open account settings")}
                        title={`${user?.email || ""}${membershipLabel ? ` · ${membershipLabel}` : ""}`}
                    >
                        {membershipBadge && (
                            <span aria-hidden="true" className={`hidden sm:inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                                membershipBadge === "OWNER"
                                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400"
                                    : membershipBadge === "ADMIN"
                                        ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                                        : "border-sky-400/40 bg-sky-400/10 text-sky-400"
                            }`}>
                                {membershipLabel}
                            </span>
                        )}
                        <div aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden bg-[var(--accent)] text-xs font-bold uppercase text-white">
                            {institutionLogoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={institutionLogoUrl} alt="" className="h-full w-full object-cover" />
                            ) : user?.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : initial}
                        </div>
                    </button>
                </div>
            </div>
        </header>
    );
}
