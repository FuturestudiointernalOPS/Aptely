"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, Briefcase, Building2, Calendar,
  Edit2, Save, X, ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, CheckCircle2,
} from "lucide-react";
import { apiFetch, isApiSuccess } from "@/lib/apiHelper";
import { ROUTES, employeeApiPath, employeeOffboardPath, employeeLeaveRequestsApi, employeeReviewsApi, employeeReviewApi, employeeReviewAckApi, appPath, employeeLearningPath, employeeCompensationPath } from "@/lib/routes";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientLocale, t } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { CURRENCIES } from "@/lib/currencies";

type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED";
type EmploymentType = "CDI" | "CDD" | "FREELANCE" | "INTERNSHIP" | "PART_TIME";

interface EmployeeDetail {
  id: string;
  user_id: string;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  start_date: string;
  end_date: string | null;
  salary_amount: number | null;
  salary_currency: string;
  contract_notes: string | null;
  application_id: string | null;
  profiles: { id: string; full_name: string; email: string; avatar_url: string | null } | null;
  job_positions: { id: string; title: string; department_id: string | null } | null;
  departments: { id: string; name: string } | null;
  manager: { id: string; full_name: string; avatar_url: string | null } | null;
}

const STATUS_STYLES: Record<EmploymentStatus, string> = {
  ACTIVE:     "bg-green-500/15 text-green-400",
  ON_LEAVE:   "bg-yellow-500/15 text-yellow-400",
  SUSPENDED:  "bg-red-500/15 text-red-400",
  TERMINATED: "bg-[var(--bg-raised)] text-[var(--text-muted)]",
};

const STATUS_KEYS: Record<EmploymentStatus, string> = {
  ACTIVE: "ACTIVE", ON_LEAVE: "ON_LEAVE", SUSPENDED: "SUSPENDED", TERMINATED: "TERMINATED",
};

const TYPE_KEYS: Record<EmploymentType, string> = {
  CDI: "CDI", CDD: "CDD", FREELANCE: "FREELANCE", INTERNSHIP: "INTERNSHIP", PART_TIME: "PART_TIME",
};

export default function EmployeeProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const locale = getClientLocale();
  const tr = (k: string, fb: string, params?: Record<string, string | number>) => t(locale, k, fb, params);
  const router = useRouter();
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission("employees.manage");
  const { user } = useAuth();
  const isOwnProfile = user?.userId === userId;

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState<{
    employment_type: EmploymentType;
    employment_status: EmploymentStatus;
    salary_amount: string;
    salary_currency: string;
    contract_notes: string;
  } | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<Array<{
    id: string; leave_type: string; start_date: string; end_date: string;
    days_count: number; status: string; review_note: string | null;
  }>>([]);
  const [reviews, setReviews] = useState<Array<{
    id: string; period: string; year: number; overall_rating: number | null;
    status: string; submitted_at: string | null; created_at: string;
    strengths: string | null; improvements: string | null; goals_next_period: string | null;
    reviewer: { id: string; full_name: string } | null;
  }>>([]);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ period: "ANNUAL", year: new Date().getFullYear(), overall_rating: 0, strengths: "", improvements: "", goals_next_period: "" });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [ackingReview, setAckingReview] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadLeave();
    void loadReviews();
  }, [userId]);

  async function loadLeave() {
    try {
      const res = await apiFetch(employeeLeaveRequestsApi(userId), "HR") as
        Array<{ id: string; leave_type: string; start_date: string; end_date: string; days_count: number; status: string; review_note: string | null }> | null;
      setLeaveRequests(res ?? []);
    } catch { /* silent */ }
  }

  async function loadReviews() {
    try {
      const res = await apiFetch(employeeReviewsApi(userId), "HR") as
        Array<{ id: string; period: string; year: number; overall_rating: number | null; status: string; submitted_at: string | null; created_at: string; strengths: string | null; improvements: string | null; goals_next_period: string | null; reviewer: { id: string; full_name: string } | null }> | null;
      setReviews(res ?? []);
    } catch { /* silent */ }
  }

  async function handleCreateReview(e: React.FormEvent, submitNow = false) {
    e.preventDefault();
    setReviewSaving(true);
    try {
      const created = await apiFetch(employeeReviewsApi(userId), "HR", {
        method: "POST",
        body: JSON.stringify({
          period: reviewForm.period,
          year: reviewForm.year,
          overall_rating: reviewForm.overall_rating > 0 ? reviewForm.overall_rating : null,
          strengths: reviewForm.strengths || null,
          improvements: reviewForm.improvements || null,
          goals_next_period: reviewForm.goals_next_period || null,
        }),
      }) as { id?: string } | null;
      if (submitNow && created?.id) {
        await apiFetch(employeeReviewApi(userId, created.id), "HR", {
          method: "PATCH", body: JSON.stringify({ status: "SUBMITTED" }),
        });
      }
      setReviewModal(false);
      setReviewForm({ period: "ANNUAL", year: new Date().getFullYear(), overall_rating: 0, strengths: "", improvements: "", goals_next_period: "" });
      void loadReviews();
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleAcknowledge(reviewId: string) {
    setAckingReview(reviewId);
    try {
      await apiFetch(employeeReviewAckApi(userId, reviewId), "HR", { method: "PATCH" });
      void loadReviews();
    } finally {
      setAckingReview(null);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch(employeeApiPath(userId), "HR") as EmployeeDetail | null;
      if (isApiSuccess(res) && res) {
        setEmployee(res);
        setEditFields({
          employment_type: res.employment_type,
          employment_status: res.employment_status,
          salary_amount: res.salary_amount?.toString() ?? "",
          salary_currency: res.salary_currency ?? "EUR",
          contract_notes: res.contract_notes ?? "",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editFields || !employee) return;
    setSaving(true);
    try {
      await apiFetch(employeeApiPath(userId), "HR", {
        method: "PATCH",
        body: JSON.stringify({
          employment_type: editFields.employment_type,
          employment_status: editFields.employment_status,
          salary_amount: editFields.salary_amount ? parseFloat(editFields.salary_amount) : null,
          salary_currency: editFields.salary_currency,
          contract_notes: editFields.contract_notes || null,
        }),
      });
      await load();
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-[var(--bg-raised)] rounded animate-pulse" />
        <div className="h-40 bg-[var(--bg-raised)] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-12 text-center">
        <p className="text-[var(--text-muted)]">{tr("hr.employees.detail.notFound", "Employé introuvable.")}</p>
        <Link href={ROUTES.company.hr.root} className="text-[var(--accent)] text-sm mt-2 block">
          {tr("hr.employees.detail.backToEmployees", "← Retour aux employés")}
        </Link>
      </div>
    );
  }

  const profile = employee.profiles;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(ROUTES.company.hr.root)}
          className="p-2 rounded-lg hover:bg-[var(--bg-raised)] text-[var(--text-muted)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <PageHeader
          title={profile?.full_name ?? tr("hr.employees.detail.defaultName", "Employé")}
          subtitle={employee.job_positions?.title ?? tr("hr.employees.detail.noPosition", "Aucun poste assigné")}
        />
        {canManage && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            {tr("hr.employees.detail.edit", "Modifier")}
          </button>
        )}
        {editing && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { setEditing(false); setEditFields({ employment_type: employee.employment_type, employment_status: employee.employment_status, salary_amount: employee.salary_amount?.toString() ?? "", salary_currency: employee.salary_currency, contract_notes: employee.contract_notes ?? "" }); }}
              className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-raised)] transition-colors"
            >
              <X className="w-3.5 h-3.5" /> {tr("common.cancel", "Annuler")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? tr("common.saving", "Enregistrement...") : tr("hr.employees.detail.save", "Enregistrer")}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — identity */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 text-center space-y-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover mx-auto" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-2xl font-bold text-[var(--accent)] mx-auto">
                {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{profile?.full_name}</p>
              <p className="text-sm text-[var(--text-muted)]">{profile?.email}</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[employee.employment_status]}`}>
              {tr(`hr.employees.status.${STATUS_KEYS[employee.employment_status]}`, employee.employment_status)}
            </span>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{tr("hr.employees.detail.organisation", "Organisation")}</p>
            <div className="space-y-2.5">
              <InfoRow icon={<Briefcase className="w-4 h-4" />} label={tr("hr.employees.col.position", "Poste")} value={employee.job_positions?.title ?? "—"} />
              <InfoRow icon={<Building2 className="w-4 h-4" />} label={tr("hr.employees.col.department", "Département")} value={employee.departments?.name ?? "—"} />
              <InfoRow icon={<User className="w-4 h-4" />} label={tr("hr.employees.detail.manager", "Manager")} value={employee.manager?.full_name ?? "—"} />
            </div>
          </div>
        </div>

        {/* Right — contract details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{tr("hr.employees.detail.contract", "Contrat")}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">{tr("hr.employees.detail.contractType", "Type de contrat")}</label>
                {editing && editFields ? (
                  <select
                    value={editFields.employment_type}
                    onChange={(e) => setEditFields({ ...editFields, employment_type: e.target.value as EmploymentType })}
                    className="w-full px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    {Object.entries(TYPE_KEYS).map(([v, k]) => <option key={v} value={v}>{tr(`hr.employees.type.${k}`, v)}</option>)}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-[var(--text-primary)]">{tr(`hr.employees.type.${TYPE_KEYS[employee.employment_type]}`, employee.employment_type)}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">{tr("hr.employees.detail.status", "Statut")}</label>
                {editing && editFields ? (
                  <select
                    value={editFields.employment_status}
                    onChange={(e) => setEditFields({ ...editFields, employment_status: e.target.value as EmploymentStatus })}
                    className="w-full px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="ACTIVE">{tr("hr.employees.status.ACTIVE", "Actif")}</option>
                    <option value="ON_LEAVE">{tr("hr.employees.status.ON_LEAVE", "En congé")}</option>
                    <option value="SUSPENDED">{tr("hr.employees.status.SUSPENDED", "Suspendu")}</option>
                    <option value="TERMINATED">{tr("hr.employees.status.TERMINATED", "Parti")}</option>
                  </select>
                ) : (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[employee.employment_status]}`}>
                    {tr(`hr.employees.status.${STATUS_KEYS[employee.employment_status]}`, employee.employment_status)}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">{tr("hr.employees.detail.startDate", "Date de début")}</label>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {new Date(employee.start_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              {employee.end_date && (
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">{tr("hr.employees.detail.endDate", "Date de fin")}</label>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {new Date(employee.end_date).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">{tr("hr.employees.detail.grossSalary", "Salaire brut")}</label>
                {editing && editFields ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editFields.salary_amount}
                      onChange={(e) => setEditFields({ ...editFields, salary_amount: e.target.value })}
                      placeholder={tr("hr.employees.detail.salaryPlaceholder", "Ex: 45000")}
                      className="flex-1 px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <select
                      value={editFields.salary_currency}
                      onChange={(e) => setEditFields({ ...editFields, salary_currency: e.target.value })}
                      className="w-24 px-2 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {employee.salary_amount
                      ? tr("hr.employees.detail.salaryPerYear", "{{amount}} {{currency}}/an", { amount: employee.salary_amount.toLocaleString(locale === "fr" ? "fr-FR" : "en-US"), currency: employee.salary_currency })
                      : "—"}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">{tr("hr.employees.detail.contractNotes", "Notes de contrat")}</label>
              {editing && editFields ? (
                <textarea
                  value={editFields.contract_notes}
                  onChange={(e) => setEditFields({ ...editFields, contract_notes: e.target.value })}
                  rows={3}
                  placeholder={tr("hr.employees.detail.contractNotesPlaceholder", "Informations complémentaires...")}
                  className="w-full px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">{employee.contract_notes || "—"}</p>
              )}
            </div>
          </div>

          {employee.application_id && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">{tr("hr.employees.detail.recruitment", "Recrutement")}</p>
              <Link
                href={appPath(employee.application_id)}
                className="text-sm text-[var(--accent)] hover:underline"
              >
                {tr("hr.employees.detail.viewApplication", "Voir la candidature d'origine →")}
              </Link>
            </div>
          )}

          {/* Leave history */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t(locale, "leave.title", "Congés")}
              </p>
            </div>
            {leaveRequests.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--text-muted)]">
                {t(locale, "leave.requests.empty", "Aucune demande")}
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {leaveRequests.slice(0, 5).map((lr) => (
                  <div key={lr.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm text-[var(--text-primary)]">
                        {t(locale, `leave.type.${lr.leave_type}`, lr.leave_type)}
                        {" · "}{lr.days_count}j
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{lr.start_date} → {lr.end_date}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      lr.status === "APPROVED"  ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                      lr.status === "REJECTED"  ? "bg-red-400/10 text-red-400 border-red-400/30" :
                      lr.status === "PENDING"   ? "bg-amber-400/10 text-amber-400 border-amber-400/30" :
                      "bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border)]"
                    }`}>
                      {t(locale, `leave.request.${lr.status.toLowerCase()}`, lr.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance reviews */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t(locale, "perf.title", "Évaluations")}
              </p>
              {canManage && (
                <button type="button" onClick={() => setReviewModal(true)}
                  className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity">
                  + {t(locale, "perf.add", "Nouvelle évaluation")}
                </button>
              )}
            </div>
            {reviews.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--text-muted)]">
                {t(locale, "perf.empty", "Aucune évaluation")}
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {reviews.map((rev, idx) => {
                  const prev = reviews[idx + 1];
                  const trend = rev.overall_rating != null && prev?.overall_rating != null
                    ? rev.overall_rating - prev.overall_rating : null;
                  const expanded = expandedReview === rev.id;
                  return (
                    <div key={rev.id}>
                      <button type="button" onClick={() => setExpandedReview(expanded ? null : rev.id)}
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-raised)] transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {t(locale, `perf.period.${rev.period}`, rev.period)} {rev.year}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {rev.overall_rating != null && (
                                <span className="text-xs text-[var(--accent)]">
                                  {"★".repeat(rev.overall_rating)}{"☆".repeat(5 - rev.overall_rating)}
                                </span>
                              )}
                              {trend !== null && trend !== 0 && (
                                <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {trend > 0 ? "+" : ""}{trend}
                                </span>
                              )}
                              {rev.reviewer && (
                                <p className="text-xs text-[var(--text-muted)]">{rev.reviewer.full_name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            rev.status === "ACKNOWLEDGED" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                            rev.status === "SUBMITTED"    ? "bg-sky-400/10 text-sky-400 border-sky-400/30" :
                            "bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border)]"
                          }`}>
                            {t(locale, `perf.status.${rev.status}`, rev.status)}
                          </span>
                          {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-5 pb-4 space-y-3 bg-[var(--bg-raised)]">
                          {rev.strengths && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">{t(locale, "perf.strengths", "Points forts")}</p>
                              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{rev.strengths}</p>
                            </div>
                          )}
                          {rev.improvements && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">{t(locale, "perf.improvements", "Axes d'amélioration")}</p>
                              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{rev.improvements}</p>
                            </div>
                          )}
                          {rev.goals_next_period && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-1">{t(locale, "perf.goals", "Objectifs prochaine période")}</p>
                              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{rev.goals_next_period}</p>
                            </div>
                          )}
                          {rev.status === "SUBMITTED" && isOwnProfile && (
                            <button type="button" onClick={() => handleAcknowledge(rev.id)} disabled={ackingReview === rev.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-400/20 transition-colors disabled:opacity-50">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t(locale, "perf.acknowledge", "Accuser réception")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Phase 4 modules quick nav */}
          {canManage && (
            <div className="grid grid-cols-2 gap-3">
              <Link href={employeeLearningPath(userId as string)}
                className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors group">
                <span className="text-xl">📚</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Learning & Dev</p>
                  <p className="text-xs text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">{t(locale, "hr.employees.quickNav.learningHint", "Plan L&D →")}</p>
                </div>
              </Link>
              <Link href={employeeCompensationPath(userId as string)}
                className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors group">
                <span className="text-xl">💰</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{t(locale, "hr.employees.quickNav.compensation", "Rémunération")}</p>
                  <p className="text-xs text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">{t(locale, "hr.employees.quickNav.compensationHint", "Historique →")}</p>
                </div>
              </Link>
            </div>
          )}
          {/* Offboarding */}
          {canManage && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {t(locale, "offboard.title", "Offboarding")}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t(locale, "offboard.subtitle", "Gérez le départ de cet employé")}
                </p>
              </div>
              <Link
                href={employeeOffboardPath(userId as string)}
                className="px-4 py-2 rounded-lg text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                {t(locale, "offboard.open", "Ouvrir →")}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Review create modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setReviewModal(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5">
              {t(locale, "perf.add", "Nouvelle évaluation")}
            </h3>
            <form onSubmit={(e) => void handleCreateReview(e, false)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, "perf.period.label", "Période")}</label>
                  <select value={reviewForm.period}
                    onChange={(e) => setReviewForm({ ...reviewForm, period: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]">
                    {["Q1","Q2","Q3","Q4","ANNUAL","PROBATION"].map((p) => (
                      <option key={p} value={p}>{t(locale, `perf.period.${p}`, p)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, "perf.year", "Année")}</label>
                  <input type="number" min={2020} max={2100} value={reviewForm.year}
                    onChange={(e) => setReviewForm({ ...reviewForm, year: Number(e.target.value) })}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              {/* Star rating */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  {t(locale, "perf.rating", "Note globale")}
                </label>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((star) => (
                    <button key={star} type="button"
                      onClick={() => setReviewForm({ ...reviewForm, overall_rating: star === reviewForm.overall_rating ? 0 : star })}
                      className="transition-transform hover:scale-110">
                      <Star className={`w-7 h-7 ${star <= reviewForm.overall_rating ? "fill-[var(--accent)] text-[var(--accent)]" : "text-[var(--border)]"}`} />
                    </button>
                  ))}
                  {reviewForm.overall_rating > 0 && (
                    <span className="ml-2 text-sm font-semibold text-[var(--accent)]">{reviewForm.overall_rating}/5</span>
                  )}
                </div>
              </div>
              {(["strengths","improvements","goals_next_period"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {t(locale, field === "strengths" ? "perf.strengths" : field === "improvements" ? "perf.improvements" : "perf.goals",
                       field === "strengths" ? "Points forts" : field === "improvements" ? "Axes d'amélioration" : "Objectifs prochaine période")}
                  </label>
                  <textarea rows={2} value={reviewForm[field]}
                    onChange={(e) => setReviewForm({ ...reviewForm, [field]: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none" />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReviewModal(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  {t(locale, "perf.cancel", "Annuler")}
                </button>
                <button type="submit" disabled={reviewSaving}
                  className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
                  {t(locale, "perf.saveDraft", "Brouillon")}
                </button>
                <button type="button" disabled={reviewSaving} onClick={(e) => { e.preventDefault(); void handleCreateReview(e as unknown as React.FormEvent, true); }}
                  className="px-4 py-2 rounded-lg text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                  {t(locale, "perf.submit", "Soumettre")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm text-[var(--text-primary)] truncate">{value}</p>
      </div>
    </div>
  );
}
