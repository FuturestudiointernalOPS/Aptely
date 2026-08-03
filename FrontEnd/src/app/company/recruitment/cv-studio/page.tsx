"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import {
  ROUTES,
  createAuthRedirect,
  cvStudioHrAnalyzeApi,
  cvStudioHrAnalysisApi,
} from "@/lib/routes";
import RadarChart from "@/components/CvStudio/RadarChart";
import ModuleCard from "@/components/CvStudio/ModuleCard";
// import CorrectionCard from "@/components/CvStudio/CorrectionCard"; // temporarily hidden — auto_correction not exposed in UI yet
import AnalysisProgress from "@/components/CvStudio/AnalysisProgress";
import ErrorBoundary from "@/components/ErrorBoundary";

const MODULE_META: Record<string, { labelKey: string; descKey: string; defaultLabel: string; defaultDesc: string }> = {
  visual:       { labelKey: "cvStudio.module.visual",       descKey: "cvStudio.module.visual.desc",       defaultLabel: "Visuel",         defaultDesc: "Mise en page & design" },
  coherence:    { labelKey: "cvStudio.module.coherence",    descKey: "cvStudio.module.coherence.desc",    defaultLabel: "Cohérence",      defaultDesc: "Structure & logique" },
  linguistic:   { labelKey: "cvStudio.module.linguistic",   descKey: "cvStudio.module.linguistic.desc",   defaultLabel: "Linguistique",   defaultDesc: "Orthographe & formulation" },
  impact:       { labelKey: "cvStudio.module.impact",       descKey: "cvStudio.module.impact.desc",       defaultLabel: "Impact",         defaultDesc: "Verbes d'action & résultats" },
  completeness: { labelKey: "cvStudio.module.completeness", descKey: "cvStudio.module.completeness.desc", defaultLabel: "Complétude",     defaultDesc: "Sections requises" },
  job_fit:      { labelKey: "cvStudio.module.jobFit",       descKey: "cvStudio.module.jobFit.desc",       defaultLabel: "Adéquation",     defaultDesc: "Match avec le poste" },
  country:      { labelKey: "cvStudio.module.country",      descKey: "cvStudio.module.country.desc",      defaultLabel: "Pays cible",     defaultDesc: "Normes locales CV" },
  ats:          { labelKey: "cvStudio.module.ats",          descKey: "cvStudio.module.ats.desc",          defaultLabel: "ATS",            defaultDesc: "Compatibilité robots" },
  credibility:  { labelKey: "cvStudio.module.credibility",  descKey: "cvStudio.module.credibility.desc",  defaultLabel: "Crédibilité",    defaultDesc: "Cohérence temporelle" },
  competitive:  { labelKey: "cvStudio.module.competitive",  descKey: "cvStudio.module.competitive.desc",  defaultLabel: "Compétitivité",  defaultDesc: "Positionnement marché & skills gap" },
  auto_correction: { labelKey: "cvStudio.module.autoCorrection", descKey: "cvStudio.module.autoCorrection.desc", defaultLabel: "Correction Auto", defaultDesc: "CV optimisé par l'IA" },
};

// auto_correction temporarily hidden from UI
const MODULE_ORDER = ["visual", "coherence", "linguistic", "impact", "completeness", "job_fit", "country", "ats", "credibility", "competitive"];
const RADAR_MODULES = MODULE_ORDER;

const COUNTRIES = [
  "France", "Belgium", "Switzerland", "Canada", "Luxembourg", "United States", "United Kingdom",
  "Germany", "Netherlands", "Spain", "Italy", "Portugal", "Australia", "Japan", "South Korea",
  "China", "India", "Brazil", "Morocco", "Senegal", "Ivory Coast", "Cameroon", "Tunisia",
  "South Africa", "Nigeria", "Kenya", "UAE", "Saudi Arabia", "Singapore", "Sweden", "Norway",
];

interface AnalysisModule {
  module_key: string;
  status: string;
  score: number | null;
  result_json: Record<string, unknown> | null;
}

interface AnalysisFull {
  id: string;
  file_name: string;
  status: string;
  overall_score: number | null;
  target_country: string | null;
  target_job_title: string | null;
  created_at: string;
  modules: AnalysisModule[];
}

interface StatusPoll {
  id: string;
  status: string;
  overall_score: number | null;
  modules: Record<string, string>;
  completed_count: number;
  total_count: number;
}

export default function HrCvStudioPage() {
  const locale = getClientLocale();
  const translate = (key: string, fb?: string) => t(locale, key, fb);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();

  const [view, setView] = useState<"upload" | "processing" | "results">("upload");
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisFull | null>(null);
  const [statusData, setStatusData] = useState<StatusPoll | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidateId, setCandidateId] = useState("");
  const [targetCountry, setTargetCountry] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pollSeqRef = useRef(0);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(createAuthRedirect(ROUTES.company.recruitment.cvStudio)); return; }
    if (isPersonal) { router.replace(ROUTES.candidate.dashboard); return; }
  }, [loading, user, isPersonal, router]);

  const startAnalysis = async () => {
    if (!selectedFile || !candidateId.trim()) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("candidate_id", candidateId.trim());
      if (targetCountry) formData.append("target_country", targetCountry);
      if (targetJobTitle) formData.append("target_job_title", targetJobTitle);

      const res = await apiFetch(
        cvStudioHrAnalyzeApi,
        "HR",
        { method: "POST", body: formData },
      ) as { id: string } | null;

      if (!res?.id) {
        setError(translate("cvStudio.uploadError", "Erreur lors de l'analyse"));
        return;
      }

      setView("processing");
      startPolling(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : translate("cvStudio.uploadError", "Erreur lors de l'analyse"));
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
        const data = await apiFetch(cvStudioHrAnalysisApi(analysisId), "HR") as AnalysisFull | null;
        if (!mountedRef.current || seq !== pollSeqRef.current) return;
        if (!data) { pollRef.current = null; return; }
        const mods = data.modules ?? [];
        const moduleMap: Record<string, string> = {};
        mods.forEach((m) => { moduleMap[m.module_key] = m.status; });
        const done = mods.filter((m) => m.status === "completed" || m.status === "failed" || m.status === "skipped").length;

        setStatusData({
          id: data.id,
          status: data.status,
          overall_score: data.overall_score,
          modules: moduleMap,
          completed_count: done,
          total_count: 11,
        });

        if (data.status === "completed" || data.status === "failed") {
          pollRef.current = null;
          setCurrentAnalysis(data);
          setView("results");
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

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <FileSearch size={24} style={{ color: "var(--accent)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {translate("cvStudio.hrTitle", "CV Studio — Analyse RH")}
        </h1>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--error-bg)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {view === "upload" && (
        <div className="space-y-4">
          <div
            className="rounded-xl border p-6 space-y-4"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                {translate("cvStudio.candidateId", "ID Candidat")} *
              </label>
              <input
                type="text"
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                placeholder="UUID du candidat"
                maxLength={50}
                pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                className="w-full rounded-lg px-3 py-2 text-sm border"
                style={{ backgroundColor: "var(--bg-raised)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            <div
              className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer"
              style={{ borderColor: selectedFile ? "var(--accent)" : "var(--border)" }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (!f || f.type !== "application/pdf") { setError(translate("cvStudio.pdfOnly", "PDF only")); return; }
                if (f.size > 10 * 1024 * 1024) { setError(translate("cvStudio.fileTooLarge", "File exceeds 10 MB")); return; }
                setSelectedFile(f);
                setError(null);
              }}
            >
              <Upload size={32} className="mx-auto mb-2" style={{ color: selectedFile ? "var(--accent)" : "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                {selectedFile ? selectedFile.name : translate("cvStudio.dropzone", "Glissez le CV ici ou cliquez")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  {translate("cvStudio.targetCountry", "Pays cible")}
                </label>
                <select
                  value={targetCountry}
                  onChange={(e) => setTargetCountry(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{ backgroundColor: "var(--bg-raised)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">{translate("cvStudio.selectCountry", "Optionnel")}</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  {translate("cvStudio.targetJob", "Poste visé")}
                </label>
                <input
                  type="text"
                  value={targetJobTitle}
                  onChange={(e) => setTargetJobTitle(e.target.value)}
                  placeholder="ex: Développeur Full-Stack"
                  className="w-full rounded-lg px-3 py-2 text-sm border"
                  style={{ backgroundColor: "var(--bg-raised)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            <button
              onClick={startAnalysis}
              disabled={!selectedFile || !candidateId.trim() || uploading}
              className="w-full py-3 rounded-xl font-medium text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              {uploading ? translate("cvStudio.analyzing", "Analyse en cours...") : translate("cvStudio.analyzeHr", "Analyser ce CV")}
            </button>
          </div>
        </div>
      )}

      {view === "processing" && statusData && (
        <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            {translate("cvStudio.processingTitle", "Analyse en cours...")}
          </h2>
          <AnalysisProgress
            modules={MODULE_ORDER.map((key) => ({
              key,
              label: translate(MODULE_META[key].labelKey, MODULE_META[key].defaultLabel),
              status: statusData.modules[key] ?? "pending",
            }))}
            completedCount={statusData.completed_count}
            totalCount={statusData.total_count}
          />
        </div>
      )}

      {view === "results" && currentAnalysis && (
        <div className="space-y-6">
          <div className="rounded-xl border p-6" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {currentAnalysis.file_name}
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(currentAnalysis.created_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                </p>
              </div>
              {currentAnalysis.overall_score != null && (
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: "var(--accent)" }}>{currentAnalysis.overall_score}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>/ 100</div>
                </div>
              )}
            </div>
            <RadarChart
              modules={RADAR_MODULES.map((key) => {
                const mod = currentAnalysis.modules?.find((m: AnalysisModule) => m.module_key === key);
                return {
                  key,
                  label: translate(MODULE_META[key].labelKey, MODULE_META[key].defaultLabel),
                  score: mod?.score ?? null,
                };
              })}
            />
          </div>

          <div className="space-y-3">
            {MODULE_ORDER.map((key) => {
              const mod = currentAnalysis.modules?.find((m: AnalysisModule) => m.module_key === key);
              return (
                <ModuleCard
                  key={key}
                  moduleKey={key}
                  label={translate(MODULE_META[key].labelKey, MODULE_META[key].defaultLabel)}
                  description={translate(MODULE_META[key].descKey, MODULE_META[key].defaultDesc)}
                  status={mod?.status ?? "pending"}
                  score={mod?.score ?? null}
                  resultJson={mod?.result_json ?? null}
                  t={translate}
                />
              );
            })}
          </div>

          <button
            onClick={() => { setView("upload"); setCurrentAnalysis(null); setStatusData(null); setSelectedFile(null); setCandidateId(""); }}
            className="w-full py-3 rounded-xl font-medium text-sm"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {translate("cvStudio.newAnalysis", "Nouvelle analyse")}
          </button>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
