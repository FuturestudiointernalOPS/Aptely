"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { useRequireInstitution } from "@/lib/auth";
import { ROUTES, goalsApi, goalKrsApi, goalTasksApi, goalRolesApi, goalLaunchApi, goalCommitApi, goalValidateApi, goalPath, institutionMembersApi } from "@/lib/routes";
import { Target, Plus, X, Check, Copy, ChevronLeft, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KR { id: string; description: string; kpi: string; targetValue: string; dbId?: string }
interface Task { id: string; title: string; ownerId: string; keyResultId: string; startDate: string; dueDate: string }
interface RoleAssignment { userId: string; role: PaciRole; focusArea: string }
type PaciRole = "pilote" | "approbateur" | "contributeur" | "informe";
interface Member { id: string; full_name: string | null; email: string }

const PACI_ROLES: PaciRole[] = ["pilote", "approbateur", "contributeur", "informe"];
const PACI_COLORS: Record<PaciRole, string> = {
  pilote:      "bg-[var(--accent)] text-white",
  approbateur: "bg-sky-500 text-white",
  contributeur:"bg-emerald-500 text-white",
  informe:     "bg-[var(--text-muted)] text-white",
};
const PACI_LABELS: Record<PaciRole, string> = {
  pilote:      "Pilote",
  approbateur: "Approbateur",
  contributeur:"Contributeur",
  informe:     "Informé",
};

const ICEBREAKERS = [
  { key: "energy", emoji: "⚡", fr: "Check d'énergie", en: "Energy Check" },
  { key: "word",   emoji: "💬", fr: "En un mot",       en: "One Word" },
  { key: "weather",emoji: "☀️",  fr: "Météo",          en: "Weather" },
  { key: "animal", emoji: "🦁", fr: "Animal totem",    en: "Spirit Animal" },
  { key: "2truths",emoji: "🎭", fr: "2 vérités 1 mensonge", en: "2 Truths & a Lie" },
];

function uid() { return Math.random().toString(36).slice(2); }

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function GoalWizardPage() {
  useRequireInstitution();
  const router = useRouter();
  const locale = getClientLocale();
  const tr = (k: string, fb: string) => t(locale, k, fb);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);

  // Step 1 state
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"company" | "team" | "individual">("company");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [icebreaker, setIcebreaker] = useState("");

  // Step 2 state
  const [krs, setKrs] = useState<KR[]>([{ id: uid(), description: "", kpi: "", targetValue: "" }]);

  // Step 3 state
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<RoleAssignment[]>([]);

  // Step 4 state
  const [tasks, setTasks] = useState<Task[]>([{ id: uid(), title: "", ownerId: "", keyResultId: "", startDate: "", dueDate: "" }]);

  // Step 5 state
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    apiFetch(institutionMembersApi, "HR").then((res: any) => {
      const list = Array.isArray(res) ? res : res?.data ?? [];
      setMembers(list.map((m: any) => ({ id: m.profiles?.id || m.user_id, full_name: m.profiles?.full_name, email: m.profiles?.email })));
    });
  }, []);

  const goNext = async () => {
    setError(null);
    if (step === 1) {
      if (!name.trim()) { setError(tr("wizard.error.name", "Nom requis")); return; }
      if (!objective.trim()) { setError(tr("wizard.error.obj", "Objectif requis")); return; }
      setSaving(true);
      const res = await apiFetch(goalsApi, "HR", { method: "POST", body: JSON.stringify({ name, objective, description, scope, start_date: startDate || null, due_date: dueDate || null, icebreaker_theme: icebreaker || null }) }) as any;
      setSaving(false);
      if (!res?.id) { setError(tr("wizard.error.save", "Erreur de sauvegarde")); return; }
      setGoalId(res.id);
    }
    if (step === 2 && goalId) {
      const valid = krs.filter(k => k.description.trim() && k.kpi.trim());
      if (!valid.length) { setError(tr("wizard.error.kr", "Au moins 1 KR requis")); return; }
      setSaving(true);
      const saved = await Promise.all(valid.map(kr =>
        apiFetch(goalKrsApi(goalId), "HR", { method: "POST", body: JSON.stringify({ description: kr.description, kpi: kr.kpi, target_value: kr.targetValue || null, sort_order: valid.indexOf(kr) }) }) as Promise<{ id: string } | null>
      ));
      setSaving(false);
      setKrs(valid.map((kr, i) => ({ ...kr, dbId: (saved[i] as any)?.id })));
    }
    if (step === 3 && goalId) {
      setSaving(true);
      await Promise.all(roles.map(ra =>
        apiFetch(goalRolesApi(goalId), "HR", { method: "POST", body: JSON.stringify({ user_id: ra.userId, role: ra.role, focus_area: ra.focusArea || null }) })
      ));
      setSaving(false);
    }
    if (step === 4 && goalId) {
      const valid = tasks.filter(tk => tk.title.trim());
      if (valid.length) {
        setSaving(true);
        await Promise.all(valid.map(tk =>
          apiFetch(goalTasksApi(goalId), "HR", { method: "POST", body: JSON.stringify({ title: tk.title, owner_id: tk.ownerId || null, key_result_id: tk.keyResultId || null, start_date: tk.startDate || null, due_date: tk.dueDate || null }) })
        ));
        setSaving(false);
      }
      // Launch
      setSaving(true);
      const launch = await apiFetch(goalLaunchApi(goalId), "HR", { method: "POST" }) as any;
      setSaving(false);
      setSessionCode(launch?.data?.session_code ?? launch?.session_code ?? null);
    }
    if (step < 5) setStep(s => s + 1);
  };

  const inputCls = "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]/50";

  const stepLabels = [
    tr("wizard.step1.label", "Définition"),
    tr("wizard.step2.label", "Key Results"),
    tr("wizard.step3.label", "Rôles PACI"),
    tr("wizard.step4.label", "Tâches"),
    tr("wizard.step5.label", "Lancement"),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-deep)]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)]">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push(ROUTES.company.goals)}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft className="w-4 h-4" />
          {step === 1 ? tr("wizard.cancel", "Annuler") : tr("wizard.back", "Retour")}
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {[1,2,3,4,5].map(i => (
            <div key={i} className={`h-1.5 w-10 rounded-full transition-all ${i <= step ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
          ))}
        </div>

        <div className="text-xs text-[var(--text-muted)] font-semibold">
          {step}/5 · {stepLabels[step - 1]}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-8">
        <div className="mx-auto max-w-[680px] space-y-6">
          {error && (
            <div className="px-4 py-2.5 rounded-xl border border-rose-400/30 bg-rose-400/10 text-rose-400 text-sm flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in-up">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{tr("wizard.step1.title", "Définir le goal")}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">{tr("wizard.step1.sub", "Nom, objectif, périmètre et dates")}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{tr("wizard.step1.name", "Nom du goal")} <span className="text-rose-400">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={tr("wizard.step1.namePh", "ex: Q3 2026 — Croissance produit")} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{tr("wizard.step1.obj", "Objectif")} <span className="text-rose-400">*</span></label>
                <textarea rows={3} value={objective} onChange={e => setObjective(e.target.value.slice(0, 300))} placeholder={tr("wizard.step1.objPh", "Décrivez le résultat attendu en 1-2 phrases")} className={`${inputCls} resize-none`} />
                <p className="text-right text-[10px] text-[var(--text-muted)] mt-0.5">{objective.length}/300</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{tr("wizard.step1.scope", "Périmètre")}</label>
                <div className="flex gap-2">
                  {(["company","team","individual"] as const).map(s => (
                    <button key={s} type="button" onClick={() => setScope(s)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${scope === s ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"}`}>
                      {s === "company" ? "🏢 " + tr("goals.scope.company", "Entreprise") : s === "team" ? "👥 " + tr("goals.scope.team", "Équipe") : "👤 " + tr("goals.scope.individual", "Individuel")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{tr("wizard.step1.start", "Début")}</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{tr("wizard.step1.due", "Échéance")}</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">{tr("wizard.step1.icebreaker", "Icebreaker session (optionnel)")}</label>
                <div className="flex flex-wrap gap-2">
                  {ICEBREAKERS.map(ib => (
                    <button key={ib.key} type="button" onClick={() => setIcebreaker(ib.key === icebreaker ? "" : ib.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${icebreaker === ib.key ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"}`}>
                      {ib.emoji} {locale === "fr" ? ib.fr : ib.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 — KEY RESULTS ── */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in-up">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{tr("wizard.step2.title", "Key Results")}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">{tr("wizard.step2.sub", "Définir les indicateurs mesurables (max 6)")}</p>
              </div>
              <div className="space-y-4">
                {krs.map((kr, i) => (
                  <div key={kr.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">KR {i + 1}</span>
                      {krs.length > 1 && (
                        <button type="button" onClick={() => setKrs(k => k.filter(x => x.id !== kr.id))}
                          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-rose-400 transition-colors">
                          <X className="w-3.5 h-3.5" /> {tr("wizard.remove", "Retirer")}
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{tr("wizard.step2.desc", "Description")} *</label>
                      <input value={kr.description} onChange={e => setKrs(k => k.map(x => x.id === kr.id ? { ...x, description: e.target.value } : x))} placeholder={tr("wizard.step2.descPh", "ex: Augmenter le nombre d'utilisateurs actifs")} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{tr("wizard.step2.kpi", "KPI")} *</label>
                        <input value={kr.kpi} onChange={e => setKrs(k => k.map(x => x.id === kr.id ? { ...x, kpi: e.target.value } : x))} placeholder="WAU, NPS, MRR..." className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{tr("wizard.step2.target", "Cible")}</label>
                        <input value={kr.targetValue} onChange={e => setKrs(k => k.map(x => x.id === kr.id ? { ...x, targetValue: e.target.value } : x))} placeholder="1000, 90%, +25%" className={inputCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {krs.length < 6 && (
                <button type="button" onClick={() => setKrs(k => [...k, { id: uid(), description: "", kpi: "", targetValue: "" }])}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all">
                  <Plus className="w-4 h-4" /> {tr("wizard.step2.add", "Ajouter un KR")}
                </button>
              )}
            </div>
          )}

          {/* ── STEP 3 — PACI ROLES ── */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in-up">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{tr("wizard.step3.title", "Rôles PACI")}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">{tr("wizard.step3.sub", "Pilote · Approbateur · Contributeur · Informé")}</p>
              </div>
              {members.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-6 text-center">{tr("wizard.step3.noMembers", "Aucun membre trouvé")}</p>
              ) : (
                <div className="space-y-3">
                  {members.map(m => {
                    const memberRoles = roles.filter(r => r.userId === m.id);
                    return (
                      <div key={m.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)] flex-shrink-0">
                            {(m.full_name || m.email || "?").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-[var(--text-primary)] flex-1">{m.full_name || m.email}</span>
                          <div className="flex gap-1 flex-wrap">
                            {PACI_ROLES.map(role => {
                              const active = roles.some(r => r.userId === m.id && r.role === role);
                              return (
                                <button key={role} type="button"
                                  onClick={() => setRoles(prev => active ? prev.filter(r => !(r.userId === m.id && r.role === role)) : [...prev, { userId: m.id, role, focusArea: "" }])}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${active ? PACI_COLORS[role] : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"}`}>
                                  {PACI_LABELS[role]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {memberRoles.length > 0 && (
                          <div className="mt-3 pl-12 space-y-2">
                            {memberRoles.map(ra => (
                              <div key={`${ra.userId}-${ra.role}`}>
                                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">{PACI_LABELS[ra.role]} — focus</label>
                                <input value={ra.focusArea} onChange={e => setRoles(prev => prev.map(r => r.userId === ra.userId && r.role === ra.role ? { ...r, focusArea: e.target.value } : r))}
                                  placeholder={tr("wizard.step3.focusPh", "Zone de focus (optionnel)")}
                                  className={`${inputCls} py-1.5 text-[11px]`} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4 — TASKS ── */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-in-up">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{tr("wizard.step4.title", "Tâches")}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">{tr("wizard.step4.sub", "Actions concrètes liées aux KRs")}</p>
              </div>
              <div className="space-y-4">
                {tasks.map((task, i) => (
                  <div key={task.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">{tr("wizard.step4.task", "Tâche")} {i + 1}</span>
                      {tasks.length > 1 && (
                        <button type="button" onClick={() => setTasks(ts => ts.filter(x => x.id !== task.id))}
                          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-rose-400">
                          <X className="w-3.5 h-3.5" /> {tr("wizard.remove", "Retirer")}
                        </button>
                      )}
                    </div>
                    <input value={task.title} onChange={e => setTasks(ts => ts.map(x => x.id === task.id ? { ...x, title: e.target.value } : x))}
                      placeholder={tr("wizard.step4.titlePh", "Titre de la tâche *")} className={inputCls} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">{tr("wizard.step4.owner", "Responsable")}</label>
                        <select value={task.ownerId} onChange={e => setTasks(ts => ts.map(x => x.id === task.id ? { ...x, ownerId: e.target.value } : x))} className={inputCls}>
                          <option value="">—</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">{tr("wizard.step4.kr", "KR lié")}</label>
                        <select value={task.keyResultId} onChange={e => setTasks(ts => ts.map(x => x.id === task.id ? { ...x, keyResultId: e.target.value } : x))} className={inputCls}>
                          <option value="">—</option>
                          {krs.filter(k => k.description).map((k, ki) => <option key={k.dbId || k.id} value={k.dbId || k.id}>KR{ki+1}: {k.description.slice(0, 30)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">{tr("wizard.step4.start", "Début")}</label>
                        <input type="date" value={task.startDate} onChange={e => setTasks(ts => ts.map(x => x.id === task.id ? { ...x, startDate: e.target.value } : x))} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">{tr("wizard.step4.due", "Échéance")}</label>
                        <input type="date" value={task.dueDate} onChange={e => setTasks(ts => ts.map(x => x.id === task.id ? { ...x, dueDate: e.target.value } : x))} className={inputCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setTasks(ts => [...ts, { id: uid(), title: "", ownerId: "", keyResultId: "", startDate: "", dueDate: "" }])}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all">
                <Plus className="w-4 h-4" /> {tr("wizard.step4.add", "Ajouter une tâche")}
              </button>
            </div>
          )}

          {/* ── STEP 5 — LAUNCH ── */}
          {step === 5 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{tr("wizard.step5.title", "Goal lancé ! 🚀")}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">{tr("wizard.step5.sub", "Partagez le code de session avec votre équipe")}</p>
              </div>

              {/* Summary */}
              <div className="rounded-2xl bg-[var(--accent-dim)] p-5">
                <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider mb-1">{tr("wizard.step5.goal", "Goal")}</p>
                <p className="text-[var(--text-primary)] font-bold text-lg">{name}</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">{objective}</p>
              </div>

              {/* KRs summary */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider mb-3">{tr("wizard.step5.krs", "Key Results")}</p>
                <div className="space-y-2">
                  {krs.filter(k => k.description).map((k, i) => (
                    <div key={k.id} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-raised)]">
                      <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{k.description}</p>
                        <p className="text-xs text-[var(--text-muted)]">{k.kpi}{k.targetValue && ` · ${k.targetValue}`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Session code */}
              {sessionCode && (
                <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">{tr("wizard.step5.code", "Code de session")}</p>
                  <div className="flex items-center justify-center gap-4">
                    <span className="font-mono text-4xl font-bold tracking-widest text-[var(--accent)]">{sessionCode}</span>
                    <button onClick={async () => { await navigator.clipboard.writeText(sessionCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                      className="p-2 rounded-lg border border-[var(--accent)]/30 hover:bg-[var(--accent-dim)] transition-colors">
                      {codeCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[var(--text-muted)]" />}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">{tr("wizard.step5.shareCode", "Partagez ce code pour rejoindre la session")}</p>
                </div>
              )}

              <button onClick={() => goalId && router.push(goalPath(goalId))}
                className="w-full py-3.5 rounded-xl bg-[var(--accent)] text-white font-bold hover:opacity-90 transition-opacity">
                {tr("wizard.step5.open", "Ouvrir le goal →")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      {step < 5 && (
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">Étape {step} sur 5</span>
          <button onClick={goNext} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {step === 4 ? tr("wizard.launch", "Lancer le goal") : tr("wizard.next", "Continuer →")}
          </button>
        </div>
      )}
    </div>
  );
}
