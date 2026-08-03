"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Loader2,
  CheckCircle2, Clock, AlertCircle, ChevronRight
} from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import {
  compensationHistoryApi, compensationReviewApi, compensationReviewByIdApi
} from "@/lib/routes";
import { useRequireInstitution } from "@/lib/auth";
import { getClientLocale, t } from "@/lib/i18n";
import { formatSalary as fmtSalary } from "@/lib/currencies";

interface CompReview {
  id: string;
  effective_date: string;
  previous_salary: number | null;
  new_salary: number;
  change_reason: string | null;
  change_pct: number | null;
  status: "draft" | "submitted" | "hr_approved" | "finance_approved" | "ceo_approved" | "effective";
  notes: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  draft:            { color: "bg-[var(--bg-raised)] text-[var(--text-muted)]",   icon: Clock },
  submitted:        { color: "bg-blue-500/15 text-blue-400",                     icon: ChevronRight },
  hr_approved:      { color: "bg-indigo-500/15 text-indigo-400",                 icon: CheckCircle2 },
  finance_approved: { color: "bg-violet-500/15 text-violet-400",                 icon: CheckCircle2 },
  ceo_approved:     { color: "bg-amber-500/15 text-amber-400",                   icon: CheckCircle2 },
  effective:        { color: "bg-emerald-500/15 text-emerald-400",               icon: CheckCircle2 },
};

const REASON_KEYS = ["merit", "promotion", "market", "correction", "other"] as const;

function formatSalaryLocal(locale: string, amount: number | null, currency = "EUR"): string {
  return fmtSalary(amount, currency, locale);
}

export default function EmployeeCompensationPage() {
  useRequireInstitution();
  const { userId } = useParams<{ userId: string }>();
  const locale = getClientLocale();
  const tr = (k: string, fb: string, params?: Record<string, string | number>) => t(locale, k, fb, params);

  const [history, setHistory] = useState<CompReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    new_salary: "",
    previous_salary: "",
    effective_date: "",
    change_reason: "merit",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const raw = await apiFetch(compensationHistoryApi(userId), "HR") as any;
    setHistory(Array.isArray(raw) ? raw : raw?.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const handleCreate = async () => {
    if (!form.new_salary || !form.effective_date) return;
    setSubmitting(true);
    await apiFetch(compensationReviewApi(userId), "HR", {
      method: "POST",
      body: JSON.stringify({
        employee_user_id: userId,
        new_salary: parseFloat(form.new_salary),
        previous_salary: form.previous_salary ? parseFloat(form.previous_salary) : undefined,
        effective_date: form.effective_date,
        change_reason: form.change_reason,
        notes: form.notes || undefined,
      }),
    });
    setForm({ new_salary: "", previous_salary: "", effective_date: "", change_reason: "merit", notes: "" });
    setShowForm(false);
    await load();
    setSubmitting(false);
  };

  const handleAdvance = async (review: CompReview) => {
    setAdvancing(review.id);
    setError(null);
    const result = await apiFetch(compensationReviewByIdApi(userId, review.id), "HR", {
      method: "PATCH",
      body: JSON.stringify({ action: "approve" }),
    });
    if (result === null) {
      setError(tr("compensation.advanceError", "Couldn't advance this review — you may not be authorized for this approval stage (e.g. you can't approve your own submission)."));
    } else {
      await load();
    }
    setAdvancing(null);
  };

  const currentSalary = history.find(r => r.status === "effective");
  const pendingReview = history.find(r => !["effective", "draft"].includes(r.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{tr("compensation.title", "Rémunération")}</h2>
            <p className="text-xs text-[var(--text-muted)]">{tr("compensation.subtitle", "Historique et révisions salariales")}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          {tr("compensation.newReview", "Nouvelle révision")}
        </button>
      </div>

      {/* Advance error */}
      {error && (
        <div className="px-4 py-2.5 rounded-xl border border-rose-400/30 bg-rose-400/10 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Current salary strip */}
      {currentSalary && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">{tr("compensation.currentSalary", "Salaire actuel")}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {formatSalaryLocal(locale, currentSalary.new_salary)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {tr("compensation.effectiveSince", "En vigueur depuis {{date}}", { date: new Date(currentSalary.effective_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US") })}
            </p>
          </div>
          {pendingReview && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-400 font-semibold">{tr("compensation.reviewInProgress", "Révision en cours")}</span>
            </div>
          )}
        </div>
      )}

      {/* New review form */}
      {showForm && (
        <div className="bg-[var(--bg-surface)] border border-[var(--accent)]/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{tr("compensation.newReviewTitle", "Nouvelle révision salariale")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder={tr("compensation.previousSalary", "Salaire précédent (ex: 45000)")}
              className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              value={form.previous_salary}
              onChange={e => setForm(p => ({ ...p, previous_salary: e.target.value }))}
            />
            <input
              type="number"
              placeholder={tr("compensation.newSalary", "Nouveau salaire (ex: 50000) *")}
              className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              value={form.new_salary}
              onChange={e => setForm(p => ({ ...p, new_salary: e.target.value }))}
            />
            <input
              type="date"
              className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              value={form.effective_date}
              onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))}
            />
            <select
              className="px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              value={form.change_reason}
              onChange={e => setForm(p => ({ ...p, change_reason: e.target.value }))}
            >
              {REASON_KEYS.map((v) => (
                <option key={v} value={v}>{tr(`compensation.reason.${v}`, v)}</option>
              ))}
            </select>
            <textarea
              placeholder={tr("compensation.notesPlaceholder", "Notes (optionnel)")}
              rows={2}
              className="col-span-2 px-3 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              {tr("compensation.cancel", "Annuler")}
            </button>
            <button onClick={handleCreate} disabled={!form.new_salary || !form.effective_date || submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {tr("compensation.createReview", "Créer révision")}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl">
          <DollarSign className="w-12 h-12 text-[var(--text-muted)]" style={{ opacity: 0.3 }} />
          <div className="text-center">
            <p className="font-bold text-[var(--text-primary)]">{tr("compensation.noHistory", "Aucun historique")}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{tr("compensation.noHistoryHint", "Créez la première révision salariale")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(review => {
            const cfg = STATUS_CONFIG[review.status] ?? STATUS_CONFIG.draft;
            const StatusIcon = cfg.icon;
            const isPositive = (review.change_pct ?? 0) >= 0;
            const canAdvance = ["draft", "submitted", "hr_approved", "finance_approved", "ceo_approved"].includes(review.status);
            return (
              <div key={review.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--bg-raised)] flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {formatSalaryLocal(locale, review.new_salary)}
                    </p>
                    {review.previous_salary && (
                      <span className="text-xs text-[var(--text-muted)]">
                        {tr("compensation.was", "(était {{amount}})", { amount: formatSalaryLocal(locale, review.previous_salary) })}
                      </span>
                    )}
                    {review.change_pct != null && (
                      <span className={`flex items-center gap-0.5 text-xs font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isPositive ? "+" : ""}{review.change_pct}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-[var(--text-muted)]">
                    <span>{new Date(review.effective_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}</span>
                    {review.change_reason && <span>· {tr(`compensation.reason.${review.change_reason}`, review.change_reason)}</span>}
                    {review.notes && <span className="truncate max-w-[200px]" title={review.notes}>· {review.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {tr(`compensation.status.${review.status}`, review.status)}
                  </span>
                  {canAdvance && (
                    <button
                      onClick={() => handleAdvance(review)}
                      disabled={advancing === review.id}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                    >
                      {advancing === review.id ? <Loader2 className="w-3 h-3 animate-spin" /> : tr("compensation.advance", "Avancer →")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
