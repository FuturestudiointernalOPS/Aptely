"use client";

import { useState } from "react";
import { Wand2, ChevronDown, ChevronUp, Download, FileText, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/apiHelper";
import { cvStudioExportApi, cvStudioDiffApi } from "@/lib/routes";
import DiffViewer from "./DiffViewer";

interface DiffPart {
  added?: boolean;
  removed?: boolean;
  value: string;
}

interface CorrectionCardProps {
  analysisId: string;
  status: string;
  resultJson: Record<string, unknown> | null;
  t: (key: string, fb?: string) => string;
}

export default function CorrectionCard({ analysisId, status, resultJson, t }: CorrectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [diffData, setDiffData] = useState<DiffPart[] | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const summary = resultJson?.summary as { total_changes: number; by_type: Record<string, number> } | undefined;
  const isReady = status === "completed" && resultJson;

  const loadDiff = async () => {
    if (diffData) {
      setExpanded(!expanded);
      return;
    }
    setLoadingDiff(true);
    try {
      const res = await apiFetch(cvStudioDiffApi(analysisId), undefined) as {
        changes: DiffPart[];
      };
      setDiffData(res.changes);
      setExpanded(true);
    } catch (err) {
      setDiffData(null);
      setErrorMsg(err instanceof Error ? err.message : t("cvStudio.correction.loadError", "Failed to load changes"));
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleExport = async (format: "pdf" | "docx") => {
    const setter = format === "pdf" ? setExportingPdf : setExportingDocx;
    setter(true);
    try {
      const res = await apiFetch(cvStudioExportApi(analysisId), undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      }) as { downloadUrl: string };
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("cvStudio.correction.exportError", "Export failed"));
    } finally {
      setter(false);
    }
  };

  const changeTypes = [
    { key: "spelling", labelKey: "cvStudio.correction.spelling", fb: "Orthographe" },
    { key: "grammar", labelKey: "cvStudio.correction.grammar", fb: "Grammaire" },
    { key: "formulation", labelKey: "cvStudio.correction.formulation", fb: "Formulation" },
    { key: "structure", labelKey: "cvStudio.correction.structure", fb: "Structure" },
    { key: "ats", labelKey: "cvStudio.correction.ats", fb: "ATS" },
    { key: "added", labelKey: "cvStudio.correction.added", fb: "Ajouté" },
  ];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: isReady ? "var(--accent-dim)" : "var(--bg-raised)",
            }}
          >
            <Wand2 size={14} style={{ color: isReady ? "var(--accent)" : "var(--text-muted)" }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {t("cvStudio.module.autoCorrection", "Correction Auto")}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t("cvStudio.module.autoCorrection.desc", "CV optimisé par l'IA")}
            </p>
          </div>
          {isReady && summary && (
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "var(--accent-dim)", color: "var(--accent)" }}
            >
              {summary.total_changes} {t("cvStudio.correction.totalChanges", "modifications")}
            </span>
          )}
        </div>

        {status === "processing" && (
          <p className="mt-2 ml-10 text-xs" style={{ color: "var(--text-muted)" }}>
            {t("cvStudio.correction.generating", "Génération en cours...")}
          </p>
        )}

        {status === "failed" && (
          <p className="mt-2 ml-10 text-xs" style={{ color: "var(--error)" }}>
            {t("cvStudio.moduleFailed", "Analyse échouée — sera retentée")}
          </p>
        )}

        {isReady && summary && (
          <>
            <div className="mt-3 ml-10 flex flex-wrap gap-2">
              {changeTypes.map(({ key, labelKey, fb }) => {
                const count = summary.by_type?.[key] ?? 0;
                if (count === 0) return null;
                return (
                  <span
                    key={key}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--bg-raised)", color: "var(--text-secondary)" }}
                  >
                    {t(labelKey, fb)}: {count}
                  </span>
                );
              })}
            </div>

            <div className="mt-3 ml-10 flex flex-wrap gap-2">
              <button
                onClick={loadDiff}
                disabled={loadingDiff}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-raised)", color: "var(--text-primary)" }}
              >
                {loadingDiff ? <ChevronDown size={12} className="animate-spin" /> : expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {loadingDiff
                  ? t("cvStudio.correction.generating", "Chargement...")
                  : expanded
                  ? t("cvStudio.correction.hideChanges", "Masquer")
                  : t("cvStudio.correction.viewChanges", "Voir les modifications")}
              </button>
              <button
                onClick={() => handleExport("pdf")}
                disabled={exportingPdf}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                <Download size={12} />
                {exportingPdf ? t("cvStudio.correction.downloading", "...") : t("cvStudio.correction.exportPdf", "PDF")}
              </button>
              <button
                onClick={() => handleExport("docx")}
                disabled={exportingDocx}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--bg-raised)", color: "var(--text-primary)" }}
              >
                <FileText size={12} />
                {exportingDocx ? t("cvStudio.correction.downloading", "...") : t("cvStudio.correction.exportDocx", "DOCX")}
              </button>
            </div>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="px-4 py-2 text-xs" style={{ color: "var(--error)" }}>{errorMsg}</div>
      )}

      {expanded && diffData && (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <DiffViewer changes={diffData} />
        </div>
      )}

      {isReady && (
        <div
          className="px-4 py-2 flex items-center gap-1.5 text-xs border-t"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--bg-deep)" }}
        >
          <AlertTriangle size={12} />
          {t("cvStudio.correction.disclaimer", "Suggestions IA — relisez toujours avant d'envoyer")}
        </div>
      )}
    </div>
  );
}
