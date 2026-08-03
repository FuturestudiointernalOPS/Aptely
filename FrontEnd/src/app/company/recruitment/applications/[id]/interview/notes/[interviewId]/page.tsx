"use client";
import { ROUTES, appInterviewPath, appInterviewReschedulePath } from "@/lib/routes";

import { useEffect, useState, lazy, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertCircle, FileText, Loader, Sparkles, CalendarClock, Video, Users, Mail } from "lucide-react";
const JitsiEmbed = lazy(() => import("@/components/JitsiEmbed"));
import { useAuth, useRequireInstitution } from "@/lib/auth";
import {
  generateDuringInterviewQuestions,
  generateInterviewSummary,
  getApplicationById,
  getCandidateInterviewHistory,
  getHRMembers,
  getInterviewerQuestionPack,
  getLatestInterviewSummary,
  type GeneratedQuestion,
  type InterviewSummary,
} from "@/lib/api";
import ScorecardPanel from "../../ScorecardPanel";
import FinalDecisionSection from "../../FinalDecisionSection";
import { getClientLocale, t } from "@/lib/i18n";

function formatDate(iso?: string | null, locale = "fr"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso?: string | null, locale = "fr"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InterviewNotesPage() {
  useRequireInstitution();
  const { user } = useAuth();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  const params = useParams<{ id: string; interviewId: string }>();
  const applicationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const interviewId = Array.isArray(params.interviewId) ? params.interviewId[0] : params.interviewId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [interview, setInterview] = useState<any | null>(null);
  const [showMeetEmbed, setShowMeetEmbed] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [hrMemberMap, setHrMemberMap] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<InterviewSummary | null>(null);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!applicationId || !interviewId) return;
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const appData = await getApplicationById(applicationId);
        const candidateId = appData?.candidateId || appData?.candidate_id || appData?.profiles?.id;
        if (!candidateId) {
          setError(tr("interview.notes.error.noCandidate", "Could not find the candidate for this application."));
          setLoading(false);
          return;
        }

        const history = await getCandidateInterviewHistory(candidateId);
        const found = history.find((row) => row.id === interviewId);
        if (!found) {
          setError(tr("interview.notes.error.notFound", "Interview not found in candidate history."));
          setLoading(false);
          return;
        }

        setInterview(found);

        const existingSummary = await getLatestInterviewSummary(interviewId);
        if (existingSummary) setSummary(existingSummary);

        const hrMembers = await getHRMembers();
        const map: Record<string, string> = {};
        hrMembers.forEach((m) => {
          if (m.userId) map[m.userId] = m.fullName || m.email || m.userId;
        });
        setHrMemberMap(map);

        setLoading(false);
      } catch (err) {
        console.error("Failed to load interview notes", err);
        setError(tr("interview.notes.error.load", "Failed to load notes."));
        setLoading(false);
      }

      if (interviewId) {
        setGeneratingQuestions(true);
        generateDuringInterviewQuestions(interviewId, { questionsCount: 6, locale }).then(rows => {
          if (rows.length > 0) setGeneratedQuestions(rows);
          setGeneratingQuestions(false);
        }).catch(() => {
          setGeneratingQuestions(false);
        });
      }
    };

    load();
  }, [applicationId, interviewId, user?.email]);

  if (!applicationId || !interviewId) {
    return null;
  }

  const legacyNotes = typeof interview?.notes === "string" ? interview.notes.trim() : "";

  const handleGenerateQuestions = async () => {
    if (!interviewId) return;
    setGeneratingQuestions(true);
    setError(null);
    try {
      const rows = await generateDuringInterviewQuestions(interviewId, { questionsCount: 6, locale });
      setGeneratedQuestions(rows);
      if (rows.length === 0) {
        setError(tr("interview.notes.questions.empty_result", "No questions could be generated."));
      } else {
        showSuccess(`${tr("interview.notes.questions.title", "Questions")}: ${rows.length}`);
      }
    } catch (err) {
      setError(tr("interview.notes.error.generate", "Failed to generate questions."));
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!interviewId) return;
    setGeneratingSummary(true);
    setError(null);
    try {
      const result = await generateInterviewSummary(interviewId);
      if (result) setSummary(result);
    } catch {
      setError(tr("interview.notes.error.summary", "Failed to generate AI summary."));
    } finally {
      setGeneratingSummary(false);
    }
  };

  const recommendationColors: Record<string, string> = {
    STRONG_YES: "bg-emerald-500/20 text-emerald-400",
    YES: "bg-green-500/20 text-green-400",
    MIXED: "bg-yellow-500/20 text-yellow-400",
    NEUTRAL: "bg-yellow-500/20 text-yellow-400",
    NO: "bg-red-500/20 text-red-400",
    STRONG_NO: "bg-red-700/20 text-red-500",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={ROUTES.company.recruitment.interviews}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          <ArrowLeft className="w-4 h-4" />
          {tr("interview.notes.backToInterviews", "Back to interviews")}
        </Link>
        <Link
          href={appInterviewReschedulePath(applicationId as string, interviewId as string)}
          className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          {tr("interview.notes.reschedule", "Reschedule")}
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center space-y-3">
            <Loader className="w-8 h-8 text-[var(--accent)] animate-spin mx-auto" />
            <p className="text-[var(--text-muted)] text-sm font-medium">{tr("interview.notes.loading", "Loading notes...")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400 font-semibold">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6">
              <p className="text-sm text-emerald-400 font-semibold">{success}</p>
            </div>
          )}

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">
                  {tr("interview.notes.title", "Interview scorecard")}
                </h1>
                <p className="text-sm text-[var(--text-muted)]">{interview?.name || tr("interview.notes.interviewLabel", "Interview")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "interview.notes.status", "Status")}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {interview?.status
                    ? t(locale, `interviewer.status.${interview.status.toLowerCase()}`, interview.status)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "interview.notes.date", "Date")}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{formatDate(interview?.scheduledAt, locale)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(locale, "interview.notes.time", "Time")}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{formatTime(interview?.scheduledAt, locale)}</p>
              </div>
            </div>

            {interview?.meetingLink && (
              <div className="pt-2">
                {showMeetEmbed ? (
                  <Suspense fallback={<div className="h-10 text-xs text-[var(--text-muted)]">{tr("interview.jitsi.joining", "Connexion…")}</div>}>
                    <JitsiEmbed
                      meetingUrl={interview.meetingLink}
                      displayName={user?.email ?? tr("interview.scheduler.hrLabel", "Recruteur")}
                      onClose={() => setShowMeetEmbed(false)}
                    />
                  </Suspense>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMeetEmbed(true)}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_4px_16px_oklch(65%_0.22_42_/_0.3)]"
                  >
                    <Video className="w-4 h-4" />
                    {tr("interview.scheduler.joinMeeting", "Rejoindre l'entretien")}
                  </button>
                )}
              </div>
            )}
          </div>

          {interview?.participants && interview.participants.length > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{tr("interview.notes.interviewers", "Interviewers")}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {interview.participants.map((p: any, idx: number) => {
                  const name = hrMemberMap[p.userId] || p.userId?.slice(0, 8) || `Intervenant ${idx + 1}`;
                  const role = (p.role ?? "MANDATORY") as string;
                  const weight = p.evaluationWeight ?? p.weight ?? 0;
                  return (
                    <div key={p.userId || idx} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {role === "MANDATORY"
                            ? tr("interview.notes.interviewerRole.mandatory", "Mandatory")
                            : tr("interview.notes.interviewerRole.secondary", "Secondary")}
                          {weight > 0 && ` · ${weight}%`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        role === "MANDATORY"
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "bg-blue-400/10 text-blue-400"
                      }`}>
                        {role === "MANDATORY"
                          ? tr("interview.notes.interviewerRole.mandatoryShort", "REQ")
                          : tr("interview.notes.interviewerRole.secondaryShort", "OBS")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">{tr("interview.notes.textNotes", "Interview notes (text)")}</h2>
            {legacyNotes ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-4 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                {legacyNotes}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">{tr("interview.notes.noTextNotes", "No text notes recorded for this interview.")}</p>
            )}
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{tr("interview.notes.questions.title", "Interview questions")}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {tr("interview.notes.questions.desc", "Generate a pack of contextual questions to guide note-taking during the interview.")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateQuestions}
                disabled={generatingQuestions}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent)]-soft disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {generatingQuestions
                  ? tr("interview.notes.questions.generating", "Generating...")
                  : tr("interview.notes.questions.generate", "Generate questions")}
              </button>
            </div>

            {generatedQuestions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">{tr("interview.notes.questions.empty", "No questions generated yet.")}</p>
            ) : (
              <div className="space-y-2">
                {generatedQuestions.map((q) => (
                  <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-3">
                    <p className="text-sm text-[var(--text-primary)] font-medium">{q.questionText}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Aptely AI · {hrMemberMap[q.interviewerId] || "Interviewer"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ScorecardPanel
            interviewId={interviewId}
            interviewerProfiles={interview?.participants?.map((p: any) => ({
              userId: p.userId,
              label: hrMemberMap[p.userId] || p.userId?.slice(0, 8) || "—",
              evaluationWeight: p.evaluationWeight ?? p.weight ?? 0,
              role: (p.role ?? "MANDATORY") as "MANDATORY" | "SECONDARY",
            }))}
            onError={setError}
            onSuccess={showSuccess}
          />

          <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{tr("interview.notes.summary.title", "AI Summary")}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {tr("interview.notes.summary.desc", "AI-generated post-interview summary and recommendation.")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={generatingSummary || interview?.status !== "COMPLETED"}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--accent)]-soft disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {generatingSummary
                  ? tr("interview.notes.summary.generating", "Generating...")
                  : summary
                  ? tr("interview.notes.summary.regenerate", "Regenerate")
                  : tr("interview.notes.summary.generate", "Generate summary")}
              </button>
            </div>

            {summary ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${recommendationColors[summary.recommendation] ?? "bg-[var(--bg-surface)] text-[var(--text-muted)]"}`}>
                    {summary.recommendation}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">Aptely AI</span>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-4 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {summary.content}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                {interview?.status !== "COMPLETED"
                  ? tr("interview.notes.summary.waiting", "Terminez l'entretien pour générer un résumé IA.")
                  : tr("interview.notes.summary.empty", "No summary generated yet.")}
              </p>
            )}
          </div>

          {interview?.status === "COMPLETED" ? (
            <FinalDecisionSection applicationId={applicationId as string} />
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex items-center gap-3">
              <Mail className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
              <p className="text-sm text-[var(--text-muted)]">
                {tr("interview.notes.decision.availableAfter", "Les options d'envoi d'email d'acceptation ou de refus au candidat seront disponibles une fois l'entretien terminé.")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
