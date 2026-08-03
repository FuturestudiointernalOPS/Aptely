"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

export interface InterviewerMember {
  userId: string;
  email: string;
  fullName?: string | null;
  roleSpecialization?: string | null;
  roleCustomLabel?: string | null;
}

interface InterviewerPickerProps {
  members: InterviewerMember[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
}

const ROLE_FILTERS = [
  { key: "ALL", labelKey: "interviewer.picker.filter.all", fallback: "Tous" },
  { key: "HR", labelKey: "interviewer.picker.filter.hr", fallback: "RH/Admin" },
  { key: "RECRUITER", labelKey: "interviewer.picker.filter.recruiter", fallback: "Recruteur" },
  { key: "MANAGER", labelKey: "interviewer.picker.filter.manager", fallback: "Manager" },
];

const HR_ROLES = new Set(["OWNER", "ADMIN", "HR_LEAD", "STANDARD_HR"]);
const RECRUITER_ROLES = new Set(["RECRUITER"]);
const MANAGER_ROLES = new Set(["HIRING_MANAGER"]);

function matchesFilter(member: InterviewerMember, filter: string): boolean {
  if (filter === "ALL") return true;
  const role = member.roleSpecialization ?? "";
  if (filter === "HR") return HR_ROLES.has(role);
  if (filter === "RECRUITER") return RECRUITER_ROLES.has(role);
  if (filter === "MANAGER") return MANAGER_ROLES.has(role);
  return true;
}

function displayName(m: InterviewerMember): string {
  return m.fullName?.trim() || m.email;
}

function initials(m: InterviewerMember): string {
  const name = m.fullName?.trim();
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return m.email.slice(0, 2).toUpperCase();
}

function roleLabel(m: InterviewerMember, tr: (k: string, f: string) => string): string {
  if (m.roleCustomLabel) return m.roleCustomLabel;  // custom label for ANY role
  const MAP: Record<string, [string, string]> = {
    OWNER:          ["perm.role.owner", "Propriétaire"],
    ADMIN:          ["perm.role.admin", "Admin"],
    HR_LEAD:        ["perm.role.hrLead", "Resp. RH"],
    STANDARD_HR:    ["perm.role.standardHr", "RH"],
    HIRING_MANAGER: ["perm.role.hiringManager", "Manager"],
    RECRUITER:      ["perm.role.recruiter", "Recruteur"],
    MEMBER:         ["perm.role.member", "Membre"],
  };
  const entry = m.roleSpecialization ? MAP[m.roleSpecialization] : null;
  return entry ? tr(entry[0], entry[1]) : (m.roleSpecialization || "—");
}

export default function InterviewerPicker({ members, selectedIds, onToggle }: InterviewerPickerProps) {
  const locale = getClientLocale();
  const tr = useCallback((k: string, f: string) => t(locale, k, f), [locale]);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return members.filter((m) => {
      if (!matchesFilter(m, roleFilter)) return false;
      if (!q) return true;
      return (
        (m.fullName?.toLowerCase().includes(q)) ||
        m.email.toLowerCase().includes(q)
      );
    });
  }, [members, query, roleFilter]);

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.includes(m.userId)),
    [members, selectedIds]
  );

  const handleToggle = useCallback(
    (userId: string) => {
      onToggle(userId);
    },
    [onToggle]
  );

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedMembers.map((m) => (
            <div
              key={m.userId}
              className="inline-flex items-center gap-1.5 bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold px-2.5 py-1 rounded-full"
            >
              <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                {initials(m)}
              </span>
              {displayName(m)}
              <button
                type="button"
                onClick={() => handleToggle(m.userId)}
                className="hover:text-[var(--accent)]/60 transition-colors ml-0.5"
                aria-label={`Retirer ${displayName(m)}`}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Picker toggle button */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text-secondary)] transition-all"
      >
        <span>
          {selectedIds.length === 0
            ? tr("interviewer.picker.placeholder", "Ajouter des intervenants...")
            : tr(
                "interviewer.picker.countSelected",
                `${selectedIds.length} intervenant(s) sélectionné(s)`
              ).replace("{{n}}", String(selectedIds.length))}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-lg">
          {/* Search */}
          <div className="p-3 border-b border-[var(--border)]">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("interviewer.picker.search", "Rechercher par nom ou email...")}
                className="w-full pl-8 pr-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Role filter tabs */}
          <div className="flex gap-0 border-b border-[var(--border)]">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setRoleFilter(f.key)}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  roleFilter === f.key
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {tr(f.labelKey, f.fallback)}
              </button>
            ))}
          </div>

          {/* Member list — max height + scroll */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                {tr("interviewer.picker.noResults", "Aucun membre trouvé")}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]/50">
                {filtered.map((m) => {
                  const isSelected = selectedIds.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => handleToggle(m.userId)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-[var(--accent-dim)]"
                          : "hover:bg-[var(--bg-raised)]"
                      }`}
                    >
                      {/* Avatar initial */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          isSelected
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)]"
                        }`}
                      >
                        {initials(m)}
                      </div>

                      {/* Name + email */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSelected ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                          {displayName(m)}
                        </p>
                        {m.fullName && (
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{m.email}</p>
                        )}
                      </div>

                      {/* Role badge */}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)] flex-shrink-0">
                        {roleLabel(m, tr)}
                      </span>

                      {/* Check */}
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">
              {filtered.length} {tr("interviewer.picker.members", "membres")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              {tr("interviewer.picker.done", "Fermer")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
