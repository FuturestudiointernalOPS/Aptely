"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Briefcase, Sparkles, ChevronDown, ChevronUp, ThumbsUp, AlertTriangle, Zap, HelpCircle, Loader2, Calendar, Clock, Users, Video } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES, createAuthRedirect, prepBriefApi, myInterviewApi, individualsMyApplicationsApi } from "@/lib/routes";

interface ApplicationItem {
  id: string;
  status: string;
  role: { title: string; institution_name: string | null };
}

interface InterviewBrief {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  timezone: string;
  meeting_provider: string | null;
  meeting_link: string | null;
  interviewers: Array<{ name: string; role: string }>;
}

interface PrepQuestion {
  question: string;
  category: "technical" | "behavioral" | "situational" | "culture";
  guidance: string;
}

interface PrepBrief {
  id: string;
  application_id: string;
  role_title: string;
  institution_name: string;
  brief: {
    overview: string;
    strengths: string[];
    gaps: string[];
    action_items: string[];
  };
  questions: PrepQuestion[];
  generated_at: string;
}

const CATEGORY_CFG: Record<string, { labelKey: string; cls: string }> = {
  technical:   { labelKey: "individual.prep.cat.technical",   cls: "bg-blue-400/10 text-blue-400" },
  behavioral:  { labelKey: "individual.prep.cat.behavioral",  cls: "bg-purple-400/10 text-purple-400" },
  situational: { labelKey: "individual.prep.cat.situational", cls: "bg-amber-400/10 text-amber-400" },
  culture:     { labelKey: "individual.prep.cat.culture",     cls: "bg-emerald-400/10 text-emerald-400" },
};

export default function PrepPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brief, setBrief] = useState<PrepBrief | null>(null);
  const [fetching, setFetching] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Record<number, number>>({});
  const [genError, setGenError] = useState("");
  const [interviewBrief, setInterviewBrief] = useState<InterviewBrief | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(createAuthRedirect(ROUTES.candidate.prep)); return; }
    if (!isPersonal) { router.replace(ROUTES.company.dashboard); return; }

    apiFetch(individualsMyApplicationsApi, "HR", { method: "GET", cache: "no-store" }).then((res) => {
      const rows: ApplicationItem[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setApplications(rows);
      setFetching(false);
      const appParam = searchParams.get("app");
      if (appParam && rows.find((r) => r.id === appParam)) {
        selectApplication(appParam);
      }
    });
  }, [loading, router, user, isPersonal]);

  const selectApplication = async (appId: string) => {
    if (selectedId === appId && brief !== null) return;
    setSelectedId(appId);
    setBrief(null);
    setInterviewBrief(null);
    setExpandedQ(null);
    setConfidence({});
    setGenError("");
    setLoadingBrief(true);
    const [briefRes, ivRes] = await Promise.all([
      apiFetch(prepBriefApi(appId), "HR", { method: "GET", cache: "no-store" }),
      apiFetch(myInterviewApi(appId), "HR", { method: "GET", cache: "no-store" }),
    ]);
    setBrief(briefRes ?? null);
    setInterviewBrief(ivRes ?? null);
    setLoadingBrief(false);
  };

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    setGenError("");
    const res = await apiFetch(prepBriefApi(selectedId), "HR", { method: "POST" });
    if (res?.id) {
      setBrief(res as PrepBrief);
    } else {
      setGenError(t(locale, "individual.prep.genError", "AI generation failed. Please try again in a moment."));
    }
    setGenerating(false);
  };

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 text-sm text-[var(--text-muted)]">{t(locale, "individual.prep.loading", "Loading...")}</div>
      </div>
    );
  }

  const selectedApp = applications.find((a) => a.id === selectedId);

  return (
    <div className="py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.prep.sectionLabel", "Preparation")}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mt-1 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[var(--accent)]" />
            {t(locale, "individual.prep.title", "Interview Prep Centre")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t(locale, "individual.prep.subtitle", "Select an application to generate a personalized prep brief for your interview.")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Application list */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] px-1">{t(locale, "individual.prep.yourApplications", "Your applications")}</p>
            {applications.length === 0 ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 flex flex-col items-center gap-2 text-center">
                <Briefcase className="w-8 h-8 text-[var(--text-muted)]/40" />
                <p className="text-xs text-[var(--text-muted)]">{t(locale, "individual.prep.noApps", "No applications yet.")}</p>
              </div>
            ) : (
              applications.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => selectApplication(app.id)}
                  className={`w-full text-left bg-[var(--bg-surface)] border rounded-xl p-4 space-y-1 transition-colors ${
                    selectedId === app.id
                      ? "border-[var(--accent)]"
                      : "border-[var(--border)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{app.role.title}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">{app.role.institution_name ?? "—"}</p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    app.status === "VALIDATED" ? "bg-emerald-400/10 text-emerald-400" :
                    app.status === "REJECTED"  ? "bg-red-400/10 text-red-400" :
                    "bg-[var(--bg-raised)] text-[var(--text-muted)]"
                  }`}>{app.status}</span>
                </button>
              ))
            )}
          </div>

          {/* Brief panel */}
          <div className="md:col-span-2 space-y-4">
            {!selectedId && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-3">
                <BookOpen className="w-10 h-10 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-muted)]">{t(locale, "individual.prep.selectPrompt", "Select an application to see or generate your prep brief.")}</p>
              </div>
            )}

            {selectedId && loadingBrief && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 md:p-8 flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t(locale, "individual.prep.loadingBrief", "Loading brief...")}
              </div>
            )}

            {selectedId && !loadingBrief && !brief && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 md:p-8 text-center space-y-4">
                <Sparkles className="w-10 h-10 text-[var(--accent)] mx-auto" />
                <div className="space-y-1">
                  <p className="text-base font-bold text-[var(--text-primary)]">{t(locale, "individual.prep.noBriefTitle", "No prep brief yet")}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {t(locale, "individual.prep.noBriefDesc", "Generate a personalized guide for")}{" "}
                    <span className="font-semibold text-[var(--text-secondary)]">{selectedApp?.role.title}</span>
                    {selectedApp?.role.institution_name ? ` ${t(locale, "individual.prep.noBriefAt", "at")} ${selectedApp.role.institution_name}` : ""}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? t(locale, "individual.prep.generating", "Generating…") : t(locale, "individual.prep.generateBrief", "Generate prep brief")}
                </button>
                {generating && (
                  <p className="text-xs text-[var(--text-muted)]">{t(locale, "individual.prep.generatingHint", "This takes 10–20 seconds — analysing the role and your profile…")}</p>
                )}
                {genError && <p className="text-xs text-red-400">{genError}</p>}
              </div>
            )}

            {brief && (
              <div className="space-y-4">
                {genError && <p className="text-xs text-red-400 text-center">{genError}</p>}

                {/* Header + regen */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">{t(locale, "individual.prep.prepBriefFor", "Prep brief for")}</p>
                    <p className="text-base font-bold text-[var(--text-primary)]">{brief.role_title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{brief.institution_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {t(locale, "individual.prep.regenerate", "Regenerate")}
                  </button>
                </div>

                {/* Interview Briefing */}
                {interviewBrief && interviewBrief.status !== "DRAFT" && (
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {t(locale, "individual.prep.interviewSchedule", "Interview Schedule")}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {interviewBrief.scheduled_at && (
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                          <span>{new Date(interviewBrief.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                        <span>{interviewBrief.duration_minutes} min · {interviewBrief.timezone}</span>
                      </div>
                      {interviewBrief.meeting_link && (
                        <div className="flex items-center gap-2 col-span-2">
                          <Video className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                          <a href={interviewBrief.meeting_link} target="_blank" rel="noopener noreferrer"
                            className="text-[var(--accent)] hover:underline text-xs truncate">
                            {interviewBrief.meeting_provider === "GOOGLE_MEET" ? t(locale, "individual.prep.meetingLink.googleMeet", "Google Meet") : interviewBrief.meeting_provider === "TEAMS" ? t(locale, "individual.prep.meetingLink.teams", "Microsoft Teams") : t(locale, "individual.prep.meetingLink.default", "Meeting link")} →
                          </a>
                        </div>
                      )}
                    </div>
                    {interviewBrief.interviewers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> {t(locale, "individual.prep.panel", "Panel")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {interviewBrief.interviewers.map((iv, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border)] px-2.5 py-1 rounded-lg text-[var(--text-secondary)]">
                              <span className="font-semibold">{iv.name}</span>
                              <span className="text-[10px] text-[var(--text-muted)] uppercase">{iv.role}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Overview */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t(locale, "individual.prep.overview", "Overview")}</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{brief.brief.overview}</p>
                </div>

                {/* Strengths + Gaps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400 flex items-center gap-1">
                      <ThumbsUp className="w-3.5 h-3.5" /> {t(locale, "individual.prep.yourStrengths", "Your strengths")}
                    </p>
                    <ul className="space-y-2">
                      {brief.brief.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {t(locale, "individual.prep.areasToPrepare", "Areas to prepare")}
                    </p>
                    <ul className="space-y-2">
                      {brief.brief.gaps.map((g, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action items */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)] flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> {t(locale, "individual.prep.actionItems", "Action items")}
                  </p>
                  <ol className="space-y-2">
                    {brief.brief.action_items.map((a, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        {a}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Question bank */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" /> {t(locale, "individual.prep.questionBank", "Question bank")} ({brief.questions.length})
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{t(locale, "individual.prep.rateConfidence", "Rate your confidence")}</p>
                  </div>
                  <div className="space-y-0">
                    {brief.questions.map((q, i) => {
                      const cat = CATEGORY_CFG[q.category] ?? { labelKey: "", cls: "bg-[var(--bg-raised)] text-[var(--text-muted)]" };
                      const catLabel = cat.labelKey ? t(locale, cat.labelKey, q.category) : q.category;
                      const conf = confidence[i] ?? 0;
                      return (
                        <div key={i} className="border-b border-[var(--border)] last:border-0">
                          <button
                            type="button"
                            onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                            className="w-full flex items-start gap-3 py-3 text-left hover:bg-[var(--bg-raised)] transition-colors rounded-lg px-2"
                          >
                            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded mt-0.5 ${cat.cls}`}>
                              {catLabel}
                            </span>
                            <span className="flex-1 text-sm text-[var(--text-primary)]">{q.question}</span>
                            {expandedQ === i ? (
                              <ChevronUp className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                            )}
                          </button>
                          {expandedQ === i && (
                            <div className="px-2 pb-3 space-y-3">
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{q.guidance}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t(locale, "individual.prep.confidence", "Confidence:")}</span>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setConfidence((c) => ({ ...c, [i]: s }))}
                                      className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${
                                        conf >= s
                                          ? "bg-[var(--accent)] text-white"
                                          : "border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50"
                                      }`}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                                {conf > 0 && (
                                  <span className="text-[10px] text-[var(--text-muted)]">
                                    {["", t(locale, "individual.prep.conf.notConfident", "Not confident"), t(locale, "individual.prep.conf.slightlyConfident", "Slightly confident"), t(locale, "individual.prep.conf.moderate", "Moderate"), t(locale, "individual.prep.conf.confident", "Confident"), t(locale, "individual.prep.conf.veryConfident", "Very confident")][conf]}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[10px] text-[var(--text-muted)] text-right">
                  {t(locale, "individual.prep.generatedOn", "Generated")} {new Date(brief.generated_at).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
