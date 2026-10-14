"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import BottomTabBar from "@/components/BottomTabBar";
import LocaleThemeBar from "@/components/LocaleThemeBar";
import { useState, useEffect } from "react";
import { getClientLocale, removeLocalePrefix, t } from "@/lib/i18n";
import {
  ROUTES,
  offerPublicPrefix,
  offerSignPrefix,
  offerSignHRPrefix,
  interviewBookPrefix,
} from "@/lib/routes";

// Routes that should NOT show the app shell (sidebar/topbar)
const PUBLIC_SHELL_ROUTES = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.forgot,
  ROUTES.reset,
  offerPublicPrefix,
  offerSignPrefix,
  offerSignHRPrefix,
  ROUTES.tarifs,
  ROUTES.demo,
  ROUTES.candidate.endorse,
  ROUTES.public.profile,
  ROUTES.waves.booking,
  interviewBookPrefix,
  // Join/invite pages — no sidebar, user must focus on accepting/rejecting
  ROUTES.join,
  // Institution setup pages — no sidebar, user has no workspace yet
  ROUTES.company.settings.onboarding,
  ROUTES.company.settings.create,
  ROUTES.company.settings.join,
  ROUTES.company.settings.accessStatus,
  ROUTES.company.settings.waitingApproval,
  ROUTES.discover,
  ROUTES.privacy,
  ROUTES.terms,
  ROUTES.workspaces.new,
  ROUTES.admin.root,
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const locale = getClientLocale(pathname ?? "");
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  // Responsive auto-collapse
  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    handleResize(); // Init
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Check if current route is public (or deep public like /apply/[link]).
  // Compare against the locale-stripped path so it works whether or not the
  // current pathname still carries the /fr|/en prefix.
  const pathNoLocale = removeLocalePrefix(pathname);
  const isPublicRoute =
    PUBLIC_SHELL_ROUTES.some((r) => pathNoLocale.startsWith(r)) ||
    pathNoLocale === "/" ||
    pathNoLocale.startsWith("/apply/");

  // Hide floating locale/theme bar on landing page (default hidden until we know pathname)
  const isLanding = !mounted || pathNoLocale === "/";

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center">
        {!isLanding && <LocaleThemeBar />}
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm font-medium font-display">
            {tr("appShell.loading", "Loading Aptely…")}
          </p>
        </div>
      </div>
    );
  }

  if (isPublicRoute || !user) {
    return <>{!isLanding && <LocaleThemeBar />}{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex font-sans overflow-hidden relative">
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <div
        className={`flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-10 ${
          !mounted
            ? "lg:ml-[260px]"
            : isCollapsed
              ? "lg:ml-[80px]"
              : "lg:ml-[260px]"
        }`}
      >
        <TopBar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

        <main className="flex-1 p-4 sm:p-8 pt-6 relative w-full max-w-7xl mx-auto">
          <div className="animate-fade-in-up">{children}</div>
          {/* Spacer so content clears the mobile bottom tab bar */}
          <div aria-hidden className="h-20 lg:hidden" />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar setIsMobileOpen={setIsMobileOpen} />

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </div>
  );
}
