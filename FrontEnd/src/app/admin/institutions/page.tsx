"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiHelper";
import {
  adminInstitutionsApi, adminInstitutionByIdApi, adminDeleteInstitutionApi, withParams
} from "@/lib/routes";
import {
  Search, Trash2, ChevronLeft, ChevronRight, Building2,
  X, Users, Briefcase, MapPin, Calendar, UserRound,
} from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstitutionRow {
  id: string;
  name: string;
  sector: string | null;
  location: string | null;
  stage: string | null;
  created_at: string;
  member_count?: number;
  job_posting_count?: number;
}

interface InstitutionsResponse {
  items: InstitutionRow[];
  total: number;
  page: number;
  limit: number;
}

interface InstitutionMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role_specialization: string | null;
  role_custom_label: string | null;
  status: string;
  joined_at: string;
}

interface JobPosting {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
}

interface InstitutionCandidate {
  application_id: string;
  candidate_id: string | null;
  full_name: string | null;
  email: string | null;
  role_title: string | null;
  status: string;
  applied_at: string;
}

interface InstitutionStats {
  totalUsers: number;
  pendingRequests: number;
  suspendedMembers: number;
  totalEmployees: number;
  hrUsers: number;
  jobPostings: number;
  openJobPostings: number;
  applications: number;
  candidates: number;
}

interface InstitutionDetail {
  institution: InstitutionRow & { description?: string; website?: string };
  stats: InstitutionStats;
  members: InstitutionMember[];
  jobPostings: JobPosting[];
  candidates: InstitutionCandidate[];
}

// ─── Institution Detail Drawer ────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  OWNER:          "text-[var(--warning)] bg-[var(--warning-bg)]",
  ADMIN:          "text-[var(--info)] bg-[var(--info-bg)]",
  HR_LEAD:        "text-[var(--accent)] bg-[var(--accent-dim)]",
  STANDARD_HR:    "text-[var(--accent)] bg-[var(--accent-dim)]",
  HIRING_MANAGER: "text-[var(--info)] bg-[var(--info-bg)]",
  RECRUITER:      "text-[var(--info)] bg-[var(--info-bg)]",
};

// Job posting (roles.status) colours.
const JOB_STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "text-[var(--success)]",
  DRAFT:     "text-[var(--warning)]",
  CLOSED:    "text-[var(--text-muted)]",
  CANCELLED: "text-[var(--text-muted)]",
};

const ACTIVE_MEMBER_STATUSES = new Set(["OWNER", "ADMIN", "ACTIVE"]);
function dateLocale(locale: string) {
  return locale === "en" ? "en-US" : "fr-FR";
}

function InstitutionDrawer({ instId, onClose }: { instId: string; onClose: () => void }) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [detail, setDetail] = useState<InstitutionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(adminInstitutionByIdApi(instId)).then((d) => {
      const typed = d as InstitutionDetail | null;
      // apiFetch returns an error object (not null) on 401/403.
      setDetail(typed && "institution" in typed ? typed : null);
      setLoading(false);
    });
  }, [instId]);

  const stats = detail?.stats;
  const statCards: Array<{ label: string; value: number; tone: string }> = stats
    ? [
        { label: tr("admin.institutions.statUsers", "Utilisateurs"), value: stats.totalUsers, tone: "text-[var(--text-primary)]" },
        { label: tr("admin.institutions.statEmployees", "Employés"), value: stats.totalEmployees, tone: "text-[var(--text-primary)]" },
        { label: tr("admin.institutions.statHrUsers", "Équipe RH"), value: stats.hrUsers, tone: "text-[var(--accent)]" },
        { label: tr("admin.institutions.statOpenJobs", "Offres ouvertes"), value: stats.openJobPostings, tone: "text-[var(--success)]" },
        { label: tr("admin.institutions.statApplications", "Candidatures"), value: stats.applications, tone: "text-[var(--text-primary)]" },
        { label: tr("admin.institutions.statCandidates", "Candidats"), value: stats.candidates, tone: "text-[var(--text-primary)]" },
      ]
    : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border)] z-50 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-surface)]">
          <span className="font-semibold text-sm text-[var(--text-primary)]">{tr("admin.institutions.drawerTitle", "Détail entreprise")}</span>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--bg-raised)] text-[var(--text-muted)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">{tr("admin.institutions.drawerLoadError", "Impossible de charger.")}</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-[var(--text-muted)]" />
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{detail.institution.name}</div>
                  {detail.institution.sector && (
                    <div className="text-xs text-[var(--text-muted)]">{detail.institution.sector}</div>
                  )}
                </div>
              </div>
              {detail.institution.location && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--text-muted)]">
                  <MapPin size={11} />
                  {detail.institution.location}
                </div>
              )}
            </div>

            {/* Stats — computed server-side from the underlying records */}
            <div className="grid grid-cols-3 gap-3">
              {statCards.map((c) => (
                <div key={c.label} className="bg-[var(--bg-raised)] rounded-lg p-3 text-center">
                  <div className={`text-xl font-semibold ${c.tone}`}>{c.value}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
            {stats && (stats.pendingRequests > 0 || stats.suspendedMembers > 0) && (
              <p className="text-xs text-[var(--text-muted)] -mt-3">
                {stats.pendingRequests} {tr("admin.institutions.pendingRequests", "demande(s) d'adhésion en attente")} · {stats.suspendedMembers} {tr("admin.institutions.suspendedMembers", "membre(s) suspendu(s)")}
              </p>
            )}

            {/* Meta */}
            <div className="bg-[var(--bg-raised)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{tr("admin.institutions.fieldId", "ID")}</span>
                <span className="font-mono text-[var(--text-secondary)]">{detail.institution.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{tr("admin.institutions.fieldStage", "Stage")}</span>
                <span className="text-[var(--text-secondary)]">{detail.institution.stage ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{tr("admin.institutions.fieldCreatedAt", "Créée le")}</span>
                <span className="text-[var(--text-secondary)]">
                  {new Date(detail.institution.created_at).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>

            {/* Members — who they are, their role and status */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  {tr("admin.institutions.sectionTeam", "Équipe")} ({detail.members.length})
                </span>
              </div>
              {detail.members.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">{tr("admin.institutions.noMembers", "Aucun membre")}</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.members.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between gap-2 bg-[var(--bg-raised)] rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-[var(--text-primary)] font-medium truncate">{m.full_name || m.email || m.user_id}</div>
                        {m.email && <div className="text-[var(--text-muted)] truncate">{m.email}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role_specialization ?? ""] ?? "text-[var(--text-muted)] bg-[var(--bg-surface)]"}`}>
                          {m.role_custom_label || m.role_specialization || "—"}
                        </span>
                        <span className={ACTIVE_MEMBER_STATUSES.has(m.status) ? "text-[var(--success)]" : "text-[var(--error)]"}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Job postings (roles) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  {tr("admin.institutions.sectionJobPositions", "Fiches de poste")} ({detail.jobPostings.length})
                </span>
              </div>
              {detail.jobPostings.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">{tr("admin.institutions.noJobPositions", "Aucune fiche de poste")}</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.jobPostings.map((j) => (
                    <div key={j.id} className="flex items-center justify-between bg-[var(--bg-raised)] rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar size={11} className="text-[var(--text-muted)] shrink-0" />
                        <span className="text-[var(--text-primary)] font-medium truncate">{j.title || tr("admin.institutions.untitledJob", "Sans titre")}</span>
                      </div>
                      <span className={JOB_STATUS_COLORS[j.status] ?? "text-[var(--text-muted)]"}>{j.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Candidates in the enterprise's recruitment process */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserRound size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  {tr("admin.institutions.sectionCandidates", "Candidats")} ({detail.stats.candidates})
                </span>
              </div>
              {detail.candidates.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">{tr("admin.institutions.noCandidates", "Aucune candidature")}</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.candidates.map((c) => (
                    <div key={c.application_id} className="flex items-center justify-between gap-2 bg-[var(--bg-raised)] rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-[var(--text-primary)] font-medium truncate">{c.full_name || c.email || "—"}</div>
                        <div className="text-[var(--text-muted)] truncate">{c.role_title || "—"}</div>
                      </div>
                      <span className="text-[var(--text-secondary)] shrink-0">{c.status}</span>
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

export default function AdminInstitutionsPage() {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [meta, setMeta]                 = useState({ total: 0, page: 1, limit: 20 });
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(true);
  const [actionId, setActionId]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InstitutionRow | null>(null);
  const [selectedInst, setSelectedInst]   = useState<string | null>(null);

  const load = useCallback((page = 1, q = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q) params.set("search", q);
    apiFetch(withParams(adminInstitutionsApi, params.toString())).then((res) => {
      const typed = res as InstitutionsResponse | null;
      if (typed) {
        setInstitutions(typed.items ?? []);
        setMeta({ total: typed.total ?? 0, page: typed.page ?? 1, limit: typed.limit ?? 20 });
      }
      setLoading(false);
    });
  }, [search]);

  useEffect(() => { load(1, ""); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, search);
  };

  const deleteInstitution = async (inst: InstitutionRow) => {
    setConfirmDelete(null);
    setActionId(inst.id);
    await apiFetch(adminDeleteInstitutionApi(inst.id), "HR", { method: "DELETE" });
    setActionId(null);
    load(meta.page, search);
  };

  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{tr("admin.institutions.title", "Entreprises")}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{meta.total.toLocaleString()} {tr("admin.institutions.totalInstitutions", "institutions au total")}</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-5 flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tr("admin.institutions.searchPlaceholder", "Nom de l'entreprise...")}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {tr("admin.institutions.searchButton", "Rechercher")}
        </button>
      </form>

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.institutions.tableName", "Entreprise")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.institutions.tableSector", "Secteur")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.institutions.tableLocation", "Localisation")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.institutions.tableMembers", "Membres")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.institutions.tableJobPostings", "Offres")}</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{tr("admin.institutions.tableCreatedAt", "Inscrite le")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--text-muted)]">{tr("admin.institutions.loading", "Chargement…")}</td></tr>
            ) : institutions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Building2 size={32} className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
                  <p className="text-sm text-[var(--text-muted)]">{tr("admin.institutions.empty", "Aucune entreprise")}</p>
                </td>
              </tr>
            ) : institutions.map((inst) => {
              const isActing = actionId === inst.id;
              return (
                <tr
                  key={inst.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-raised)] transition-colors cursor-pointer"
                  onClick={() => setSelectedInst(inst.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{inst.name}</div>
                    <div className="text-xs text-[var(--text-muted)] font-mono">{inst.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{inst.sector ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{inst.location ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{inst.member_count ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{inst.job_posting_count ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {new Date(inst.created_at).toLocaleDateString(dateLocale(locale))}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setConfirmDelete(inst)}
                        disabled={isActing}
                        title={tr("admin.institutions.delete", "Supprimer")}
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>{tr("admin.institutions.page", "Page")} {meta.page} / {totalPages}</span>
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

      {/* Institution detail drawer */}
      {selectedInst && (
        <InstitutionDrawer instId={selectedInst} onClose={() => setSelectedInst(null)} />
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 max-w-sm w-full">
            <h2 className="font-semibold text-[var(--text-primary)] mb-2">{tr("admin.institutions.deleteTitle", "Supprimer l'entreprise ?")}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              <strong className="text-[var(--text-primary)]">{confirmDelete.name}</strong> {tr("admin.institutions.deleteMessage", "et toutes ses données (membres, fiches postes, candidatures) seront supprimées. Action irréversible.")}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-raised)] transition-colors text-[var(--text-secondary)]"
              >
                {tr("admin.institutions.cancel", "Annuler")}
              </button>
              <button
                onClick={() => deleteInstitution(confirmDelete)}
                className="px-4 py-2 text-sm bg-[var(--error)] text-white rounded-lg hover:opacity-90 transition-colors"
              >
                {tr("admin.institutions.delete", "Supprimer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
