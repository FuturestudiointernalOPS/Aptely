"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiHelper";
import {
  adminUsersApi, adminSuspendUserApi, adminDeleteUserApi, adminUserByIdApi, withParams
} from "@/lib/routes";
import {
  Search, Ban, Trash2, CheckCircle, ChevronLeft, ChevronRight,
  X, User, Building2, Dna, FileText, Calendar,
} from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserMembership {
  institution_id: string;
  institution_name: string | null;
  role_specialization: string | null;
  role_custom_label?: string | null;
  status: string;
  joined_at?: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  institution_id: string | null;
  created_at: string;
  banned_until?: string | null;
  memberships?: UserMembership[];
}

type UserCategory = "" | "HR" | "CANDIDATE";

interface UsersResponse {
  items: UserRow[];
  total: number;
  page: number;
  limit: number;
}

interface UserDetail {
  profile: UserRow & { bio?: string; location?: string; avatar_url?: string };
  memberships: UserMembership[];
  talentDna: { completion_score: number; created_at: string; updated_at: string } | null;
  recentApplications: {
    id: string;
    role_id: string;
    role_title: string | null;
    institution_name: string | null;
    status: string;
    created_at: string;
  }[];
}

// ─── User Detail Drawer ───────────────────────────────────────────────────────

function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(adminUserByIdApi(userId)).then((d) => {
      const typed = d as UserDetail | null;
      // apiFetch returns an error object (not null) on 401/403.
      setDetail(typed && "profile" in typed ? typed : null);
      setLoading(false);
    });
  }, [userId]);

  const statusColor = (s: string) => {
    if (s === "ACTIVE" || s === "OWNER" || s === "ADMIN") return "text-[var(--success)] bg-[var(--success-bg)]";
    if (s === "SUSPENDED") return "text-[var(--error)] bg-[var(--error-bg)]";
    return "text-[var(--text-muted)] bg-[var(--bg-raised)]";
  };

  const appStatusColor = (s: string) => {
    if (s === "ACCEPTED")  return "text-[var(--success)]";
    if (s === "REJECTED")  return "text-[var(--error)]";
    if (s === "PENDING")   return "text-[var(--warning)]";
    return "text-[var(--text-muted)]";
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border)] z-50 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-surface)]">
          <span className="font-semibold text-sm text-[var(--text-primary)]">{tr("admin.users.drawerTitle", "Détail utilisateur")}</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--bg-raised)] text-[var(--text-muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">{tr("admin.users.drawerLoadError", "Impossible de charger l'utilisateur.")}</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Profile header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center shrink-0">
                {detail.profile.avatar_url ? (
                  <img src={detail.profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <User size={20} className="text-[var(--text-muted)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[var(--text-primary)] truncate">
                  {detail.profile.full_name ?? "—"}
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate">{detail.profile.email}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    detail.profile.role === "HR"
                      ? "bg-[var(--info-bg)] text-[var(--info)]"
                      : "bg-[var(--accent-dim)] text-[var(--accent)]"
                  }`}>{detail.profile.role}</span>
                  {detail.profile.location && (
                    <span className="text-xs text-[var(--text-muted)]">{detail.profile.location}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="bg-[var(--bg-raised)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{tr("admin.users.fieldId", "ID")}</span>
                <span className="font-mono text-[var(--text-secondary)]">{detail.profile.id.slice(0, 16)}…</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{tr("admin.users.fieldCreatedAt", "Inscrit le")}</span>
                <span className="text-[var(--text-secondary)]">
                  {new Date(detail.profile.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>

            {/* Membership */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{tr("admin.users.sectionInstitution", "Institution")}</span>
              </div>
              {detail.memberships.length > 0 ? (
                <div className="space-y-1.5">
                  {detail.memberships.map((m) => (
                    <div key={m.institution_id} className="bg-[var(--bg-raised)] rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-[var(--text-primary)] font-medium truncate">{m.institution_name ?? m.institution_id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(m.status)}`}>
                          {m.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{tr("admin.users.fieldMemberRole", "Rôle")}</span>
                        <span className="text-[var(--text-secondary)]">{m.role_custom_label || m.role_specialization || "—"}</span>
                      </div>
                      {m.joined_at && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">{tr("admin.users.fieldJoinedAt", "Rejoint le")}</span>
                          <span className="text-[var(--text-secondary)]">
                            {new Date(m.joined_at).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] italic">{tr("admin.users.noInstitution", "Aucune institution")}</p>
              )}
            </div>

            {/* Talent DNA */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Dna size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{tr("admin.users.sectionTalentDna", "Talent DNA")}</span>
              </div>
              {detail.talentDna ? (
                <div className="bg-[var(--bg-raised)] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{tr("admin.users.fieldCompletionScore", "Score complétion")}</span>
                    <span className="text-[var(--text-primary)] font-medium">{detail.talentDna.completion_score}%</span>
                  </div>
                  <div className="w-full bg-[var(--border)] rounded-full h-1.5">
                    <div
                      className="bg-[var(--accent)] h-1.5 rounded-full"
                      style={{ width: `${detail.talentDna.completion_score}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{tr("admin.users.fieldUpdatedAt", "Mis à jour")}</span>
                    <span className="text-[var(--text-secondary)]">
                      {new Date(detail.talentDna.updated_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] italic">{tr("admin.users.noTalentDna", "Pas de Talent DNA")}</p>
              )}
            </div>

            {/* Recent applications */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  {tr("admin.users.sectionRecentApplications", "Candidatures récentes")} ({detail.recentApplications.length})
                </span>
              </div>
              {detail.recentApplications.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">{tr("admin.users.noApplications", "Aucune candidature")}</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.recentApplications.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 bg-[var(--bg-raised)] rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-[var(--text-primary)] font-medium truncate">{a.role_title ?? "—"}</div>
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <Calendar size={11} />
                          <span className="truncate">
                            {a.institution_name ?? "—"} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                      <span className={`font-medium ${appStatusColor(a.status)}`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [users, setUsers]             = useState<UserRow[]>([]);
  const [meta, setMeta]               = useState({ total: 0, page: 1, limit: 20 });
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(true);
  const [actionId, setActionId]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [selectedUser, setSelectedUser]   = useState<string | null>(null);
  const [category, setCategory]           = useState<UserCategory>("");

  const load = useCallback((page = 1, q = search, cat: UserCategory = category) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q) params.set("search", q);
    if (cat) params.set("role", cat);
    apiFetch(withParams(adminUsersApi, params.toString())).then((res) => {
      const typed = res as UsersResponse | null;
      if (typed) {
        setUsers(typed.items ?? []);
        setMeta({ total: typed.total ?? 0, page: typed.page ?? 1, limit: typed.limit ?? 20 });
      }
      setLoading(false);
    });
  }, [search, category]);

  useEffect(() => { load(1, ""); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, search);
  };

  const suspend = async (user: UserRow) => {
    const isBanned = user.banned_until && user.banned_until !== "none";
    setActionId(user.id);
    await apiFetch(adminSuspendUserApi(user.id), "HR", {
      method: "PATCH",
      body: JSON.stringify({ suspend: !isBanned }),
    });
    setActionId(null);
    load(meta.page, search);
  };

  const deleteUser = async (user: UserRow) => {
    setConfirmDelete(null);
    setActionId(user.id);
    await apiFetch(adminDeleteUserApi(user.id), "HR", { method: "DELETE" });
    setActionId(null);
    load(meta.page, search);
  };

  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{tr("admin.users.title", "Utilisateurs")}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{meta.total.toLocaleString()} {tr("admin.users.totalAccounts", "comptes au total")}</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-5 flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tr("admin.users.searchPlaceholder", "Email ou nom...")}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {tr("admin.users.searchButton", "Rechercher")}
        </button>
        <select
          value={category}
          onChange={(e) => {
            const next = e.target.value as UserCategory;
            setCategory(next);
            load(1, search, next);
          }}
          aria-label={tr("admin.users.filterCategory", "Catégorie")}
          className="px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">{tr("admin.users.filterAll", "Tous")}</option>
          <option value="HR">{tr("admin.users.filterHr", "Membres d'entreprise")}</option>
          <option value="CANDIDATE">{tr("admin.users.filterCandidates", "Candidats")}</option>
        </select>
      </form>

      {/* Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.users.tableUser", "Utilisateur")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.users.tableRole", "Rôle")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.users.tableInstitution", "Entreprise")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.users.tableCreatedAt", "Inscrit le")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.users.tableStatus", "Statut")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-[var(--text-muted)]">{tr("admin.users.loading", "Chargement…")}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-[var(--text-muted)]">{tr("admin.users.empty", "Aucun utilisateur")}</td></tr>
            ) : users.map((u) => {
              const isBanned = u.banned_until && u.banned_until !== "none";
              const isActing = actionId === u.id;
              return (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-raised)] transition-colors cursor-pointer"
                  onClick={() => setSelectedUser(u.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      u.role === "HR"
                        ? "bg-[var(--info-bg)] text-[var(--info)]"
                        : "bg-[var(--accent-dim)] text-[var(--accent)]"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {u.memberships && u.memberships.length > 0
                      ? u.memberships.map((m) => `${m.institution_name ?? "—"} · ${m.role_specialization ?? m.status}`).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {new Date(u.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {isBanned ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--error)]">
                        <Ban size={11} /> {tr("admin.users.statusSuspended", "Suspendu")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
                        <CheckCircle size={11} /> {tr("admin.users.statusActive", "Actif")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => suspend(u)}
                        disabled={isActing}
                        title={isBanned ? tr("admin.users.reactivate", "Réactiver") : tr("admin.users.suspend", "Suspendre")}
                        className="p-1.5 rounded hover:bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
                      >
                        {isBanned ? <CheckCircle size={15} className="text-[var(--success)]" /> : <Ban size={15} />}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(u)}
                        disabled={isActing}
                        title={tr("admin.users.delete", "Supprimer")}
                        className="p-1.5 rounded hover:bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-[var(--error)] disabled:opacity-40 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>{tr("admin.users.page", "Page")} {meta.page} / {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => load(meta.page - 1)}
              disabled={meta.page <= 1}
              className="p-1.5 rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-raised)] transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => load(meta.page + 1)}
              disabled={meta.page >= totalPages}
              className="p-1.5 rounded border border-[var(--border)] disabled:opacity-30 hover:bg-[var(--bg-raised)] transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* User detail drawer */}
      {selectedUser && (
        <UserDrawer userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 max-w-sm w-full">
            <h2 className="font-semibold text-[var(--text-primary)] mb-2">{tr("admin.users.deleteTitle", "Supprimer l'utilisateur ?")}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              <strong className="text-[var(--text-primary)]">{confirmDelete.email}</strong> {tr("admin.users.deleteMessage", "sera supprimé définitivement. Action irréversible.")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-raised)] transition-colors text-[var(--text-secondary)]"
              >
                {tr("admin.users.cancel", "Annuler")}
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                className="px-4 py-2 text-sm bg-[var(--error)] text-white rounded-lg hover:opacity-90 transition-colors"
              >
                {tr("admin.users.delete", "Supprimer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
