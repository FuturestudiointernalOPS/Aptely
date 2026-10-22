"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronRight, RefreshCw, Trash2, X, CheckCircle, DollarSign } from "lucide-react";
import { apiFetch, isApiSuccess } from "@/lib/apiHelper";
import { payrollPeriodsApi, payrollPeriodApi, payrollGenerateApi, payrollEntryApi } from "@/lib/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientLocale, t } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";
import { formatSalary } from "@/lib/currencies";

interface PayrollPeriod {
  id: string;
  period_month: number;
  period_year: number;
  status: "DRAFT" | "VALIDATED" | "PAID";
  total_gross: number | null;
  total_net: number | null;
  notes: string | null;
  created_at: string;
}

interface PayrollEntry {
  id: string;
  employee_user_id: string;
  employee_name: string;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  notes: string | null;
}

interface PeriodDetail extends PayrollPeriod {
  entries: PayrollEntry[];
}

function monthLabel(month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { month: "short" }).format(new Date(2000, month - 1, 1));
}

function formatMoney(n: number | null, locale: string, currency = "EUR") {
  return formatSalary(n, currency, locale);
}

export default function PayrollPage() {
  const locale = getClientLocale();
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission("payroll.manage");
  const fmt = (n: number | null) => formatMoney(n, locale);
  const monthName = (m: number) => monthLabel(m, locale);

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selected, setSelected] = useState<PeriodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [generating, setGenerating] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState<string | null>(null);
  const [deletingPeriod, setDeletingPeriod] = useState(false);

  useEffect(() => { void loadPeriods(); }, []);

  async function loadPeriods() {
    try {
      const res = await apiFetch(payrollPeriodsApi, "HR") as PayrollPeriod[] | null;
      setPeriods(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(periodId: string) {
    setDetailLoading(true);
    setConfirmDeletePeriod(null);
    try {
      const res = await apiFetch(payrollPeriodApi(periodId), "HR") as PeriodDetail | null;
      if (isApiSuccess(res)) setSelected(res);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch(payrollPeriodsApi, "HR", {
      method: "POST",
      body: JSON.stringify({ period_month: newPeriod.month, period_year: newPeriod.year }),
    }) as PayrollPeriod | null;
    if (isApiSuccess(res) && res) {
      setCreating(false);
      await loadPeriods();
      void loadDetail(res.id);
    }
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    try {
      await apiFetch(payrollGenerateApi(selected.id), "HR", { method: "POST" });
      await loadDetail(selected.id);
      await loadPeriods();
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusChange(nextStatus: "VALIDATED" | "PAID") {
    if (!selected) return;
    const res = await apiFetch(payrollPeriodApi(selected.id), "HR", {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    }) as PayrollPeriod | null;
    if (isApiSuccess(res) && res) {
      setSelected({ ...selected, status: res.status });
      setPeriods((prev) => prev.map((p) => p.id === selected.id ? { ...p, status: res!.status } : p));
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!selected) return;
    setDeletingEntry(entryId);
    try {
      await apiFetch(payrollEntryApi(selected.id, entryId), "HR", { method: "DELETE" });
      await loadDetail(selected.id);
      await loadPeriods();
    } finally {
      setDeletingEntry(null);
      setConfirmDelete(null);
    }
  }

  async function handleDeletePeriod(periodId: string) {
    setDeletingPeriod(true);
    try {
      await apiFetch(payrollPeriodApi(periodId), "HR", { method: "DELETE" });
      setSelected(null);
      setConfirmDeletePeriod(null);
      await loadPeriods();
    } finally {
      setDeletingPeriod(false);
    }
  }

  const statusColor = (s: string) =>
    s === "PAID"      ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
    s === "VALIDATED" ? "bg-sky-400/10 text-sky-400 border-sky-400/30" :
                        "bg-amber-400/10 text-amber-400 border-amber-400/30";

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-40 rounded-lg bg-[var(--bg-raised)] animate-pulse" />
        <div className="h-48 rounded-xl bg-[var(--bg-raised)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col md:flex-row gap-6 h-full max-w-7xl">
      {/* Left — period list */}
      <div className="w-full md:w-72 md:shrink-0 space-y-3">
        <PageHeader
          title={t(locale, "payroll.title", "Paie")}
          subtitle={t(locale, "payroll.subtitle", "Gestion des bulletins de salaire")}
        />

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {t(locale, "payroll.periods", "Périodes")}
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              <Plus size={14} />
              {t(locale, "payroll.new", "Nouveau")}
            </button>
          )}
        </div>

        {periods.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            {t(locale, "payroll.empty", "Aucune période")}
          </p>
        )}

        {periods.map((period) => (
          <button
            key={period.id}
            type="button"
            onClick={() => void loadDetail(period.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              selected?.id === period.id
                ? "bg-[var(--accent-dim)] border-[var(--accent)]/30"
                : "bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--accent)]/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {monthName(period.period_month)} {period.period_year}
              </p>
              <ChevronRight size={14} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-[var(--text-muted)]">{fmt(period.total_net)} {t(locale, "payroll.net", "Net").toLowerCase()}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusColor(period.status)}`}>
                {t(locale, `payroll.status.${period.status}`, period.status)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Right — period detail */}
      <div className="flex-1 min-w-0">
        {!selected && !detailLoading && (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
            {t(locale, "payroll.select_hint", "Sélectionner une période")}
          </div>
        )}

        {detailLoading && (
          <div className="space-y-3 md:mt-16">
            <div className="h-8 w-56 rounded-lg bg-[var(--bg-raised)] animate-pulse" />
            <div className="h-48 rounded-xl bg-[var(--bg-raised)] animate-pulse" />
          </div>
        )}

        {selected && !detailLoading && (
          <div className="space-y-5 md:mt-16">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {monthName(selected.period_month)} {selected.period_year}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor(selected.status)}`}>
                    {t(locale, `payroll.status.${selected.status}`, selected.status)}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {t(locale, "payroll.employees", `${selected.entries.length} employés`, { count: selected.entries.length })}
                  </span>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  {selected.status === "DRAFT" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
                        {t(locale, "payroll.generate", "Générer depuis employés")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleStatusChange("VALIDATED")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors"
                      >
                        <CheckCircle size={12} />
                        {t(locale, "payroll.validate", "Valider")}
                      </button>
                      {confirmDeletePeriod === selected.id ? (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-400/30 bg-red-400/10">
                          <span className="text-xs text-red-400">{t(locale, "payroll.delete_period_confirm", "Supprimer cette période ?")}</span>
                          <button type="button" onClick={() => void handleDeletePeriod(selected.id)}
                            disabled={deletingPeriod}
                            className="text-xs font-semibold text-red-400 hover:opacity-80 disabled:opacity-50">
                            {t(locale, "payroll.confirm", "Oui")}
                          </button>
                          <button type="button" onClick={() => setConfirmDeletePeriod(null)}
                            disabled={deletingPeriod}
                            className="text-xs text-[var(--text-muted)] hover:opacity-80 disabled:opacity-50">
                            {t(locale, "payroll.cancel", "Non")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePeriod(selected.id)}
                          className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                  {selected.status === "VALIDATED" && (
                    <button
                      type="button"
                      onClick={() => void handleStatusChange("PAID")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <DollarSign size={12} />
                      {t(locale, "payroll.mark_paid", "Marquer payé")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Totals strip */}
            <div className="flex divide-x divide-[var(--border)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="flex-1 px-5 py-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">{t(locale, "payroll.total_gross", "Brut total")}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{fmt(selected.total_gross)}</p>
              </div>
              <div className="flex-1 px-5 py-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">{t(locale, "payroll.total_deductions", "Charges")}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">
                  {fmt(selected.entries.reduce((s, e) => s + Number(e.deductions), 0))}
                </p>
              </div>
              <div className="flex-1 px-5 py-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">{t(locale, "payroll.total_net", "Net total")}</p>
                <p className="text-xl font-bold text-[var(--accent)]">{fmt(selected.total_net)}</p>
              </div>
            </div>

            {/* Entries table */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)] grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <span>{t(locale, "payroll.employee", "Employé")}</span>
                <span className="text-right">{t(locale, "payroll.gross", "Brut")}</span>
                <span className="text-right">{t(locale, "payroll.deductions", "Charges")}</span>
                <span className="text-right">{t(locale, "payroll.net", "Net")}</span>
                <span />
              </div>

              {selected.entries.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[var(--text-muted)] text-center">
                  {t(locale, "payroll.entries_empty", "Aucune entrée — cliquez Générer")}
                </p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {selected.entries.map((entry) => (
                    <div key={entry.id} className="px-5 py-3 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                      <p className="text-sm text-[var(--text-primary)] truncate">{entry.employee_name}</p>
                      <p className="text-sm text-[var(--text-secondary)] text-right tabular-nums">{fmt(entry.gross_salary)}</p>
                      <p className="text-sm text-red-400 text-right tabular-nums">−{fmt(entry.deductions)}</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] text-right tabular-nums">{fmt(entry.net_salary)}</p>
                      {canManage && selected.status === "DRAFT" ? (
                        confirmDelete === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => void handleDeleteEntry(entry.id)}
                              disabled={deletingEntry === entry.id}
                              className="text-[10px] text-red-400 hover:opacity-80">
                              {t(locale, "payroll.confirm", "Oui")}
                            </button>
                            <button type="button" onClick={() => setConfirmDelete(null)}
                              className="text-[10px] text-[var(--text-muted)] hover:opacity-80">
                              {t(locale, "payroll.cancel", "Non")}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setConfirmDelete(entry.id)}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        )
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create period modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCreating(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {t(locale, "payroll.new_period", "Nouvelle période")}
              </h3>
              <button type="button" onClick={() => setCreating(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(locale, "payroll.month", "Mois")}
                  </label>
                  <select
                    value={newPeriod.month}
                    onChange={(e) => setNewPeriod({ ...newPeriod, month: Number(e.target.value) })}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{monthName(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(locale, "payroll.year", "Année")}
                  </label>
                  <input
                    type="number"
                    min={2020}
                    max={2100}
                    value={newPeriod.year}
                    onChange={(e) => setNewPeriod({ ...newPeriod, year: Number(e.target.value) })}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setCreating(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  {t(locale, "payroll.cancel", "Annuler")}
                </button>
                <button type="submit"
                  className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
                  {t(locale, "payroll.create", "Créer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
