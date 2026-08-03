"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserCheck, UserX, Clock, Plus, Search, List, GitBranch } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { API, employeePath, institutionMeDepartmentsApi, withParams } from "@/lib/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientLocale, t } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";
import { OrgChart } from "./OrgChart";

type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED";
type EmploymentType = "CDI" | "CDD" | "FREELANCE" | "INTERNSHIP" | "PART_TIME";

interface Employee {
  id: string;
  user_id: string;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  start_date: string;
  end_date: string | null;
  salary_amount: number | null;
  salary_currency: string;
  profiles: { id: string; full_name: string; email: string; avatar_url: string | null } | null;
  job_positions: { id: string; title: string } | null;
  departments: { id: string; name: string } | null;
}

interface Department {
  id: string;
  name: string;
  parent_department_id: string | null;
  manager_user_id: string | null;
}

const STATUS_STYLES: Record<EmploymentStatus, { cls: string }> = {
  ACTIVE:     { cls: "bg-green-500/15 text-green-400" },
  ON_LEAVE:   { cls: "bg-yellow-500/15 text-yellow-400" },
  SUSPENDED:  { cls: "bg-red-500/15 text-red-400" },
  TERMINATED: { cls: "bg-[var(--bg-raised)] text-[var(--text-muted)]" },
};

export default function HREmployeesPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission("employees.manage");

  const [tab, setTab] = useState<"list" | "chart">("list");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | "">("");

  useEffect(() => {
    void load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      // apiFetch unwraps data.data, so employees returns Employee[] directly
      // Backend returns { data: Employee[], total: N } → apiFetch returns Employee[]
      const [empRaw, deptRaw] = await Promise.all([
        apiFetch(withParams(API.employees, params.toString()), "HR"),
        apiFetch(institutionMeDepartmentsApi, "HR"),
      ]);
      // Handle both unwrapped (array) and wrapped ({ data, total }) responses
      if (empRaw) {
        const empList = Array.isArray(empRaw) ? empRaw as Employee[] : (empRaw as { data: Employee[]; total: number }).data ?? [];
        const empTotal = Array.isArray(empRaw) ? empList.length : (empRaw as { data: Employee[]; total: number }).total ?? empList.length;
        setEmployees(empList);
        setTotal(empTotal);
      }
      if (deptRaw) {
        const deptList = Array.isArray(deptRaw) ? deptRaw as Department[] : (deptRaw as { data: Department[] }).data ?? [];
        setDepartments(deptList);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const name = e.profiles?.full_name?.toLowerCase() ?? "";
    const email = e.profiles?.email?.toLowerCase() ?? "";
    return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
  });

  const activeCount    = employees.filter((e) => e.employment_status === "ACTIVE").length;
  const onLeaveCount   = employees.filter((e) => e.employment_status === "ON_LEAVE").length;
  const terminatedCount = employees.filter((e) => e.employment_status === "TERMINATED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "hr.employees.title", "Employés")}
        subtitle={t(locale, "hr.employees.subtitle", `${total} employé${total !== 1 ? "s" : ""}`, { count: total })}
        actions={undefined}
      />

      {/* Stats strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-6 py-4 flex items-center gap-8">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{activeCount}</span>
          <span className="text-xs text-[var(--text-muted)]">{t(locale, "hr.employees.statActive", "actifs")}</span>
        </div>
        <div className="w-px h-5 bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{onLeaveCount}</span>
          <span className="text-xs text-[var(--text-muted)]">{t(locale, "hr.employees.statOnLeave", "en congé")}</span>
        </div>
        <div className="w-px h-5 bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{terminatedCount}</span>
          <span className="text-xs text-[var(--text-muted)]">{t(locale, "hr.employees.statDeparted", "partis")}</span>
        </div>
      </div>

      {/* Tab switcher + filters row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-[var(--bg-raised)] rounded-lg border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "list"
                ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            {t(locale, "hr.employees.tabList", "Liste")}
          </button>
          <button
            type="button"
            onClick={() => setTab("chart")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "chart"
                ? "bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            {t(locale, "hr.employees.tabChart", "Organigramme")}
          </button>
        </div>

        {tab === "list" && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder={t(locale, "hr.employees.searchPlaceholder", "Rechercher un employé...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-56"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EmploymentStatus | "")}
              className="px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">{t(locale, "hr.employees.statusAll", "Tous les statuts")}</option>
              <option value="ACTIVE">{t(locale, "hr.employees.status.ACTIVE", "Actif")}</option>
              <option value="ON_LEAVE">{t(locale, "hr.employees.status.ON_LEAVE", "En congé")}</option>
              <option value="SUSPENDED">{t(locale, "hr.employees.status.SUSPENDED", "Suspendu")}</option>
              <option value="TERMINATED">{t(locale, "hr.employees.status.TERMINATED", "Parti")}</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === "chart" ? (
        loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <OrgChart departments={departments} employees={employees} />
        )
      ) : (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-[var(--bg-raised)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">
                {search
                  ? t(locale, "hr.employees.emptySearch", "Aucun employé trouvé pour cette recherche.")
                  : t(locale, "hr.employees.emptyAll", "Aucun employé enregistré.")}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t(locale, "hr.employees.emptyHint", "Les employés apparaissent automatiquement quand une candidature passe au statut HIRED.")}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t(locale, "hr.employees.col.employee", "Employé")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">{t(locale, "hr.employees.col.position", "Poste")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden lg:table-cell">{t(locale, "hr.employees.col.department", "Département")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">{t(locale, "hr.employees.col.contract", "Contrat")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden lg:table-cell">{t(locale, "hr.employees.col.since", "Depuis")}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t(locale, "hr.employees.col.status", "Statut")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((emp) => {
                  const statusStyle = STATUS_STYLES[emp.employment_status] ?? STATUS_STYLES.ACTIVE;
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-[var(--bg-raised)] cursor-pointer transition-colors"
                      onClick={() => router.push(employeePath(emp.user_id))}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {emp.profiles?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={emp.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                              {emp.profiles?.full_name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{emp.profiles?.full_name ?? "—"}</p>
                            <p className="text-xs text-[var(--text-muted)]">{emp.profiles?.email ?? ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="text-sm text-[var(--text-secondary)]">{emp.job_positions?.title ?? "—"}</span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-sm text-[var(--text-secondary)]">{emp.departments?.name ?? "—"}</span>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="text-xs bg-[var(--bg-raised)] text-[var(--text-secondary)] px-2 py-1 rounded-md">
                          {t(locale, `hr.employees.type.${emp.employment_type}`, emp.employment_type)}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-sm text-[var(--text-muted)]">
                          {new Date(emp.start_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${statusStyle.cls}`}>
                          {t(locale, `hr.employees.status.${emp.employment_status}`, emp.employment_status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
