"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Briefcase, Clock, X, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { applyPath, rolesPublicDiscoverApi, withParams, ROUTES, createAuthRedirect } from "@/lib/routes";
import { API_URL } from "@/lib/apiHelper";
import { getClientLocale, t, type Locale } from "@/lib/i18n";
import Link from "next/link";

interface DiscoverRole {
  id: string;
  share_link: string;
  created_at: string;
  title: string;
  description: string | null;
  location: string | null;
  type: string | null;
  institution_name: string | null;
  institution_logo: string | null;
}

const PAGE_SIZE = 20;

function timeAgo(dateStr: string, locale: Locale): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return t(locale, "time.today", "Aujourd'hui");
  if (days === 1) return t(locale, "time.yesterday", "Hier");
  if (days < 7) return `${days} ${t(locale, "time.daysAgoShort", "j")}`;
  if (days < 30) return `${Math.floor(days / 7)} ${t(locale, "time.weeksAgoShort", "sem.")}`;
  return `${Math.floor(days / 30)} ${t(locale, "time.monthsAgoShort", "mois")}`;
}

function InstitutionLogo({ logo, name }: { logo: string | null; name: string | null }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <img src={logo} alt={name ?? ""} onError={() => setErr(true)} className="w-10 h-10 rounded-lg object-cover border border-[var(--border)] shrink-0" />;
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-[var(--accent-dim)] border border-[var(--border)] shrink-0 flex items-center justify-center">
      <span className="text-xs font-bold text-[var(--accent)]">{(name ?? "?").slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export default function OpportunitiesPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isPersonal } = useWorkspace();
  const [roles, setRoles] = useState<DiscoverRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace(createAuthRedirect(ROUTES.candidate.opportunities)); return; }
    if (!isPersonal) { router.replace(ROUTES.company.dashboard); return; }
  }, [authLoading, user, router, isPersonal]);

  const load = useCallback(async (query: string, loc: string, tp: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg) });
      if (query) params.set("q", query);
      if (loc) params.set("location", loc);
      if (tp) params.set("type", tp);
      const res = await fetch(`${API_URL}${withParams(rolesPublicDiscoverApi, params.toString())}`);
      if (!res.ok) return;
      const json = await res.json() as { data: DiscoverRole[]; total: number };
      setRoles(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && isPersonal) {
      void load(q, location, type, page);
    }
  }, [load, q, location, type, page, authLoading, user, isPersonal]);

  const handleQChange = (v: string) => { setQ(v); setPage(1); };
  const handleLocChange = (v: string) => { setLocation(v); setPage(1); };
  const handleTypeChange = (v: string) => { setType(v); setPage(1); };

  const CONTRACT_TYPES = ["Full-time", "Contract", "Freelance", "Internship", "Trial-to-hire"];

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-muted)]">
          {t(locale, "common.loading", "Chargement...")}
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "opportunities.kicker", "Aptely Jobs")}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mt-1">
            {t(locale, "opportunities.title", "Opportunités")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t(locale, "opportunities.subtitle", "Parcourez toutes les fiches de poste publiées sur Aptely et postulez directement.")}
          </p>
        </div>

        {/* Search & filters */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={15} />
            <input
              type="text"
              value={q}
              onChange={(e) => handleQChange(e.target.value)}
              placeholder={t(locale, "opportunities.searchPlaceholder", "Poste, entreprise, compétence…")}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
            />
            {q && (
              <button type="button" onClick={() => handleQChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[140px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
              <input
                type="text"
                value={location}
                onChange={(e) => handleLocChange(e.target.value)}
                placeholder={t(locale, "opportunities.locationPlaceholder", "Ville, pays…")}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
            >
              <option value="">{t(locale, "opportunities.allTypes", "Tous contrats")}</option>
              {CONTRACT_TYPES.map((ct) => (
                <option key={ct} value={ct}>{t(locale, `discover.type.${ct}`, ct)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            {loading ? "…" : `${roles.length} ${roles.length <= 1 ? t(locale, "opportunities.resultSingular", "poste disponible") : t(locale, "opportunities.resultPlural", "postes disponibles")}`}
          </p>
          {(q || location || type) && (
            <button type="button"
              onClick={() => { setQ(""); setLocation(""); setType(""); setPage(1); }}
              className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity">
              {t(locale, "opportunities.clearFilters", "Effacer les filtres")}
            </button>
          )}
        </div>

        {/* Role cards */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] animate-pulse" />
            ))}
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
            <Briefcase className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              {t(locale, "opportunities.empty", "Aucun poste disponible")}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t(locale, "opportunities.emptyHint", "De nouvelles opportunités seront publiées prochainement.")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {roles.map((role) => (
              <Link
                key={role.id}
                href={applyPath(role.share_link)}
                className="group bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)]/40 hover:bg-[var(--bg-raised)] transition-all space-y-3"
              >
                <div className="flex items-center gap-3">
                  <InstitutionLogo logo={role.institution_logo} name={role.institution_name} />
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-muted)] truncate">{role.institution_name ?? "—"}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {role.title}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {role.location && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)]">
                      <MapPin size={9} />{role.location}
                    </span>
                  )}
                  {role.type && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)]">
                      <Briefcase size={9} />{t(locale, `discover.type.${role.type}`, role.type)}
                    </span>
                  )}
                </div>

                {role.description && (
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                    {role.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                    <Clock size={9} />{timeAgo(role.created_at, locale)}
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--accent)] group-hover:underline">
                    {t(locale, "opportunities.apply", "Postuler →")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors">
              ←
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              {page} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE)}
              className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors">
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
