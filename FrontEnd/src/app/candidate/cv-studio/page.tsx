"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Upload, Trash2, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch, apiSend } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import {
  ROUTES,
  createAuthRedirect,
  cvStudioAnalyzeApi,
  cvStudioAnalysesApi,
  cvStudioAnalysisApi,
  cvStudioAnalysisStatusApi,
} from "@/lib/routes";
import RadarChart from "@/components/CvStudio/RadarChart";
import ModuleCard from "@/components/CvStudio/ModuleCard";
// import CorrectionCard from "@/components/CvStudio/CorrectionCard"; // temporarily hidden — auto_correction not exposed in UI yet
import AnalysisProgress from "@/components/CvStudio/AnalysisProgress";
import ErrorBoundary from "@/components/ErrorBoundary";

const MODULE_META: Record<
  string,
  {
    labelKey: string;
    descKey: string;
    defaultLabel: string;
    defaultDesc: string;
  }
> = {
  visual: {
    labelKey: "cvStudio.module.visual",
    descKey: "cvStudio.module.visual.desc",
    defaultLabel: "Visuel",
    defaultDesc: "Mise en page & design",
  },
  coherence: {
    labelKey: "cvStudio.module.coherence",
    descKey: "cvStudio.module.coherence.desc",
    defaultLabel: "Cohérence",
    defaultDesc: "Structure & logique",
  },
  linguistic: {
    labelKey: "cvStudio.module.linguistic",
    descKey: "cvStudio.module.linguistic.desc",
    defaultLabel: "Linguistique",
    defaultDesc: "Orthographe & formulation",
  },
  impact: {
    labelKey: "cvStudio.module.impact",
    descKey: "cvStudio.module.impact.desc",
    defaultLabel: "Impact",
    defaultDesc: "Verbes d'action & résultats",
  },
  completeness: {
    labelKey: "cvStudio.module.completeness",
    descKey: "cvStudio.module.completeness.desc",
    defaultLabel: "Complétude",
    defaultDesc: "Sections requises",
  },
  job_fit: {
    labelKey: "cvStudio.module.jobFit",
    descKey: "cvStudio.module.jobFit.desc",
    defaultLabel: "Adéquation",
    defaultDesc: "Match avec le poste",
  },
  country: {
    labelKey: "cvStudio.module.country",
    descKey: "cvStudio.module.country.desc",
    defaultLabel: "Pays de candidature",
    defaultDesc: "Normes locales CV",
  },
  ats: {
    labelKey: "cvStudio.module.ats",
    descKey: "cvStudio.module.ats.desc",
    defaultLabel: "ATS",
    defaultDesc: "Compatibilité robots",
  },
  credibility: {
    labelKey: "cvStudio.module.credibility",
    descKey: "cvStudio.module.credibility.desc",
    defaultLabel: "Crédibilité",
    defaultDesc: "Cohérence temporelle",
  },
  competitive: {
    labelKey: "cvStudio.module.competitive",
    descKey: "cvStudio.module.competitive.desc",
    defaultLabel: "Compétitivité",
    defaultDesc: "Positionnement marché & skills gap",
  },
  auto_correction: {
    labelKey: "cvStudio.module.autoCorrection",
    descKey: "cvStudio.module.autoCorrection.desc",
    defaultLabel: "Correction Auto",
    defaultDesc: "CV optimisé par l'IA",
  },
};

// auto_correction temporarily hidden from UI
const MODULE_ORDER = [
  "visual",
  "coherence",
  "linguistic",
  "impact",
  "completeness",
  "job_fit",
  "country",
  "ats",
  "credibility",
  "competitive",
];
const RADAR_MODULES = MODULE_ORDER;

const COUNTRIES = [
  "France",
  "Belgium",
  "Switzerland",
  "Canada",
  "Luxembourg",
  "United States",
  "United Kingdom",
  "Germany",
  "Netherlands",
  "Spain",
  "Italy",
  "Portugal",
  "Australia",
  "Japan",
  "South Korea",
  "China",
  "India",
  "Brazil",
  "Morocco",
  "Senegal",
  "Ivory Coast",
  "Cameroon",
  "Tunisia",
  "South Africa",
  "Nigeria",
  "Kenya",
  "UAE",
  "Saudi Arabia",
  "Singapore",
  "Sweden",
  "Norway",
];

const COUNTRY_LABELS: Record<string, { fr: string; en: string }> = {
  France: { fr: "France", en: "France" },
  Belgium: { fr: "Belgique", en: "Belgium" },
  Switzerland: { fr: "Suisse", en: "Switzerland" },
  Canada: { fr: "Canada", en: "Canada" },
  Luxembourg: { fr: "Luxembourg", en: "Luxembourg" },
  "United States": { fr: "États-Unis", en: "United States" },
  "United Kingdom": { fr: "Royaume-Uni", en: "United Kingdom" },
  Germany: { fr: "Allemagne", en: "Germany" },
  Netherlands: { fr: "Pays-Bas", en: "Netherlands" },
  Spain: { fr: "Espagne", en: "Spain" },
  Italy: { fr: "Italie", en: "Italy" },
  Portugal: { fr: "Portugal", en: "Portugal" },
  Australia: { fr: "Australie", en: "Australia" },
  Japan: { fr: "Japon", en: "Japan" },
  "South Korea": { fr: "Corée du Sud", en: "South Korea" },
  China: { fr: "Chine", en: "China" },
  India: { fr: "Inde", en: "India" },
  Brazil: { fr: "Brésil", en: "Brazil" },
  Morocco: { fr: "Maroc", en: "Morocco" },
  Senegal: { fr: "Sénégal", en: "Senegal" },
  "Ivory Coast": { fr: "Côte d'Ivoire", en: "Ivory Coast" },
  Cameroon: { fr: "Cameroun", en: "Cameroon" },
  Tunisia: { fr: "Tunisie", en: "Tunisia" },
  "South Africa": { fr: "Afrique du Sud", en: "South Africa" },
  Nigeria: { fr: "Nigeria", en: "Nigeria" },
  Kenya: { fr: "Kenya", en: "Kenya" },
  UAE: { fr: "Émirats Arabes Unis", en: "UAE" },
  "Saudi Arabia": { fr: "Arabie Saoudite", en: "Saudi Arabia" },
  Singapore: { fr: "Singapour", en: "Singapore" },
  Sweden: { fr: "Suède", en: "Sweden" },
  Norway: { fr: "Norvège", en: "Norway" },
};

interface Analysis {
  id: string;
  file_name: string;
  status: string;
  overall_score: number | null;
  target_country: string | null;
  target_job_title: string | null;
  created_at: string;
}

interface AnalysisModule {
  module_key: string;
  status: string;
  score: number | null;
  result_json: Record<string, unknown> | null;
}

interface AnalysisFull extends Analysis {
  modules: AnalysisModule[];
}

interface StatusResponse {
  id: string;
  status: string;
  overall_score: number | null;
  modules: Record<string, string>;
  completed_count: number;
  total_count: number;
}

export default function CvStudioPage() {
  const locale = getClientLocale();
  const translate = (key: string, fb?: string) => t(locale, key, fb);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();

  const [view, setView] = useState<
    "upload" | "processing" | "results" | "history"
  >("upload");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisFull | null>(
    null,
  );
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetCountry, setTargetCountry] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pollSeqRef = useRef(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(createAuthRedirect(ROUTES.candidate.cvStudio));
      return;
    }
    if (!isPersonal) {
      router.replace(ROUTES.company.dashboard);
      return;
    }
    loadHistory();
  }, [loading, user, isPersonal, router]);

  const loadHistory = useCallback(async () => {
    try {
      const data = (await apiFetch(cvStudioAnalysesApi, "none")) as
        Analysis[] | null;
      setAnalyses(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }, []);

  const startAnalysis = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (targetCountry) formData.append("target_country", targetCountry);
      if (targetJobTitle) formData.append("target_job_title", targetJobTitle);

      const res = (await apiSend(cvStudioAnalyzeApi, {
        method: "POST",
        body: formData,
      })) as { id: string; status: string } | null;

      if (!res?.id) {
        setError(
          translate(
            "cvStudio.uploadError",
            "Erreur lors de l'envoi du CV. Vérifiez votre connexion et réessayez.",
          ),
        );
        return;
      }

      setView("processing");
      startPolling(res.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : translate("cvStudio.uploadError", "Erreur lors de l'envoi du CV"),
      );
    } finally {
      setUploading(false);
    }
  };

  const startPolling = (analysisId: string) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    const seq = ++pollSeqRef.current;

    const poll = async () => {
      if (!mountedRef.current || seq !== pollSeqRef.current) return;
      try {
        const data = (await apiFetch(
          cvStudioAnalysisStatusApi(analysisId),
          "none",
        )) as StatusResponse;
        if (!mountedRef.current || seq !== pollSeqRef.current) return;
        setStatusData(data);

        if (data.status === "completed" || data.status === "failed") {
          pollRef.current = null;
          await loadFullAnalysis(analysisId);
          return;
        }
      } catch {
        pollRef.current = null;
        return;
      }
      if (mountedRef.current && seq === pollSeqRef.current) {
        pollRef.current = setTimeout(poll, 2000);
      }
    };

    pollRef.current = setTimeout(poll, 2000);
  };

  const loadFullAnalysis = async (analysisId: string) => {
    try {
      const data = (await apiFetch(
        cvStudioAnalysisApi(analysisId),
        "none",
      )) as AnalysisFull;
      setCurrentAnalysis(data);
      setView("results");
      loadHistory();
    } catch {
      setError(
        translate("cvStudio.loadError", "Impossible de charger l'analyse"),
      );
    }
  };

  const deleteAnalysis = async (id: string) => {
    const res = await apiFetch(cvStudioAnalysisApi(id), "none", { method: "DELETE" });
    if (res === null) {
      setError(translate("cvStudio.deleteError", "Impossible de supprimer l'analyse"));
      return;
    }
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
    if (currentAnalysis?.id === id) {
      setCurrentAnalysis(null);
      setView("upload");
    }
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || file.type !== "application/pdf") {
      setError(
        translate("cvStudio.pdfOnly", "Seuls les fichiers PDF sont acceptés"),
      );
    } else if (file.size > 10 * 1024 * 1024) {
      setError(translate("cvStudio.fileTooLarge", "Le fichier dépasse 10 Mo"));
    } else {
      setSelectedFile(file);
      setError(null);
      return;
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: "var(--accent)" }}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSearch size={24} style={{ color: "var(--accent)" }} />
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {translate("cvStudio.title", "CV Studio")}
            </h1>
            <p
              className="text-sm max-w-lg"
              style={{ color: "var(--text-muted)" }}
            >
              {translate(
                "cvStudio.intro",
                "Let me help you build your professional CV — upload your existing one."
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {view !== "upload" && (
              <button
                onClick={() => {
                  pollSeqRef.current++;
                  if (pollRef.current) {
                    clearTimeout(pollRef.current);
                    pollRef.current = null;
                  }
                  setView("upload");
                  setCurrentAnalysis(null);
                  setStatusData(null);
                  setSelectedFile(null);
                  setError(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                {translate("cvStudio.newAnalysis", "Nouvelle analyse")}
              </button>
            )}
            {analyses.length > 0 && view !== "history" && (
              <button
                onClick={() => setView("history")}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {translate("cvStudio.history", "Historique")} ({analyses.length}
                )
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--error-bg)",
              color: "var(--error)",
            }}
          >
            {error}
          </div>
        )}

        {/* ─── Upload View ─── */}
        {view === "upload" && (
          <div className="space-y-4">
            <div
              className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
              style={{
                borderColor: selectedFile ? "var(--accent)" : "var(--border)",
                backgroundColor: "var(--bg-surface)",
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload
                size={40}
                className="mx-auto mb-3"
                style={{
                  color: selectedFile ? "var(--accent)" : "var(--text-muted)",
                }}
              />
              {selectedFile ? (
                <div>
                  <p
                    className="font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {selectedFile.name}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p
                    className="font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {translate(
                      "cvStudio.dropzone",
                      "Glissez votre CV ici ou cliquez",
                    )}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    PDF, 10 MB max
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSelectedFile(f);
                    setError(null);
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {translate("cvStudio.targetCountry", "Pays de candidature")}
                  <span
                    className="ml-1 text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ({translate("cvStudio.optional", "optionnel")})
                  </span>
                </label>
                <select
                  value={targetCountry}
                  onChange={(e) => setTargetCountry(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{
                    backgroundColor: "var(--bg-raised)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">
                    {translate(
                      "cvStudio.selectCountry",
                      "Sélectionner un pays...",
                    )}
                  </option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {locale === "fr" ? COUNTRY_LABELS[c]?.fr ?? c : COUNTRY_LABELS[c]?.en ?? c}
                    </option>
                  ))}
                </select>
                <p
                  className="mt-1 text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {translate(
                    "cvStudio.targetCountryHint",
                    "Adapte l'analyse aux normes CV et au marché du pays sélectionné.",
                  )}
                </p>
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {translate("cvStudio.targetJob", "Poste visé")}
                </label>
                <input
                  type="text"
                  value={targetJobTitle}
                  onChange={(e) => setTargetJobTitle(e.target.value)}
                  placeholder={translate(
                    "cvStudio.targetJobPlaceholder",
                    "ex: Product Manager",
                  )}
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{
                    backgroundColor: "var(--bg-raised)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <button
              onClick={startAnalysis}
              disabled={!selectedFile || uploading}
              className="w-full py-3 rounded-xl font-medium text-sm transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              {uploading
                ? translate("cvStudio.analyzing", "Analyse en cours...")
                : translate("cvStudio.analyze", "Analyser mon CV")}
            </button>
          </div>
        )}

        {/* ─── Processing View ─── */}
        {view === "processing" && statusData && (
          <div className="space-y-4">
            <div
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              <h2
                className="text-sm font-semibold mb-4"
                style={{ color: "var(--text-primary)" }}
              >
                {translate("cvStudio.processingTitle", "Analyse en cours...")}
              </h2>
              <AnalysisProgress
                modules={MODULE_ORDER.map((key) => ({
                  key,
                  label: translate(
                    MODULE_META[key].labelKey,
                    MODULE_META[key].defaultLabel,
                  ),
                  status: statusData.modules[key] ?? "pending",
                }))}
                completedCount={statusData.completed_count}
                totalCount={statusData.total_count}
              />
            </div>
          </div>
        )}

        {/* ─── Results View ─── */}
        {view === "results" && currentAnalysis && (
          <div className="space-y-6">
            <div
              className="rounded-xl border p-6"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {currentAnalysis.file_name}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(currentAnalysis.created_at).toLocaleDateString(
                      locale === "fr" ? "fr-FR" : "en-US",
                    )}
                  </p>
                </div>
                {currentAnalysis.overall_score != null && (
                  <div className="text-center">
                    <div
                      className="text-3xl font-bold"
                      style={{ color: "var(--accent)" }}
                    >
                      {currentAnalysis.overall_score}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      / 100
                    </div>
                  </div>
                )}
              </div>

              <RadarChart
                modules={RADAR_MODULES.map((key) => {
                  const mod = currentAnalysis.modules.find(
                    (m) => m.module_key === key,
                  );
                  return {
                    key,
                    label: translate(
                      MODULE_META[key].labelKey,
                      MODULE_META[key].defaultLabel,
                    ),
                    score: mod?.score ?? null,
                  };
                })}
              />
            </div>

            <div className="space-y-3">
              {MODULE_ORDER.map((key) => {
                const mod = currentAnalysis.modules.find(
                  (m) => m.module_key === key,
                );
                return (
                  <ModuleCard
                    key={key}
                    moduleKey={key}
                    label={translate(
                      MODULE_META[key].labelKey,
                      MODULE_META[key].defaultLabel,
                    )}
                    description={translate(
                      MODULE_META[key].descKey,
                      MODULE_META[key].defaultDesc,
                    )}
                    status={mod?.status ?? "pending"}
                    score={mod?.score ?? null}
                    resultJson={mod?.result_json ?? null}
                    t={translate}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ─── History View ─── */}
        {view === "history" && (
          <div className="space-y-3">
            {analyses.length === 0 ? (
              <p
                className="text-center text-sm py-8"
                style={{ color: "var(--text-muted)" }}
              >
                {translate("cvStudio.noHistory", "Aucune analyse")}
              </p>
            ) : (
              analyses.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border p-4 flex items-center gap-4 cursor-pointer transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border)",
                  }}
                  onClick={() => loadFullAnalysis(a.id)}
                >
                  <Clock size={16} style={{ color: "var(--text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.file_name}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {new Date(a.created_at).toLocaleDateString(
                        locale === "fr" ? "fr-FR" : "en-US",
                      )}
                      {a.target_job_title && ` · ${a.target_job_title}`}
                      {a.target_country && ` · ${a.target_country}`}
                    </p>
                  </div>
                  {a.overall_score != null && (
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--accent)" }}
                    >
                      {a.overall_score}/100
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnalysis(a.id);
                    }}
                    className="p-1 rounded hover:opacity-70"
                    title={translate("cvStudio.delete", "Supprimer")}
                  >
                    <Trash2 size={14} style={{ color: "var(--text-muted)" }} />
                  </button>
                  <ChevronRight
                    size={14}
                    style={{ color: "var(--text-muted)" }}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
