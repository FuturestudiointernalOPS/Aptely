"use client";

import { useCallback, useEffect, useState } from "react";
import { getInterviewScorecardTemplate, updateInterviewScorecardTemplate } from "@/lib/api";
import { Plus, Trash2, Check } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

interface ScorecardTemplateEditorProps {
  interviewId: string;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

interface CriterionDraft {
  key: string;
  label: string;
  weight: number;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80) || `criterion_${Date.now()}`;
}

export default function ScorecardTemplateEditor({ interviewId, onError, onSuccess }: ScorecardTemplateEditorProps) {
  const locale = getClientLocale();
  const tr = useCallback((key: string, fallback: string) => t(locale, key, fallback), [locale]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState(() => tr("interview.scorecard.template.gridName", "Scoring grid"));
  const [criteria, setCriteria] = useState<CriterionDraft[]>(() => [
    { key: "role_fit", label: tr("interview.scorecard.criteria.roleFit", "Role fit"), weight: 35 },
    { key: "technical_depth", label: tr("interview.scorecard.criteria.technicalDepth", "Technical skills"), weight: 30 },
    { key: "communication", label: tr("interview.scorecard.criteria.communication", "Communication"), weight: 20 },
    { key: "problem_solving", label: tr("interview.scorecard.criteria.problemSolving", "Problem solving"), weight: 15 },
  ]);

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const template = await getInterviewScorecardTemplate(interviewId);
      if (template && template.criteria.length > 0) {
        setTemplateName(template.templateName || tr("interview.scorecard.template.gridName", "Scoring grid"));
        setCriteria(template.criteria.map((c) => ({
          key: c.criterionKey,
          label: c.label,
          weight: c.weight ?? 0,
        })));
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [interviewId, tr]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);

  const handleSave = async () => {
    if (criteria.length === 0) {
      onError?.(tr("interview.scorecard.template.errors.noCriteria", "Add at least one criterion."));
      return;
    }
    setSaving(true);
    const result = await updateInterviewScorecardTemplate(interviewId, {
      templateName,
      criteria: criteria.map((c, i) => ({ criterionKey: c.key, label: c.label, weight: c.weight, position: i + 1 })),
    });
    if (!result) {
      onError?.(tr("interview.scorecard.template.errors.save", "Failed to save scoring template."));
    } else {
      onSuccess?.(tr("interview.scorecard.template.success.save", "Scoring template saved."));
      setTemplateName(result.templateName);
      if (result.criteria.length > 0) {
        setCriteria(result.criteria.map((c) => ({ key: c.criterionKey, label: c.label, weight: c.weight ?? 0 })));
      }
    }
    setSaving(false);
  };

  const addCriterion = () => {
    setCriteria((prev) => [...prev, { key: `criterion_${prev.length + 1}`, label: "", weight: 0 }]);
  };

  const removeCriterion = (idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCriterion = (idx: number, field: keyof CriterionDraft, value: string | number) => {
    setCriteria((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const updated = { ...c, [field]: value };
        if (field === "label" && typeof value === "string") {
          updated.key = slugify(value) || c.key;
        }
        return updated;
      })
    );
  };

  if (loading) {
    return <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-muted)]">{tr("common.loading", "Loading...")}</div>;
  }

  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 space-y-4">
      <h3 className="font-bold text-[var(--text-primary)] text-sm">
        {tr("interview.scorecard.template.title", "Grille de notation — critères d'évaluation")}
      </h3>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
          {tr("interview.scorecard.template.gridName", "Nom de la grille")}
        </label>
        <input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="w-full bg-[var(--bg-deep)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
          placeholder={tr("interview.scorecard.template.gridNamePlaceholder", "e.g. Senior technical grid")}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            {tr("interview.scorecard.template.criteria", "Critères")}
          </label>
          <span className={`text-xs font-bold ${totalWeight === 100 ? "text-emerald-400" : "text-amber-400"}`}>
            Total: {totalWeight}% {totalWeight !== 100 && "(doit être 100%)"}
          </span>
        </div>

        <div className="space-y-2">
          {criteria.map((c, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_36px] gap-2 items-center">
              <input
                value={c.label}
                onChange={(e) => updateCriterion(idx, "label", e.target.value)}
                placeholder={tr("interview.scorecard.template.criterionLabel", "Ex: Compétences techniques")}
                className="bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={c.weight}
                  onChange={(e) => updateCriterion(idx, "weight", parseInt(e.target.value) || 0)}
                  className="w-full bg-[var(--bg-deep)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">%</span>
              </div>
              <button
                type="button"
                onClick={() => removeCriterion(idx)}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-red-400 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCriterion}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          {tr("interview.scorecard.template.addCriterion", "Ajouter un critère")}
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || criteria.length === 0}
        className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent)]-soft disabled:opacity-60"
      >
        <Check className="w-4 h-4" />
        {saving
          ? tr("interview.scorecard.template.saving", "Saving...")
          : tr("interview.scorecard.template.save", "Enregistrer la grille")}
      </button>
    </div>
  );
}
