"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiHelper";
import {
  adminInstitutionsApi, adminInstitutionByIdApi, adminDeleteInstitutionApi, withParams
} from "@/lib/routes";
import {
  Search, Trash2, ChevronLeft, ChevronRight, Building2,
  X, Users, Briefcase, MapPin, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstitutionRow {
  id: string;
  name: string;
  sector: string | null;
  location: string | null;
  stage: string | null;
  created_at: string;
}

interface InstitutionsResponse {
  items: InstitutionRow[];
  total: number;
  page: number;
  limit: number;
}

interface InstitutionMember {
  user_id: string;
  role_specialization: string;
  status: string;
  joined_at: string;
}

interface JobPosition {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface InstitutionDetail {
  institution: InstitutionRow & { description?: string; website?: string; employee_count?: number };
  members: InstitutionMember[];
  jobPositions: JobPosition[];
}

// ─── Institution Detail Drawer ────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  OWNER:          "text-amber-400 bg-amber-400/10",
  ADMIN:          "text-blue-400 bg-blue-400/10",
  HR_LEAD:        "text-purple-400 bg-purple-400/10",
  STANDARD_HR:    "text-purple-400/70 bg-purple-400/10",
  HIRING_MANAGER: "text-teal-400 bg-teal-400/10",
  RECRUITER:      "text-sky-400 bg-sky-400/10",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "text-green-400",
  DRAFT:     "text-amber-400",
  CLOSED:    "text-[var(--text-muted)]",
  ARCHIVED:  "text-[var(--text-muted)]",
};

function InstitutionDrawer({ instId, onClose }: { instId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<InstitutionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(adminInstitutionByIdApi(instId)).then((d) => {
      setDetail(d as InstitutionDetail | null);
      setLoading(false);
    });
  }, [instId]);

  const activeMembers  = detail?.members.filter(m => m.status === "ACTIVE").length ?? 0;
  const openJobs       = detail?.jobPositions.filter(j => j.status === "PUBLISHED").length ?? 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border)] z-50 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-surface)]">
          <span className="font-semibold text-sm text-[var(--text-primary)]">Détail entreprise</span>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--bg-raised)] text-[var(--text-muted)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        ) : !detail ? (
          <div className="p-6 text-sm text-[var(--text-muted)]">Impossible de charger.</div>
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

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--bg-raised)] rounded-lg p-3 text-center">
                <div className="text-xl font-semibold text-[var(--text-primary)]">{detail.members.length}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Membres</div>
              </div>
              <div className="bg-[var(--bg-raised)] rounded-lg p-3 text-center">
                <div className="text-xl font-semibold text-green-400">{activeMembers}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Actifs</div>
              </div>
              <div className="bg-[var(--bg-raised)] rounded-lg p-3 text-center">
                <div className="text-xl font-semibold text-[var(--accent)]">{openJobs}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Postes ouverts</div>
              </div>
            </div>

            {/* Meta */}
            <div className="bg-[var(--bg-raised)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">ID</span>
                <span className="font-mono text-[var(--text-secondary)]">{detail.institution.id.slice(0, 16)}…</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Stage</span>
                <span className="text-[var(--text-secondary)]">{detail.institution.stage ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Créée le</span>
                <span className="text-[var(--text-secondary)]">
                  {new Date(detail.institution.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </div>

            {/* Members */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Équipe ({detail.members.length})
                </span>
              </div>
              {detail.members.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">Aucun membre</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.members.slice(0, 10).map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between bg-[var(--bg-raised)] rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role_specialization] ?? "text-[var(--text-muted)] bg-[var(--bg-raised)]"}`}>
                          {m.role_specialization}
                        </span>
                      </div>
                      <span className={m.status === "ACTIVE" ? "text-green-400" : "text-red-400"}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                  {detail.members.length > 10 && (
                    <p className="text-xs text-[var(--text-muted)] text-center pt-1">
                      +{detail.members.length - 10} membres supplémentaires
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Job positions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={13} className="text-[var(--text-muted)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Fiches de poste ({detail.jobPositions.length})
                </span>
              </div>
              {detail.jobPositions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">Aucune fiche de poste</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.jobPositions.map((j) => (
                    <div key={j.id} className="flex items-center justify-between bg-[var(--bg-raised)] rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar size={11} className="text-[var(--text-muted)]" />
                        <span className="text-[var(--text-primary)] font-medium truncate max-w-[160px]">{j.title}</span>
                      </div>
                      <span className={JOB_STATUS_COLORS[j.status] ?? "text-[var(--text-muted)]"}>{j.status}</span>
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
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Entreprises</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{meta.total.toLocaleString()} institutions au total</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-5 flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom de l'entreprise..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Rechercher
        </button>
      </form>

      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Entreprise</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Secteur</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Localisation</th>
              <th className="text-left px-4 py-3 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Inscrite le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-[var(--text-muted)]">Chargement…</td></tr>
            ) : institutions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <Building2 size={32} className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
                  <p className="text-sm text-[var(--text-muted)]">Aucune entreprise</p>
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
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {new Date(inst.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setConfirmDelete(inst)}
                        disabled={isActing}
                        title="Supprimer"
                        className="p-1.5 rounded hover:bg-[var(--bg-raised)] text-[var(--text-muted)] hover:text-red-400 disabled:opacity-40 transition-colors"
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
          <span>Page {meta.page} / {totalPages}</span>
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
            <h2 className="font-semibold text-[var(--text-primary)] mb-2">Supprimer l&apos;entreprise ?</h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              <strong className="text-[var(--text-primary)]">{confirmDelete.name}</strong> et toutes ses données (membres, fiches postes, candidatures) seront supprimées. Action irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-raised)] transition-colors text-[var(--text-secondary)]"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteInstitution(confirmDelete)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
