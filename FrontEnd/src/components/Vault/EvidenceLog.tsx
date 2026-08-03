"use client";

import { useState } from "react";
import { Plus, Trash2, BookOpen, Star } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { vaultMyEvidenceApi } from "@/lib/routes";

export interface WorkEvidenceItem {
  id: string;
  title: string;
  problem: string;
  tools: string[];
  result: string;
  impact_score?: number | null;
  created_at: string;
}

interface EvidenceLogProps {
  items: WorkEvidenceItem[];
  skillProofId?: string;
  onAdded: (item: WorkEvidenceItem) => void;
  onDeleted: (id: string) => void;
}


export function EvidenceLog({ items, skillProofId, onAdded, onDeleted }: EvidenceLogProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const IMPACT_LABELS: Record<number, string> = {
    1: tr("evidenceLog.impact.1", "Minor"),
    2: tr("evidenceLog.impact.2", "Low"),
    3: tr("evidenceLog.impact.3", "Medium"),
    4: tr("evidenceLog.impact.4", "High"),
    5: tr("evidenceLog.impact.5", "Critical"),
  };
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", problem: "", tools: "", result: "", impact_score: 3 });

  const handleAdd = async () => {
    if (!form.title || !form.problem || !form.result) return;
    setSaving(true);
    const res = await apiFetch(vaultMyEvidenceApi, "HR", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skill_proof_id: skillProofId ?? undefined,
        title: form.title,
        problem: form.problem,
        tools: form.tools.split(",").map((t) => t.trim()).filter(Boolean),
        result: form.result,
        impact_score: form.impact_score,
      }),
    });
    if (res?.id) {
      onAdded(res as WorkEvidenceItem);
      setForm({ title: "", problem: "", tools: "", result: "", impact_score: 3 });
      setOpen(false);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-xs font-bold text-[var(--text-primary)]">{tr("evidenceLog.title", "Work Evidence Log")}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent)]/80"
        >
          <Plus className="w-3.5 h-3.5" /> {tr("evidenceLog.addEntry", "Add entry")}
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <input
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              placeholder={tr("evidenceLog.titlePlaceholder", "Title (e.g. Optimised API response time by 40%)")}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              rows={2}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              placeholder={tr("evidenceLog.problemPlaceholder", "Problem — What challenge did you face?")}
              value={form.problem}
              onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
            />
            <input
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              placeholder={tr("evidenceLog.toolsPlaceholder", "Tools / Stack (comma-separated: React, PostgreSQL, Redis)")}
              value={form.tools}
              onChange={(e) => setForm((f) => ({ ...f, tools: e.target.value }))}
            />
            <textarea
              rows={2}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              placeholder={tr("evidenceLog.resultPlaceholder", "Result — What measurable outcome did you achieve?")}
              value={form.result}
              onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[var(--text-muted)]">{tr("evidenceLog.impact", "Impact:")}</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, impact_score: s }))}
                className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                  form.impact_score === s
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
              >
                {s}
              </button>
            ))}
            <span className="text-xs text-[var(--text-muted)]">{IMPACT_LABELS[form.impact_score]}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !form.title || !form.problem || !form.result}
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--accent)]/90 disabled:opacity-50"
            >
              {saving ? tr("evidenceLog.saving", "Saving...") : tr("evidenceLog.save", "Save entry")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)]/50"
            >
              {tr("evidenceLog.cancel", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{tr("evidenceLog.empty", "No evidence logged yet.")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-[var(--text-primary)]">{item.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.impact_score != null && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[var(--accent)]">
                      <Star className="w-3 h-3" />{item.impact_score}/5
                    </span>
                  )}
                  <button type="button" onClick={() => onDeleted(item.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-muted)]">{tr("evidenceLog.problem", "Problem:")}</span> {item.problem}</p>
              {item.tools.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tools.map((tool) => (
                    <span key={tool} className="text-[10px] font-semibold bg-[var(--border)]/30 text-[var(--text-secondary)] rounded px-1.5 py-0.5">{tool}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-muted)]">{tr("evidenceLog.result", "Result:")}</span> {item.result}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
