"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useWorkspace, type ModuleKey } from "@/lib/workspace";
import { useTheme } from "@/lib/theme";
import {
    getClientLocale,
    localizePath,
    removeLocalePrefix,
    setLocaleCookie,
    t,
} from "@/lib/i18n";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
    LayoutDashboard,
    Users,
    User,
    Link as LinkIcon,
    FileText,
    Settings,
    Shield,
    LogOut,
    ChevronLeft,
    ChevronRight,
    X,
    Sun,
    Moon,
    Monitor,
    ClipboardList,
    CalendarRange,
    UserCircle2,
    Sparkles,
    Share2,
    Gift,
    CalendarDays,
    BarChart2,
    Target,
    TrendingDown,
    BookOpen,
    Briefcase,
    FileSearch,
    Calendar,
    ShieldAlert,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (v: boolean) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (v: boolean) => void;
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 220;

export default function Sidebar({ isCollapsed: isCollapsedProp, setIsCollapsed, isMobileOpen, setIsMobileOpen }: SidebarProps) {
    const pathname = usePathname();
    const { logout, user } = useAuth();
    const { active, isPersonal, hasModule, hasPermission } = useWorkspace();
    const { theme, setTheme } = useTheme();
    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
    const [isMobile, setIsMobile] = useState(false);
    // On mobile the drawer is full-width with labels — never the 64px collapsed rail.
    const isCollapsed = isMobile ? false : isCollapsedProp;
    const membershipStatus = useMemo<"OWNER" | "ADMIN" | "ACTIVE" | "PENDING" | "SUSPENDED" | null>(() => {
        if (active.kind !== "institution") return null;
        return active.membership.status;
    }, [active]);
    const isResizing = useRef(false);
    const currentLocale = useMemo(() => getClientLocale(pathname), [pathname]);
    const pathnameWithoutLocale = useMemo(() => removeLocalePrefix(pathname), [pathname]);
    const translate = useMemo(() => {
        return (key: string, fallback: string) => t(currentLocale, key, fallback);
    }, [currentLocale]);

    // Human-readable role label for the badge (custom roles show their own name).
    const roleBadge = useMemo<string | null>(() => {
        if (active.kind !== "institution") return null;
        const rs = active.membership.role_specialization;
        const label = active.membership.role_custom_label;
        if (label) return label;  // custom label set for ANY role (incl. OWNER)
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
        if (active.membership.status === "OWNER") return map.OWNER;
        if (active.membership.status === "ADMIN") return map.ADMIN;
        return map.MEMBER;
    }, [active, translate]);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const check = () => setIsMobile(window.innerWidth < 1024);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // Only allow resizing on desktop
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isCollapsed || isMobile) return;
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current || isCollapsed) return;
        requestAnimationFrame(() => {
            const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
            setSidebarWidth(newWidth);
        });
    }, [isCollapsed]);

    const handleMouseUp = useCallback(() => {
        isResizing.current = false;
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";
    }, []);

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    type NavItem = { name: string; href: string; baseHref: string; icon: React.ElementType; requiredRoles?: string[] };
    type NavSection = { sectionKey?: ModuleKey; label?: string | null; items: NavItem[]; alwaysShow?: boolean; requiredRoles?: string[] };

    const getCompanySections = (): NavSection[] => {
        const wsRole = active.kind === "institution" ? active.membership.role_specialization : null;
        const wsStatus = active.kind === "institution" ? active.membership.status : null;

        // Effective role: prefer role_specialization, fallback to status-based
        const effectiveRole: string =
            wsRole ??
            (wsStatus === "OWNER" ? "OWNER" :
             wsStatus === "ADMIN" ? "ADMIN" :
             "MEMBER");

        // Role groups
        const FULL_HR    = ["OWNER", "ADMIN", "HR_LEAD", "STANDARD_HR"];
        const HR_FAMILY  = [...FULL_HR, "RECRUITER", "HIRING_MANAGER"];
        const ADMIN_ONLY = ["OWNER", "ADMIN", "HR_LEAD"];

        // CUSTOM roles aren't in any group → gate their nav by permission instead.
        const isCustom = effectiveRole === "CUSTOM";
        const can = (roles: string[]) => roles.includes(effectiveRole);
        // Built-in roles use group membership; CUSTOM roles use their permission set.
        const canItem = (roles: string[], perm: Parameters<typeof hasPermission>[0]) =>
            isCustom ? hasPermission(perm) : roles.includes(effectiveRole);
        const canRoles = isCustom
            ? (hasPermission("roles.create") || hasPermission("roles.update"))
            : can(FULL_HR);

        // Recruitment items, each gated (group for built-in, permission for CUSTOM).
        const rhItems: NavItem[] = [
            ...(canRoles ? [{ name: translate("nav.roles", "Fiches de poste"), href: localizePath(ROUTES.company.recruitment.roles, currentLocale), baseHref: ROUTES.company.recruitment.roles, icon: FileText }] : []),
            // "Candidatures" removed from sidebar — access via role pipeline (?app=) or direct link
            ...(canItem(HR_FAMILY, "interviews.manage") ? [{ name: translate("nav.interviews", "Entretiens"), href: localizePath(ROUTES.company.recruitment.interviews, currentLocale), baseHref: ROUTES.company.recruitment.interviews, icon: CalendarRange }] : []),
            // "Interviewer" removed from sidebar — merged into Entretiens page (tabs: Mes entretiens / Tous)
            // "Décisions" kanban removed — redondant avec le pipeline rôle (recommend/decide/ratify déjà accessible via ?app=)
            // Offres temporarily disabled — re-enable: ...(canItem(FULL_HR, "offers.manage") ?[{ name: translate("nav.offers", "Offres"), href: localizePath(ROUTES.company.recruitment.offers, currentLocale), baseHref: ROUTES.company.recruitment.offers, icon: Gift }] : []),
        ];

        // ─── Module visibility gates (Phase 4) ───────────────────────────────────
        // Phase 4 modules temporarily disabled — re-enable by restoring the conditions below:
        // showEmployees: isCustom ? hasPermission("employees.view") : can(FULL_HR)
        // showPayroll:   isCustom ? hasPermission("payroll.view") : can(FULL_HR)
        // showGoals:     isCustom ? hasPermission("goals.view") : can(HR_FAMILY)
        // showRetention: isCustom ? hasPermission("retention.view") : can(FULL_HR)
        const showEmployees = false;
        const showPayroll   = false;
        const showGoals     = false;
        const showRetention = false;

        const adminItems: NavItem[] = [
            ...((isCustom ? hasPermission("members.view") : can(ADMIN_ONLY))
                ? [{ name: translate("nav.team", "Équipe"), href: localizePath(ROUTES.company.settings.hr, currentLocale), baseHref: ROUTES.company.settings.hr, icon: Users }]
                : []),
            ...((isCustom ? hasPermission("members.roles") : can(ADMIN_ONLY))
                ? [{ name: translate("nav.permissions", "Permissions"), href: localizePath(ROUTES.company.settings.permissions, currentLocale), baseHref: ROUTES.company.settings.permissions, icon: Shield }]
                : []),
            { name: translate("nav.settings", "Paramètres"), href: localizePath(ROUTES.company.settings.settings, currentLocale), baseHref: ROUTES.company.settings.settings, icon: Settings },
        ];

        const sections: NavSection[] = [
            // Dashboard — visible all
            {
                alwaysShow: true,
                items: [
                    { name: translate("nav.dashboard", "Dashboard"), href: localizePath(ROUTES.company.dashboard, currentLocale), baseHref: ROUTES.company.dashboard, icon: LayoutDashboard },
                ],
            },
            // ─── RH & RECRUTEMENT ─────────────────────────────────────────────
            ...(rhItems.length > 0 ? [{
                sectionKey: "recruitment" as ModuleKey,
                label: translate("nav.module.recruitment", "RH & Recrutement"),
                items: rhItems,
            }] : []),
            // ─── ESPACE DE TRAVAIL ────────────────────────────────────────────
            {
                alwaysShow: true,
                label: translate("nav.module.workspace", "Espace de travail"),
                items: [
                    { name: translate("nav.calendar", "Mon agenda"), href: localizePath(ROUTES.company.calendar, currentLocale), baseHref: ROUTES.company.calendar, icon: CalendarDays },
                ],
            },
            // ─── EMPLOYÉS ─── FULL_HR (OWNER/ADMIN/HR_LEAD/STANDARD_HR) ──────────
            // Fiches employés + gestion des congés. Exclut RECRUITER + HIRING_MANAGER
            // car ils n'ont pas accès aux données RH internes (salaires, contrats, etc.).
            ...(showEmployees ? [{
                sectionKey: "hr" as ModuleKey,
                label: translate("nav.module.employees", "Employés"),
                items: [
                    { name: translate("nav.employees", "Équipe"), href: localizePath(ROUTES.company.hr.root, currentLocale), baseHref: ROUTES.company.hr.root, icon: Users },
                    { name: translate("nav.leave", "Congés"), href: localizePath(ROUTES.company.hr.leave, currentLocale), baseHref: ROUTES.company.hr.leave, icon: CalendarRange },
                ],
            }] : []),
            // ─── PERFORMANCE & CROISSANCE ─── HR_FAMILY + goals.view ────────────
            // Goals/OKRs ouverts à HR_FAMILY (inclut HIRING_MANAGER) car les managers
            // co-pilotent les objectifs de leurs équipes directement dans ce module.
            ...(showGoals ? [{
                sectionKey: "goals" as ModuleKey,
                label: translate("nav.module.performance", "Performance & Croissance"),
                items: [
                    { name: translate("nav.goals", "Goals & OKRs"), href: localizePath(ROUTES.company.goals, currentLocale), baseHref: ROUTES.company.goals, icon: Target },
                ],
            }] : []),
            // ─── ANALYSE & RÉTENTION ─── FULL_HR + retention.view ───────────────
            // Données sensibles (risque départ, scores rétention, analytics RH).
            // Restreint à FULL_HR uniquement — même scope que la compensation.
            ...(showRetention ? [{
                alwaysShow: true,
                label: translate("nav.module.analytics", "Analyse & Rétention"),
                items: [
                    { name: translate("nav.departure_risk", "Risque de départ"), href: localizePath(ROUTES.company.analyticsRetention, currentLocale), baseHref: ROUTES.company.analyticsRetention, icon: TrendingDown },
                    { name: translate("nav.analytics", "Analytiques"), href: localizePath(ROUTES.company.analytics, currentLocale), baseHref: ROUTES.company.analytics, icon: BarChart2 },
                ],
            }] : []),
            // ─── PAIE ─── FULL_HR + payroll.view ────────────────────────────────
            // Périodes de paie, entrées, workflow de paiement.
            // RECRUITER et HIRING_MANAGER exclus — données salariales confidentielles.
            ...(showPayroll ? [{
                sectionKey: "payroll" as ModuleKey,
                label: translate("nav.module.payroll", "Paie"),
                items: [
                    { name: translate("nav.payroll.overview", "Vue d'ensemble"), href: localizePath(ROUTES.company.payroll, currentLocale), baseHref: ROUTES.company.payroll, icon: FileText },
                ],
            }] : []),
            // ─── ADMINISTRATION ───────────────────────────────────────────────
            {
                alwaysShow: true,
                label: translate("nav.module.admin", "Administration"),
                items: adminItems,
            },
        ];

        return sections;
    };

    const candidateNavigation: NavItem[] = isPersonal ? [
        { name: translate("nav.dashboard", "Dashboard"), href: ROUTES.candidate.dashboard, baseHref: ROUTES.candidate.dashboard, icon: LayoutDashboard },
        { name: translate("nav.profile", "Mon Profil"), href: ROUTES.candidate.profile, baseHref: ROUTES.candidate.profile, icon: UserCircle2 },
        { name: translate("nav.vault", "Vault"), href: ROUTES.candidate.vault, baseHref: ROUTES.candidate.vault, icon: Shield },
        { name: translate("nav.cvStudio", "CV Studio"), href: ROUTES.candidate.cvStudio, baseHref: ROUTES.candidate.cvStudio, icon: FileSearch },
            { name: translate("nav.candidateCalendar", "Mon Agenda"), href: ROUTES.candidate.calendar, baseHref: ROUTES.candidate.calendar, icon: Calendar },
        { name: translate("nav.opportunities", "Opportunités"), href: ROUTES.candidate.opportunities, baseHref: ROUTES.candidate.opportunities, icon: Briefcase },
        { name: translate("nav.export", "Partager le profil"), href: ROUTES.candidate.export, baseHref: ROUTES.candidate.export, icon: Share2 },
        // Messages hidden — use application detail page to message candidates
        { name: translate("nav.settings", "Paramètres"), href: ROUTES.candidate.settings, baseHref: ROUTES.candidate.settings, icon: Settings },
    ] : [];

    const companySections = !isPersonal && user ? getCompanySections() : [];

    return (
        <aside
            style={{
                width: isMobile ? "min(85vw, 320px)" : (isCollapsed ? 64 : sidebarWidth),
                transform: `translateX(${mounted ? (isMobileOpen ? 0 : (isMobile ? -100 : 0)) : (isMobileOpen ? 0 : -100)}%)`
            }}
            className={`
                fixed top-0 left-0 h-dvh lg:h-screen z-[1000]
                bg-[var(--bg-surface)]
                border-r border-[var(--border)]
                transition-[width,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                flex flex-col
            `}
        >
            {/* ─ Brand Header ─ */}
            <div className="h-[52px] flex items-center justify-between px-4 border-b border-[var(--border)] flex-shrink-0">
                {!isCollapsed && (
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Aptely brand mark */}
                        <div className="w-7 h-7 flex-shrink-0">
                            <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
                                <circle cx="55" cy="45" r="30" fill="none" stroke="currentColor" strokeWidth="10" className="text-[var(--text-primary)]" />
                                <line x1="15" y1="85" x2="35" y2="65" stroke="currentColor" strokeWidth="12" strokeLinecap="round" className="text-[var(--text-primary)]" />
                                <path d="M55 25 L58 42 L75 45 L58 48 L55 65 L52 48 L35 45 L52 42 Z" fill="var(--accent)" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                            Aptely
                        </span>
                    </div>
                )}

                {/* Collapsed: center brand mark */}
                {isCollapsed && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-7 h-7">
                            <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
                                <circle cx="55" cy="45" r="30" fill="none" stroke="currentColor" strokeWidth="10" className="text-[var(--text-primary)]" />
                                <line x1="15" y1="85" x2="35" y2="65" stroke="currentColor" strokeWidth="12" strokeLinecap="round" className="text-[var(--text-primary)]" />
                                <path d="M55 25 L58 42 L75 45 L58 48 L55 65 L52 48 L35 45 L52 42 Z" fill="var(--accent)" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Desktop toggle */}
                {!isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors duration-150 flex-shrink-0"
                        aria-label={translate("sidebar.collapse", "Collapse sidebar")}
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}

                {isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex absolute bottom-[72px] left-1/2 -translate-x-1/2 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors duration-150"
                        aria-label={translate("sidebar.expand", "Expand sidebar")}
                    >
                        <ChevronRight size={16} />
                    </button>
                )}

                {/* Mobile: close drawer */}
                <button
                    onClick={() => setIsMobileOpen(false)}
                    className="lg:hidden p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors flex-shrink-0"
                    aria-label={translate("topbar.closeSidebar", "Close")}
                >
                    <X size={18} />
                </button>
            </div>

            {/* ─ Navigation ─ */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 overscroll-contain">

                {/* CANDIDATE sidebar — flat list */}
                {isPersonal && candidateNavigation.map((item) => {
                    const isActive = pathnameWithoutLocale.startsWith(item.baseHref);
                    const Icon = item.icon;
                    return (
                        <Link key={item.name} href={item.href}
                            className={`flex items-center gap-2.5 rounded-lg transition-colors duration-150 group relative mb-0.5
                                ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 min-h-[44px] lg:min-h-0'}
                                ${isActive ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)]"}`}
                        >
                            <Icon size={17} className={`flex-shrink-0 ${isActive ? 'text-[var(--accent)]' : ''}`} />
                            {!isCollapsed && <span className={`text-sm whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>}
                            {isCollapsed && (
                                <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-[var(--bg-raised)] text-[var(--text-primary)] text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-[var(--border)] shadow-lg">
                                    {item.name}
                                </div>
                            )}
                        </Link>
                    );
                })}

                {/* COMPANY sidebar — modular sections */}
                {!isPersonal && companySections.map((section, sIdx) => {
                    const wsRole2 = active.kind === "institution" ? active.membership.role_specialization : null;
                    const wsStatus2 = active.kind === "institution" ? active.membership.status : null;
                    const effRole2 = wsRole2 ?? (wsStatus2 === "OWNER" ? "OWNER" : wsStatus2 === "ADMIN" ? "ADMIN" : "MEMBER");
                    if (section.requiredRoles && !section.requiredRoles.includes(effRole2)) return null;
                    const moduleActive = section.alwaysShow || !section.sectionKey || hasModule(section.sectionKey);
                    return (
                        <div key={sIdx} className="mb-1">
                            {/* Section header — skip entirely when label is null */}
                            {section.label !== null && section.label && !isCollapsed && (
                                <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                        {section.label}
                                    </span>
                                    {!moduleActive && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-muted)]">
                                            {translate("nav.comingSoon", "Bientôt")}
                                        </span>
                                    )}
                                </div>
                            )}
                            {section.label !== null && section.label && isCollapsed && <div className="my-1 mx-2 h-px bg-[var(--border)]" />}

                            {/* Section items */}
                            {section.items.map((item) => {
                                const isActive = pathnameWithoutLocale.startsWith(item.baseHref);
                                const Icon = item.icon;
                                if (!moduleActive) {
                                    return (
                                        <div key={item.name}
                                            className={`flex items-center gap-2.5 rounded-lg mb-0.5 opacity-40 cursor-not-allowed
                                                ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 min-h-[44px] lg:min-h-0'}`}
                                            title={!isCollapsed ? undefined : `${item.name} — ${translate("nav.comingSoon", "Bientôt")}`}
                                        >
                                            <Icon size={17} className="flex-shrink-0 text-[var(--text-muted)]" />
                                            {!isCollapsed && <span className="text-sm font-medium text-[var(--text-muted)] whitespace-nowrap">{item.name}</span>}
                                        </div>
                                    );
                                }
                                return (
                                    <Link key={item.name} href={item.href}
                                        className={`flex items-center gap-2.5 rounded-lg transition-colors duration-150 group relative mb-0.5
                                            ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 min-h-[44px] lg:min-h-0'}
                                            ${isActive ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)]"}`}
                                    >
                                        <Icon size={17} className={`flex-shrink-0 ${isActive ? 'text-[var(--accent)]' : ''}`} />
                                        {!isCollapsed && <span className={`text-sm whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>}
                                        {isCollapsed && (
                                            <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-[var(--bg-raised)] text-[var(--text-primary)] text-xs font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-[var(--border)] shadow-lg">
                                                {item.name}
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* ─ User, Theme & Logout ─ */}
            <div className="flex-shrink-0 border-t border-[var(--border)] p-2">
                {/* User info */}
                {!isCollapsed && user && (
                    <div className="px-3 py-2 mb-1">
                        <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                        {isPersonal ? (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-blue-400/15 text-blue-400">
                                Candidat
                            </span>
                        ) : membershipStatus ? (
                            <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                                membershipStatus === "OWNER" ? "bg-[var(--accent-dim)] text-[var(--accent)]" :
                                membershipStatus === "ADMIN" ? "bg-amber-400/15 text-amber-400" :
                                "bg-emerald-400/15 text-emerald-400"
                            }`}>
                                {roleBadge ?? (membershipStatus === "ACTIVE" ? "MEMBER" : membershipStatus)}
                            </span>
                        ) : null}
                    </div>
                )}

                {/* Theme Toggle */}
                {!isCollapsed && (
                    <div className="flex items-center mb-1 bg-[var(--bg-raised)] rounded-lg p-0.5 border border-[var(--border)]">
                        <button
                            onClick={() => setTheme("dark")}
                            className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors duration-150 ${theme === "dark" ? "bg-[var(--bg-surface)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                            title={translate("theme.dark", "Dark mode")}
                        >
                            <Moon size={14} />
                        </button>
                        <button
                            onClick={() => setTheme("system")}
                            className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors duration-150 ${theme === "system" ? "bg-[var(--bg-surface)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                            title={translate("theme.system", "System mode")}
                        >
                            <Monitor size={14} />
                        </button>
                        <button
                            onClick={() => setTheme("light")}
                            className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors duration-150 ${theme === "light" ? "bg-[var(--bg-surface)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                            title={translate("theme.light", "Light mode")}
                        >
                            <Sun size={14} />
                        </button>
                    </div>
                )}

                {/* Language Toggle (visible on mobile drawer + desktop) */}
                {!isCollapsed && (
                    <div className="flex items-center mb-1 bg-[var(--bg-raised)] rounded-lg p-0.5 border border-[var(--border)]">
                        {(["fr", "en"] as const).map((loc) => (
                            <button
                                key={loc}
                                onClick={() => {
                                    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                                    setLocaleCookie(loc);
                                    window.location.assign(localizePath(path, loc));
                                }}
                                className={`flex-1 flex justify-center py-1.5 rounded-md text-[11px] font-bold uppercase transition-colors duration-150 ${currentLocale === loc ? "bg-[var(--bg-surface)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                                aria-label={`${translate("locale.switchTo", "Switch to")} ${loc.toUpperCase()}`}
                            >
                                {loc}
                            </button>
                        ))}
                    </div>
                )}

                {/* Platform administration — only for platform owners */}
                {user?.isSuperAdmin && (
                    <Link
                        href={localizePath(ROUTES.admin.root, currentLocale)}
                        className={`
                            w-full flex items-center gap-2.5 rounded-lg transition-colors duration-150
                            text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)]
                            ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 min-h-[44px] lg:min-h-0'}
                        `}
                    >
                        <ShieldAlert size={17} className="flex-shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{translate("admin.nav.entry", "Administration")}</span>}
                    </Link>
                )}

                <button
                    onClick={() => { logout(); window.location.replace(ROUTES.login); }}
                    className={`
                        w-full flex items-center gap-2.5 rounded-lg transition-colors duration-150 group
                        text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/[0.06]
                        ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 min-h-[44px] lg:min-h-0'}
                    `}
                >
                    <LogOut size={17} className="flex-shrink-0" />
                    {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{translate("auth.logout", "Logout")}</span>}
                </button>
            </div>

            {/* Drag Handle (Desktop only) */}
            {!isCollapsed && (
                <div
                    onMouseDown={handleMouseDown}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize opacity-0 hover:opacity-100 hover:bg-[var(--accent)] transition-opacity z-50"
                />
            )}
        </aside>
    );
}
