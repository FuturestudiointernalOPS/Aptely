"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { ROLE_PERSONAS_V1 } from "@/lib/featureFlags";
import { useWorkspace } from "@/lib/workspace";
import { getClientLocale, t } from "@/lib/i18n";

/**
 * B3 — conditional workspace switcher. Uses the existing WorkspaceProvider.switchTo()
 * (server-side active workspace + permission/module refresh). Only shown when the user
 * belongs to more than one institution; the personal workspace is deliberately not
 * included until that product decision is made.
 */
export default function WorkspaceSwitcher() {
    const { active, memberships, switchTo, loading } = useWorkspace();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const locale = getClientLocale();

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    if (!ROLE_PERSONAS_V1 || loading || memberships.length <= 1) return null;

    const currentId = active.kind === "institution" ? active.institutionId : null;
    const current = memberships.find((m) => m.institution_id === currentId) ?? memberships[0];

    const handleSwitch = async (institutionId: string) => {
        if (institutionId === currentId) {
            setOpen(false);
            return;
        }
        setSwitching(institutionId);
        try {
            await switchTo(institutionId);
            router.refresh();
            setOpen(false);
        } finally {
            setSwitching(null);
        }
    };

    return (
        <div ref={containerRef} className="relative hidden sm:block">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex max-w-[190px] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-raised)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors"
                aria-expanded={open}
                aria-label={t(locale, "workspace.switcher.label", "Changer d'espace de travail")}
                title={current?.institution_name ?? ""}
            >
                <Building2 size={14} className="flex-shrink-0 text-[var(--accent)]" />
                <span className="truncate">{current?.institution_name || t(locale, "workspace.switcher.short", "Espaces")}</span>
                <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl">
                    <p className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {t(locale, "workspace.switcher.title", "Mes espaces de travail")}
                    </p>
                    <ul className="max-h-72 overflow-y-auto py-1">
                        {memberships.map((membership) => {
                            const isActive = membership.institution_id === currentId;
                            return (
                                <li key={membership.institution_id}>
                                    <button
                                        type="button"
                                        onClick={() => void handleSwitch(membership.institution_id)}
                                        disabled={switching !== null}
                                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--bg-raised)] disabled:opacity-60 ${
                                            isActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
                                        }`}
                                    >
                                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--accent-dim)] text-[var(--accent)]">
                                            {membership.institution_logo_url ? (
                                                <img src={membership.institution_logo_url} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <Building2 size={14} />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-semibold">{membership.institution_name}</span>
                                            <span className="block truncate text-[10px] text-[var(--text-muted)]">
                                                {membership.institution_sector ?? t(locale, "workspace.switcher.institution", "Entreprise")}
                                            </span>
                                        </span>
                                        {isActive && <Check size={14} className="flex-shrink-0" />}
                                        {switching === membership.institution_id && (
                                            <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
