"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  createCustomRole,
  deleteCustomRole,
  getCustomRoles,
  getHRMembers,
  getInstitutionSettings,
  getRolePermissions,
  updateCustomRole,
  updateRolePermissions,
  type CustomRole,
  type HRMember,
  type InstitutionSettings,
  type RolePermissionsMap,
} from "@/lib/api";
import { useAuth, useRequireInstitution } from "@/lib/auth";
import { roleRank, useWorkspace } from "@/lib/workspace";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";


type MatrixRole = "OWNER" | "ADMIN" | "MEMBER";

// ─── Permission editor metadata ───────────────────────────────────────────────
// Built-in roles that can be configured (OWNER is always-full, never editable).
const EDITABLE_ROLES = ["ADMIN", "HR_LEAD", "STANDARD_HR", "HIRING_MANAGER", "RECRUITER", "MEMBER"] as const;
// All roles shown as tabs (OWNER first, read-only).
const ALL_ROLE_TABS = ["OWNER", ...EDITABLE_ROLES] as const;

const ROLE_LABELS: Record<string, { key: string; fallback: string }> = {
  OWNER: { key: "perm.role.owner", fallback: "Propriétaire" },
  ADMIN: { key: "perm.role.admin", fallback: "Administrateur" },
  HR_LEAD: { key: "perm.role.hrLead", fallback: "Responsable RH" },
  STANDARD_HR: { key: "perm.role.standardHr", fallback: "RH" },
  HIRING_MANAGER: { key: "perm.role.hiringManager", fallback: "Manager recruteur" },
  RECRUITER: { key: "perm.role.recruiter", fallback: "Recruteur" },
  MEMBER: { key: "perm.role.member", fallback: "Membre" },
};

const PERMISSION_GROUPS: Array<{
  groupKey: string;
  groupFallback: string;
  perms: Array<{ key: string; fallback: string }>;
}> = [
  {
    groupKey: "perm.group.recruitment",
    groupFallback: "Recrutement",
    perms: [
      { key: "applications.view", fallback: "Voir les candidatures" },
      { key: "applications.decide", fallback: "Décider (accepter / refuser)" },
      { key: "interviews.manage", fallback: "Gérer les entretiens" },
      { key: "offers.manage", fallback: "Gérer les offres" },
      { key: "onboarding.manage", fallback: "Gérer l'onboarding" },
      { key: "communications.send", fallback: "Envoyer des communications" },
      { key: "analytics.view", fallback: "Voir les analyses" },
      { key: "roles.create", fallback: "Créer des fiches de poste" },
      { key: "roles.update", fallback: "Modifier des fiches de poste" },
      { key: "roles.delete", fallback: "Supprimer des fiches de poste" },
    ],
  },
  {
    groupKey: "perm.group.team",
    groupFallback: "Équipe & membres",
    perms: [
      { key: "members.view", fallback: "Voir les membres" },
      { key: "members.invite", fallback: "Inviter des membres" },
      { key: "members.remove", fallback: "Retirer / suspendre des membres" },
      { key: "members.roles", fallback: "Gérer les rôles & permissions" },
    ],
  },
  {
    groupKey: "perm.group.settings",
    groupFallback: "Paramètres",
    perms: [
      { key: "settings.edit", fallback: "Modifier les paramètres de l'institution" },
    ],
  },
  {
    groupKey: "perm.group.employees",
    groupFallback: "Employés",
    perms: [
      { key: "employees.view", fallback: "Voir les employés" },
      { key: "employees.manage", fallback: "Gérer les employés" },
    ],
  },
  {
    groupKey: "perm.group.payroll",
    groupFallback: "Paie",
    perms: [
      { key: "payroll.view", fallback: "Voir la paie" },
      { key: "payroll.manage", fallback: "Gérer la paie" },
    ],
  },
];

function roleFromStatus(status: string | null): MatrixRole {
  if (status === "OWNER") return "OWNER";
  if (status === "ADMIN") return "ADMIN";
  return "MEMBER";
}

function getStatusLabel(status: string, translate: (k: string, f: string) => string) {
  switch (status) {
    case "OWNER": return translate("institution.permissions.status.owner", "Owner");
    case "ADMIN": return translate("institution.permissions.status.admin", "Admin");
    case "ACTIVE":
    case "MEMBER": return translate("institution.permissions.status.member", "Member");
    case "PENDING": return translate("institution.permissions.status.pending", "Pending");
    case "SUSPENDED": return translate("institution.permissions.status.suspended", "Suspended");
    default: return status;
  }
}

export default function PermissionsMatrixPage() {
  useRequireInstitution();
  const { user } = useAuth();
  const { hasPermission } = useWorkspace();
  const router = useRouter();
  const locale = getClientLocale();
  const translate = (key: string, fallback: string) => t(locale, key, fallback);

  const [institution, setInstitution] = useState<InstitutionSettings | null>(null);
  const [members, setMembers] = useState<HRMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Permission editor state.
  const [matrix, setMatrix] = useState<RolePermissionsMap>({});
  const [selectedRole, setSelectedRole] = useState<string>("ADMIN");
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());
  const [savingRole, setSavingRole] = useState<string | null>(null);

  // Custom roles state.
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [editingRole, setEditingRole] = useState<{ id?: string; name: string; rank: number; perms: Set<string> } | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<CustomRole | null>(null);

  const currentMember = useMemo(
    () => members.find((member) => member.email.toLowerCase() === (user?.email || "").toLowerCase()),
    [members, user?.email]
  );
  const currentRole = roleFromStatus(currentMember?.membershipStatus ?? null);
  // Prefer the actual role (custom label > role_specialization) over the legacy status,
  // which reads "Member" for every non-admin role (HR_LEAD, RECRUITER…).
  const currentRoleLabel =
    currentMember?.roleCustomLabel ||
    (currentMember?.roleSpecialization && ROLE_LABELS[currentMember.roleSpecialization]
      ? translate(ROLE_LABELS[currentMember.roleSpecialization].key, ROLE_LABELS[currentMember.roleSpecialization].fallback)
      : getStatusLabel(currentRole, translate));

  // Editing the permission matrix requires members.roles (OWNER/ADMIN by default).
  const canEditPermissions = hasPermission("members.roles");

  // Rank rule (mirrors the backend): only roles strictly below the actor's rank can be
  // configured — an ADMIN cannot rewrite the ADMIN role, i.e. its own permissions.
  const actorRank = useMemo(() => {
    const spec = currentMember?.roleSpecialization ?? currentMember?.membershipStatus ?? null;
    if (spec === "CUSTOM") {
      return customRoles.find((r) => r.id === currentMember?.customRoleId)?.rank ?? roleRank("CUSTOM");
    }
    return roleRank(spec);
  }, [currentMember, customRoles]);
  const canEditRole = (role: string) =>
    canEditPermissions && role !== "OWNER" && roleRank(role) < actorRank;
  const canEditCustomRole = (rank: number) => canEditPermissions && rank < actorRank;

  useEffect(() => {
    const load = async () => {
      try {
        const [memberList, inst, perms, custom] = await Promise.all([
          getHRMembers(),
          getInstitutionSettings(),
          getRolePermissions(),
          getCustomRoles().catch(() => [] as CustomRole[]),
        ]);
        if (inst.name === "Unknown") {
          router.push(ROUTES.company.settings.onboarding);
          return;
        }
        setMembers(memberList);
        setInstitution(inst);
        setMatrix(perms);
        setCustomRoles(custom);
      } catch {
        setFeedback({
          type: "error",
          text: translate("institution.permissions.loadFailed", "Unable to load permissions data."),
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const isPermChecked = (role: string, perm: string): boolean =>
    role === "OWNER" ? true : Boolean(matrix[role]?.[perm]);

  const togglePerm = (role: string, perm: string) => {
    if (!canEditRole(role)) return;
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? {}), [perm]: !prev[role]?.[perm] },
    }));
    setDirtyRoles((prev) => new Set(prev).add(role));
  };

  const handleSavePerms = async (role: string) => {
    if (!canEditRole(role)) return;
    setSavingRole(role);
    const ok = await updateRolePermissions(role, matrix[role] ?? {});
    if (!ok) {
      setFeedback({
        type: "error",
        text: translate("perm.saveFailed", "Échec de l'enregistrement des permissions."),
      });
      setSavingRole(null);
      return;
    }
    setDirtyRoles((prev) => {
      const next = new Set(prev);
      next.delete(role);
      return next;
    });
    setFeedback({ type: "success", text: translate("perm.saved", "Permissions enregistrées.") });
    setSavingRole(null);
  };

  const toggleEditPerm = (key: string) => {
    setEditingRole((prev) => {
      if (!prev) return prev;
      const perms = new Set(prev.perms);
      if (perms.has(key)) perms.delete(key);
      else perms.add(key);
      return { ...prev, perms };
    });
  };

  const handleSaveCustomRole = async () => {
    if (!editingRole || !editingRole.name.trim()) return;
    setSavingCustom(true);
    const perms = Array.from(editingRole.perms);
    const rank = Number.isFinite(editingRole.rank) ? editingRole.rank : 15;
    const ok = editingRole.id
      ? await updateCustomRole(editingRole.id, { name: editingRole.name.trim(), rank, permissions: perms })
      : !!(await createCustomRole(editingRole.name.trim(), perms, rank));
    if (!ok) {
      setFeedback({ type: "error", text: translate("perm.custom.saveFailed", "Échec de l'enregistrement du rôle.") });
      setSavingCustom(false);
      return;
    }
    const refreshed = await getCustomRoles().catch(() => customRoles);
    setCustomRoles(refreshed);
    setEditingRole(null);
    setSavingCustom(false);
    setFeedback({ type: "success", text: translate("perm.custom.saved", "Rôle enregistré.") });
  };

  const handleDeleteCustomRole = async (role: CustomRole) => {
    setDeletingRoleId(role.id);
    const ok = await deleteCustomRole(role.id);
    if (!ok) {
      setFeedback({ type: "error", text: translate("perm.custom.deleteFailed", "Échec de la suppression du rôle.") });
      setDeletingRoleId(null);
      return;
    }
    setCustomRoles((prev) => prev.filter((r) => r.id !== role.id));
    setDeletingRoleId(null);
    setRoleToDelete(null);
    setFeedback({ type: "success", text: translate("perm.custom.deleted", "Rôle supprimé.") });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Link href={ROUTES.company.settings.hr} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-[var(--text-primary)] font-bold text-xl sm:text-2xl">
              {translate("institution.permissions.title", "Permissions Matrix")}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {translate(
                "institution.permissions.subtitle",
                "Clear role rules with explicit owner/admin/member actions."
              )}
            </p>
          </div>
        </div>
        <Link
          href={ROUTES.company.settings.settings}
          className="w-full sm:w-auto text-center px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
        >
          {translate("institution.permissions.goSettings", "Institution settings")}
        </Link>
      </div>

      {institution && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 animate-fade-in-up delay-100">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
            {translate("institution.permissions.institution", "Institution")}
          </p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{institution.name}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {translate("institution.permissions.currentRole", "Your current role")}: {currentRoleLabel}
          </p>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl p-3 text-sm font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
              : "bg-red-400/10 text-red-400 border border-red-400/20"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 animate-fade-in-up delay-150">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-[var(--text-primary)] font-bold">
              {translate("perm.editor.title", "Permissions par rôle")}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {canEditPermissions
                ? translate("perm.editor.subtitle", "Choisissez un rôle, ajustez ses permissions, puis enregistrez.")
                : translate("perm.editor.readOnly", "Lecture seule — seuls les gestionnaires de rôles peuvent modifier.")}
            </p>
          </div>
        </div>

        {/* Role tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {ALL_ROLE_TABS.map((role) => {
            const isActive = selectedRole === role;
            const isDirty = dirtyRoles.has(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  isActive
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30"
                    : "bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                }`}
              >
                {translate(ROLE_LABELS[role]?.key ?? role, ROLE_LABELS[role]?.fallback ?? role)}
                {isDirty && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] align-middle" />}
              </button>
            );
          })}
        </div>

        {selectedRole === "OWNER" ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 text-sm text-[var(--text-secondary)]">
            {translate("perm.editor.ownerNote", "Le propriétaire dispose toujours de toutes les permissions. Ce rôle ne peut pas être restreint.")}
          </div>
        ) : (
          <div className="space-y-5">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.groupKey}>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                  {translate(group.groupKey, group.groupFallback)}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {group.perms.map((perm) => {
                    const checked = isPermChecked(selectedRole, perm.key);
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        onClick={() => togglePerm(selectedRole, perm.key)}
                        disabled={!canEditRole(selectedRole)}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                          checked
                            ? "border-[var(--accent)]/30 bg-[var(--accent-dim)]"
                            : "border-[var(--border)] bg-[var(--bg-raised)]"
                        } ${canEditRole(selectedRole) ? "hover:border-[var(--accent)]/40" : "opacity-80 cursor-not-allowed"}`}
                      >
                        <span className={checked ? "text-[var(--accent)] font-medium" : "text-[var(--text-secondary)]"}>
                          {translate(`perm.label.${perm.key}`, perm.fallback)}
                        </span>
                        <span
                          className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                            checked ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] text-transparent"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {canEditPermissions && !canEditRole(selectedRole) && (
              <p className="text-xs text-[var(--text-muted)] pt-2">
                {translate("perm.editor.rankReadOnly", "Lecture seule — vous ne pouvez pas modifier un rôle de rang égal ou supérieur au vôtre.")}
              </p>
            )}
            {canEditRole(selectedRole) && (
              <div className="flex items-center justify-end gap-3 pt-2">
                {dirtyRoles.has(selectedRole) && (
                  <span className="text-xs text-[var(--text-muted)]">{translate("perm.editor.unsaved", "Modifications non enregistrées")}</span>
                )}
                <button
                  type="button"
                  onClick={() => void handleSavePerms(selectedRole)}
                  disabled={!dirtyRoles.has(selectedRole) || savingRole === selectedRole}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {savingRole === selectedRole
                    ? translate("perm.editor.saving", "Enregistrement…")
                    : translate("perm.editor.save", "Enregistrer")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom roles */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 animate-fade-in-up delay-200">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-[var(--text-primary)] font-bold">{translate("perm.custom.title", "Rôles personnalisés")}</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {translate("perm.custom.subtitle", "Créez des rôles sur-mesure avec leurs propres permissions.")}
            </p>
          </div>
          {canEditPermissions && !editingRole && (
            <button
              type="button"
              onClick={() => setEditingRole({ name: "", rank: 15, perms: new Set() })}
              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> {translate("perm.custom.create", "Nouveau rôle")}
            </button>
          )}
        </div>

        {editingRole && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-4 mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[var(--text-primary)]">
                {editingRole.id ? translate("perm.custom.edit", "Modifier le rôle") : translate("perm.custom.create", "Nouveau rôle")}
              </p>
              <button type="button" onClick={() => setEditingRole(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                  {translate("perm.custom.name", "Nom du rôle")}
                </label>
                <input
                  value={editingRole.name}
                  onChange={(e) => setEditingRole((p) => (p ? { ...p, name: e.target.value } : p))}
                  placeholder={translate("perm.custom.namePlaceholder", "ex. Sourceur")}
                  maxLength={80}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                  {translate("perm.custom.rank", "Rang")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.min(99, actorRank - 1)}
                  value={editingRole.rank}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    // A custom role must stay strictly below the editor's own rank.
                    const maxRank = Math.max(1, Math.min(99, actorRank - 1));
                    setEditingRole((p) => (p ? { ...p, rank: Number.isFinite(n) ? Math.min(maxRank, Math.max(1, n)) : 1 } : p));
                  }}
                  className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1 max-w-[160px]">
                  {translate("perm.custom.rankHint", "1–99. Plus haut = plus d'autorité. Doit rester sous votre rang.")}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.groupKey}>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                    {translate(group.groupKey, group.groupFallback)}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {group.perms.map((perm) => {
                      const checked = editingRole.perms.has(perm.key);
                      return (
                        <button
                          key={perm.key}
                          type="button"
                          onClick={() => toggleEditPerm(perm.key)}
                          className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition-colors hover:border-[var(--accent)]/40 ${
                            checked ? "border-[var(--accent)]/30 bg-[var(--accent-dim)]" : "border-[var(--border)] bg-[var(--bg-surface)]"
                          }`}
                        >
                          <span className={checked ? "text-[var(--accent)] font-medium" : "text-[var(--text-secondary)]"}>
                            {translate(`perm.label.${perm.key}`, perm.fallback)}
                          </span>
                          <span
                            className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                              checked ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--border)] text-transparent"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="px-4 py-2 rounded-xl text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {translate("common.cancel", "Annuler")}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCustomRole()}
                disabled={!editingRole.name.trim() || savingCustom}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {savingCustom ? translate("perm.editor.saving", "Enregistrement…") : translate("perm.editor.save", "Enregistrer")}
              </button>
            </div>
          </div>
        )}

        {customRoles.length === 0 && !editingRole ? (
          <p className="text-sm text-[var(--text-muted)]">{translate("perm.custom.empty", "Aucun rôle personnalisé pour le moment.")}</p>
        ) : (
          <ul className="space-y-2">
            {customRoles.map((role) => (
              <li
                key={role.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 bg-[var(--bg-raised)]"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] truncate">{role.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {role.permissions.length} {translate("perm.custom.permsCount", "permissions")} · {role.member_count}{" "}
                    {translate("perm.custom.membersCount", "membres")} · {translate("perm.custom.rank", "Rang")} {role.rank}
                  </p>
                </div>
                {canEditCustomRole(role.rank) && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingRole({ id: role.id, name: role.name, rank: role.rank, perms: new Set(role.permissions) })}
                      className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      aria-label={translate("perm.custom.edit", "Modifier le rôle")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleToDelete(role)}
                      disabled={deletingRoleId === role.id}
                      className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      aria-label={translate("perm.custom.delete", "Supprimer le rôle")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-4 sm:p-6 animate-fade-in-up delay-200">
        <h2 className="text-[var(--text-primary)] font-bold mb-1">
          {translate("perm.members.title", "Gestion des membres")}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          {translate("perm.members.desc", "Changer de rôle, suspendre ou retirer un membre se fait depuis l'espace Équipe — les actions y sont adaptées à votre rang.")}
        </p>
        <Link
          href={ROUTES.company.settings.hr}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90"
        >
          {translate("perm.members.cta", "Gérer l'équipe")}
        </Link>
      </div>


      {roleToDelete && (
        <Modal
          open
          onClose={() => { if (deletingRoleId !== roleToDelete.id) setRoleToDelete(null); }}
          title={translate("perm.custom.deleteTitle", "Supprimer le rôle ?")}
          description={t(
            locale,
            "perm.custom.deleteConfirm",
            "Le rôle « {{name}} » sera supprimé. {{count}} membre(s) repasseront au rôle Membre.",
            { name: roleToDelete.name, count: String(roleToDelete.member_count) },
          )}
          footer={
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" onClick={() => setRoleToDelete(null)} disabled={deletingRoleId === roleToDelete.id}>
                {translate("common.cancel", "Annuler")}
              </Button>
              <Button variant="danger" onClick={() => void handleDeleteCustomRole(roleToDelete)} disabled={deletingRoleId === roleToDelete.id}>
                {deletingRoleId === roleToDelete.id
                  ? translate("perm.custom.deleting", "Suppression…")
                  : translate("perm.custom.delete", "Supprimer le rôle")}
              </Button>
            </div>
          }
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {translate("perm.custom.deleteIrreversible", "Cette action est irréversible.")}
          </p>
        </Modal>
      )}
    </div>
  );
}

