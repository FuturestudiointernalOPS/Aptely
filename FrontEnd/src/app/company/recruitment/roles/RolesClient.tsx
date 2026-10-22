"use client";
import { ROUTES, rolePath } from "@/lib/routes";

import { useState, useTransition } from "react";
import type { Role } from "@/lib/api";
import { useRequireInstitution } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/components/ui/Toast";
import {
  Search,
  Briefcase,
  Plus,
  ChevronRight,
  MapPin,
  Users,
  Calendar,
  XCircle,
  StopCircle,
  Link as LinkIcon,
  Check,
  Rocket,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { cancelRoleAction, publishRoleAction, stopRoleAction, deleteRoleAction } from "./actions";
import { getClientLocale, t, Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";

const STATUS_TABS = [
  { value: "ALL", label: "All Roles" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Drafts" },
  { value: "CLOSED", label: "Closed" },
] as const;

type RoleFilterValue = (typeof STATUS_TABS)[number]["value"];

function formatDateSafe(value: string | undefined, locale: Locale): string {
  if (!value) return t(locale, "roles.management.noDate", "No date");
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return t(locale, "roles.management.noDate", "No date");
  return date.toLocaleDateString(locale);
}

function formatDateRange(createdAt: string | undefined, endDate: string | undefined, locale: Locale): string {
  const created = formatDateSafe(createdAt, locale);
  const end = formatDateSafe(endDate, locale);
  if (end === t(locale, "roles.management.noDate", "No date")) return created;
  return `${created} - ${end}`;
}

export default function RolesClient({ initialRoles }: { initialRoles: Role[] }) {
  useRequireInstitution();

  const locale = getClientLocale();
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [filter, setFilter] = useState<RoleFilterValue>("ALL");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [publishGateRoleId, setPublishGateRoleId] = useState<string | null>(null);

  // Actions follow the backend permissions: e.g. HR_LEAD can create/update job post
  // sheets but not delete them, STANDARD_HR can only view.
  const { hasPermission } = useWorkspace();
  const toast = useToast();
  const canCreate = hasPermission("roles.create");
  const canUpdate = hasPermission("roles.update");
  const canDelete = hasPermission("roles.delete");
  const actionFailed = () =>
    toast.error(t(locale, "roles.management.actionFailed", "Action impossible : vérifiez vos permissions ou réessayez."));

  const LOCALIZED_STATUS_TABS = [
    { value: "ALL", label: t(locale, "roles.management.allRoles", "All Roles") },
    { value: "ACTIVE", label: t(locale, "roles.management.active", "Active") },
    { value: "DRAFT", label: t(locale, "roles.management.drafts", "Drafts") },
    { value: "CLOSED", label: t(locale, "roles.management.closed", "Closed") },
  ] as const;

  const applyLocalStatus = (roleId: string, status: Role["status"]) => {
    setRoles((prev) => prev.map((role) => (role.roleId === roleId ? { ...role, status } : role)));
  };

  const removeLocalRole = (roleId: string) => {
    setRoles((prev) => prev.filter((role) => role.roleId !== roleId));
  };

  const copyLink = (role: Role) => {
    navigator.clipboard.writeText(role.shareLink);
    setCopiedId(role.roleId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = roles.filter((role) => {
    const title = role.metadataMissing ? t(locale, "roles.dashboard.untitled", "Role to complete") : (role.title || t(locale, "roles.dashboard.untitled", "Role to complete"));
    const location = role.metadataMissing ? t(locale, "roles.dashboard.locationPlaceholder", "Complete Job Post Sheet to add location") : (role.location || t(locale, "roles.dashboard.locationPlaceholder", "Location not set"));
    const matchSearch =
      title.toLowerCase().includes(search.toLowerCase()) ||
      location.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "ALL"
        ? true
        : filter === "CLOSED"
          ? role.status === "CLOSED" || role.status === "CANCELLED"
          : role.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <PageHeader
        className="animate-fade-in-up"
        title={t(locale, "roles.management.title", "Job Post Sheets")}
        subtitle={t(locale, "roles.management.totalRoles", "{{count}} job post sheets created", { count: roles.length })}
        actions={
          canCreate && <Link
            href={ROUTES.company.recruitment.rolesCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t(locale, "roles.management.newRole", "New job post sheet")}
          </Link>
        }
      />

      <div className="space-y-4 animate-fade-in-up delay-100">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder={t(locale, "roles.management.searchPlaceholder", "Search job post sheets by title or location…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-11 pr-4 py-3"
          />
        </div>

        {/* Filter tabs — active uses accent-dim, no rounded-full */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {LOCALIZED_STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === tab.value
                  ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]"
                  : "text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border)] hover:text-[var(--text-secondary)] bg-[var(--bg-surface)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl flex flex-col items-center gap-4 py-16 px-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-[var(--text-muted)]" style={{ opacity: 0.4 }} />
          </div>
          <div className="text-center max-w-xs">
            <p className="font-display font-bold text-[var(--text-primary)]">{t(locale, "roles.management.empty", "No job post sheets found")}</p>
            <p className="text-[var(--text-muted)] text-sm mt-1.5">
              {search || filter !== "ALL"
                ? t(locale, "roles.management.emptyHint", "Try adjusting your search or filters")
                : t(locale, "roles.management.emptyCreate", "Create your first job post sheet to start attracting candidates")}
            </p>
          </div>
          {!search && filter === "ALL" && canCreate && (
            <Link
              href={ROUTES.company.recruitment.rolesCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] text-[var(--accent)] text-sm font-semibold hover:bg-[var(--accent)] hover:text-white transition-all mt-2"
            >
              <Plus className="w-4 h-4" />
              {t(locale, "roles.management.newRole", "New job post sheet")}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((role, i) => (
            <div
              key={role.roleId}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 transition-all animate-fade-in-up hover:bg-[var(--bg-raised)] hover:border-[var(--accent)] group flex flex-col sm:flex-row sm:items-center gap-6"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Link href={rolePath(role.roleId)} className="flex-1 flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white group-hover:border-[var(--accent)] transition-all flex-shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-[var(--text-primary)] font-bold text-lg truncate group-hover:text-[var(--accent)] transition-colors">
                      {role.metadataMissing ? t(locale, "roles.dashboard.untitled", "Role to complete") : (role.title || t(locale, "roles.dashboard.untitled", "Role to complete"))}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        role.status === "ACTIVE"
                          ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                          : role.status === "DRAFT"
                            ? "bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border)]"
                            : role.status === "CANCELLED"
                              ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
                              : "bg-rose-400/10 text-rose-400 border-rose-400/20"
                      }`}
                    >
                      {role.status === "ACTIVE" ? t(locale, "roles.status.active", "ACTIF")
                        : role.status === "DRAFT" ? t(locale, "roles.status.draft", "BROUILLON")
                        : role.status === "CANCELLED" ? t(locale, "roles.status.cancelled", "ANNULÉ")
                        : role.status === "CLOSED" ? t(locale, "roles.status.closed", "FERMÉ")
                        : role.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--text-muted)] text-sm">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {role.metadataMissing ? t(locale, "roles.dashboard.locationPlaceholder", "Complete Job Post Sheet to add location") : (role.location || t(locale, "roles.dashboard.locationPlaceholder", "Location not set"))}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {t(locale, "roles.management.candidatesCount", "{{count}} Candidates", { count: role.applicationsCount })}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--text-secondary)] font-medium">
                      <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                      {formatDateRange(role.createdAt, role.endDate, locale)}
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-2 self-end sm:self-center border-t border-[var(--border)] sm:border-t-0 pt-4 sm:pt-0 w-full sm:w-auto justify-end">
                {role.status === "DRAFT" && canUpdate && (
                  <button
                    disabled={isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      if (role.metadataMissing || !role.title || !role.location || !role.description) {
                        setPublishGateRoleId(role.roleId);
                        return;
                      }
                      startTransition(async () => {
                        const ok = await publishRoleAction(role.roleId);
                        if (ok) applyLocalStatus(role.roleId, "ACTIVE");
                        else actionFailed();
                      });
                    }}
                    className="p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold text-white bg-blue-500 hover:bg-blue-400 disabled:opacity-60"
                    title={t(locale, "roles.management.publish", "Publish")}
                  >
                    <Rocket className="w-4 h-4" />
                    <span className="hidden lg:inline">{t(locale, "roles.management.publish", "Publish")}</span>
                  </button>
                )}
                {role.status === "ACTIVE" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        copyLink(role);
                      }}
                      className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${
                        copiedId === role.roleId
                          ? "text-emerald-400 bg-emerald-400/10"
                          : "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)]"
                      }`}
                      title={t(locale, "roles.management.copyLink", "Copy link")}
                    >
                      {copiedId === role.roleId ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                      <span className="hidden lg:inline">{copiedId === role.roleId ? t(locale, "roles.dashboard.copied", "Copied!") : t(locale, "roles.management.copyLink", "Copy Link")}</span>
                    </button>
                    {canUpdate && <button
                      disabled={isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        startTransition(async () => {
                          const ok = await stopRoleAction(role.roleId);
                          if (ok) applyLocalStatus(role.roleId, "CLOSED");
                          else actionFailed();
                        });
                      }}
                      className="p-2 text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all flex items-center gap-2 text-xs font-bold disabled:opacity-60"
                      title={t(locale, "roles.management.stop", "Stop")}
                    >
                      <StopCircle className="w-4 h-4" />
                      <span className="hidden lg:inline">{t(locale, "roles.management.stop", "Stop")}</span>
                    </button>}
                    {canUpdate && <button
                      disabled={isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        startTransition(async () => {
                          const ok = await cancelRoleAction(role.roleId);
                          if (ok) applyLocalStatus(role.roleId, "CANCELLED");
                          else actionFailed();
                        });
                      }}
                      className="p-2 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all flex items-center gap-2 text-xs font-bold disabled:opacity-60"
                      title={t(locale, "roles.management.cancel", "Cancel")}
                    >
                      <XCircle className="w-4 h-4" />
                      <span className="hidden lg:inline">{t(locale, "roles.management.cancel", "Cancel")}</span>
                    </button>}
                  </>
                )}

                {canDelete && <button
                  disabled={isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!window.confirm(t(locale, "roles.management.deleteConfirm", "Are you sure you want to permanently delete this job post sheet? This cannot be undone."))) return;
                    startTransition(async () => {
                      const ok = await deleteRoleAction(role.roleId);
                      if (ok) removeLocalRole(role.roleId);
                      else actionFailed();
                    });
                  }}
                  className="p-2 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all flex items-center gap-2 text-xs font-bold disabled:opacity-60"
                  title={t(locale, "roles.management.delete", "Delete")}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden lg:inline">{t(locale, "roles.management.delete", "Delete")}</span>
                </button>}

                <Link
                  href={rolePath(role.roleId)}
                  className="p-2 bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] rounded-lg transition-all border border-[var(--border)]"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish gate modal — missing details */}
      {publishGateRoleId && (() => {
        const gatedRole = roles.find((r) => r.roleId === publishGateRoleId);
        if (!gatedRole) return null;
        const missing: string[] = [];
        if (gatedRole.metadataMissing || !gatedRole.title) missing.push(t(locale, "roles.gate.title", "Titre du poste"));
        if (!gatedRole.description) missing.push(t(locale, "roles.gate.description", "Description / Mission"));
        if (!gatedRole.location) missing.push(t(locale, "roles.gate.location", "Localisation"));
        if (!gatedRole.type) missing.push(t(locale, "roles.gate.type", "Type de contrat"));
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setPublishGateRoleId(null)}>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-400/10">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {t(locale, "roles.gate.title_modal", "Complétez la fiche avant de publier")}
                </h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {t(locale, "roles.gate.explanation", "Les candidats verront ces informations. Veuillez compléter les champs suivants dans la fiche de poste :")}
              </p>
              <ul className="space-y-1.5">
                {missing.map((field) => (
                  <li key={field} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {field}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPublishGateRoleId(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
                >
                  {t(locale, "common.cancel", "Annuler")}
                </button>
                <Link
                  href={rolePath(gatedRole.roleId)}
                  onClick={() => setPublishGateRoleId(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                >
                  {t(locale, "roles.gate.completeSheet", "Compléter la fiche")}
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
