"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireVirginOrPending } from "@/lib/auth";
import { Building2, UserPlus, ClipboardList } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";


export default function InstitutionOnboardingPage() {
  const router = useRouter();
  const { status, isChecking } = useRequireVirginOrPending();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [selected, setSelected] = useState<"create" | "join" | null>(null);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
  void status;

  // Show loading while checking status
  if (isChecking) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
        <div className="text-[var(--text-muted)] text-center">
          <p>{tr("institution.onboarding.loading", "Loading...")}</p>
        </div>
      </div>
    );
  }

  if (selected === "create") {
    // Redirect to create page
    if (typeof window !== "undefined") {
      window.location.assign(ROUTES.company.settings.create);
    }
    return null;
  }

  if (selected === "join") {
    // Redirect to join page
    if (typeof window !== "undefined") {
      window.location.assign(ROUTES.company.settings.join);
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[var(--accent)]/20 rounded-full flex items-center justify-center">
              <Building2 className="w-10 h-10 text-[var(--accent)]" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-3">{tr("institution.onboarding.title", "Set up your institution")}</h1>
          <p className="text-[var(--text-muted)] text-lg">
            {tr("institution.onboarding.subtitle", "Choose whether to create a new institution or join an existing one")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Institution */}
          <button
            onClick={() => setSelected("create")}
            className="group relative bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 text-left animate-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B00]/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative">
              <div className="w-14 h-14 bg-[var(--accent)]/20 rounded-xl flex items-center justify-center mb-4">
                <ClipboardList className="w-7 h-7 text-[var(--accent)]" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">{tr("institution.onboarding.create.title", "Create an institution")}</h2>
              <p className="text-[var(--text-secondary)] mb-6">
                {tr("institution.onboarding.create.subtitle", "Start from scratch and build your workspace. You become owner and can invite other HR members.")}
              </p>

              <ul className="space-y-2 text-sm text-[var(--text-secondary)] mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full" />
                  {tr("institution.onboarding.create.point1", "You become the institution owner")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full" />
                  {tr("institution.onboarding.create.point2", "Your institution will be discoverable by others")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full" />
                  {tr("institution.onboarding.create.point3", "Manage roles and approve members")}
                </li>
              </ul>

              <span className="inline-block px-4 py-2 bg-[var(--accent)] text-white font-semibold rounded-lg group-hover:bg-[var(--accent)]-soft transition-colors">
                {tr("institution.onboarding.create.cta", "Start")} →
              </span>
            </div>
          </button>

          {/* Join Institution */}
          <button
            onClick={() => setSelected("join")}
            className="group relative bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 text-left animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative">
              <div className="w-14 h-14 bg-blue-400/100/20 rounded-xl flex items-center justify-center mb-4">
                <UserPlus className="w-7 h-7 text-blue-400" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">{tr("institution.onboarding.join.title", "Join an institution")}</h2>
              <p className="text-[var(--text-secondary)] mb-6">
                {tr("institution.onboarding.join.subtitle", "Looking for your team? Search your institution and request access to its workspace.")}
              </p>

              <ul className="space-y-2 text-sm text-[var(--text-secondary)] mb-6">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full" />
                  {tr("institution.onboarding.join.point1", "Request approved by the owner")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full" />
                  {tr("institution.onboarding.join.point2", "Immediate access after approval")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--accent)] rounded-full" />
                  {tr("institution.onboarding.join.point3", "Collaborate with your team")}
                </li>
              </ul>

              <span className="inline-block px-4 py-2 bg-[var(--accent)] text-white font-semibold rounded-lg group-hover:bg-[var(--accent)]-soft transition-colors">
                {tr("institution.onboarding.join.cta", "Join")} →
              </span>
            </div>
          </button>
        </div>

        <p className="text-center text-[var(--text-muted)] text-sm mt-8">
          {tr("institution.onboarding.supportQuestion", "Can't find your institution?")} {" "}
          <a href={`mailto:${supportEmail}`} className="text-[var(--accent)] hover:underline font-semibold">
            {tr("institution.onboarding.contactSupport", "Contact support")}
          </a>
        </p>
      </div>
    </div>
  );
}
