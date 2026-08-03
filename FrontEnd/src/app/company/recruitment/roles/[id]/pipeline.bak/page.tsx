"use client";
import { ROUTES, appInterviewPath, rolePath } from "@/lib/routes";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Loader2, Users, Calendar, BarChart2,
  ChevronDown, ChevronUp, Settings, Zap, Lock, Unlock,
  Mail, CheckCircle2, XCircle, AlertCircle, Clock, Layers,
  RefreshCcw, Trash2, MoreVertical, UserPlus, Search,
} from "lucide-react";
import Link from "next/link";
import { getRoleById, getApplicationsByRole } from "@/lib/api";
import type { Role, Application } from "@/lib/api";
import { useRequireInstitution } from "@/lib/auth";
import { getClientLocale, t, Locale } from "@/lib/i18n";
import Modal from "@/components/ui/Modal";
import Button from "@/components/Button";
import {
  listWavesForRole,
  listWaveCandidates,
  createWave,
  updateWave,
  deleteWave,
  updateWaveCandidateStatus,
  getWaveAnalytics,
  listWaveTemplates,
  inviteCandidatesToWave,
  generateWaveSlots,
  type Wave,
  type WaveCandidate,
  type WaveAnalytics,
  type WaveTemplate,
} from "@/lib/api.waves";

// ─── Config ───────────────────────────────────────────────────────────────────

function getWaveStatusCfg(locale: Locale): Record<string, { label: string; cls: string; dot: string }> {
  return {
    DRAFT:     { label: t(locale, "pipeline.status.draft", "Draft"),      cls: "bg-zinc-400/10 text-zinc-400 border-zinc-400/20",    dot: "bg-zinc-400" },
    ACTIVE:    { label: t(locale, "pipeline.status.active", "Active"),    cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", dot: "bg-emerald-400" },
    CLOSED:    { label: t(locale, "pipeline.status.closed", "Closed"),    cls: "bg-amber-400/10 text-amber-400 border-amber-400/20",  dot: "bg-amber-400" },
    CANCELLED: { label: t(locale, "pipeline.status.cancelled", "Cancelled"), cls: "bg-red-400/10 text-red-400 border-red-400/20",     dot: "bg-red-400" },
  };
}

function getCandidateStatusCfg(locale: Locale): Record<string, { label: string; cls: string }> {
  return {
    INVITED:   { label: t(locale, "pipeline.candidateStatus.invited", "Invited"),     cls: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
    BOOKED:    { label: t(locale, "pipeline.candidateStatus.booked", "Booked"),       cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
    NO_SHOW:   { label: t(locale, "pipeline.candidateStatus.noShow", "No-show"),      cls: "bg-red-400/10 text-red-400 border-red-400/20" },
    PASSED:    { label: t(locale, "pipeline.candidateStatus.passed", "Passed"),       cls: "bg-green-400/10 text-green-400 border-green-400/20" },
    FAILED:    { label: t(locale, "pipeline.candidateStatus.failed", "Failed"),       cls: "bg-rose-400/10 text-rose-400 border-rose-400/20" },
    WITHDRAWN: { label: t(locale, "pipeline.candidateStatus.withdrawn", "Withdrawn"), cls: "bg-zinc-400/10 text-zinc-400 border-zinc-400/20" },
  };
}

const CANDIDATE_STATUS_OPTIONS = ["INVITED", "BOOKED", "NO_SHOW", "PASSED", "FAILED", "WITHDRAWN"] as const;

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-400/10 text-blue-400 border-blue-400/20",
  "bg-purple-400/10 text-purple-400 border-purple-400/20",
  "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  "bg-amber-400/10 text-amber-400 border-amber-400/20",
  "bg-rose-400/10 text-rose-400 border-rose-400/20",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CandidateCard({
  candidate,
  locale,
  onStatusChange,
}: {
  candidate: WaveCandidate;
  locale: Locale;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const CANDIDATE_STATUS_CFG = getCandidateStatusCfg(locale);
  const statusCfg = CANDIDATE_STATUS_CFG[candidate.status] ?? CANDIDATE_STATUS_CFG.INVITED;
  const colorIdx = (candidate.candidateName ?? "").length % AVATAR_COLORS.length;

  return (
    <div className="relative bg-[var(--bg-surface)]/60 border border-[var(--border)] rounded-xl p-3 space-y-2 hover:border-[var(--border)]/80 transition-colors group">
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${AVATAR_COLORS[colorIdx]}`}>
          {getInitials(candidate.candidateName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
            {candidate.candidateName ?? t(locale, "pipeline.candidate.fallback", "Candidate")}
          </p>
          {candidate.candidateEmail && (
            <p className="text-[11px] text-[var(--text-muted)] truncate">{candidate.candidateEmail}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>
          {statusCfg.label}
        </span>
        {candidate.bookingId && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
            <Calendar className="w-2.5 h-2.5" /> {t(locale, "pipeline.wave.booked", "Booked")}
          </span>
        )}
        {candidate.forceAdded && (
          <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5" /> {t(locale, "pipeline.wave.forced", "Forced")}
          </span>
        )}
      </div>

      {showMenu && (
        <div className="absolute right-0 top-8 z-20 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl p-1.5 min-w-36">
          <p className="text-[10px] font-bold text-[var(--text-muted)] px-2 py-1 uppercase tracking-wide">{t(locale, "pipeline.wave.changeStatus", "Change status")}</p>
          {CANDIDATE_STATUS_OPTIONS.map((s) => {
            const cfg = CANDIDATE_STATUS_CFG[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onStatusChange(candidate.id, s); setShowMenu(false); }}
                className={`w-full text-left text-[11px] font-bold px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface)] ${candidate.status === s ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
              >
                {cfg.label}
              </button>
            );
          })}
          <div className="border-t border-[var(--border)] mt-1 pt-1">
            <Link
              href={appInterviewPath(candidate.applicationId)}
              className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1.5 rounded-lg transition-colors"
              onClick={() => setShowMenu(false)}
            >
              <Calendar className="w-3 h-3" /> {t(locale, "pipeline.wave.viewInterview", "View interview")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invite candidates modal ──────────────────────────────────────────────────

function InviteCandidatesModal({
  wave,
  roleId,
  existingIds,
  locale,
  onClose,
  onInvited,
}: {
  wave: Wave;
  roleId: string;
  existingIds: Set<string>;
  locale: Locale;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    getApplicationsByRole(roleId, 1, 200)
      .then((res) => setApps(res.data.filter((a) => a.status === "VALIDATED" && !existingIds.has(a.applicationId))))
      .finally(() => setLoading(false));
  }, [roleId, existingIds]);

  const filtered = apps.filter((a) => {
    const q = query.toLowerCase();
    return !q || (a.candidateName ?? "").toLowerCase().includes(q);
  });

  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleInvite = async () => {
    if (!selected.size) return;
    setInviting(true);
    const res = await inviteCandidatesToWave(wave.id, Array.from(selected), { sendEmail: true });
    if (res) {
      setFeedback(t(locale, "pipeline.invite.success", "{{n}} candidat(s) invité(s) !", { n: res.invited }));
      setTimeout(() => { onInvited(); onClose(); }, 1200);
    } else {
      setFeedback(t(locale, "pipeline.invite.error", "Erreur lors de l'invitation."));
    }
    setInviting(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t(locale, "pipeline.invite.title", "Inviter dans la vague")}
      description={wave.name}
      footer={
        <div className="w-full space-y-2">
          {feedback && <p className="text-xs text-center text-emerald-400">{feedback}</p>}
          <Button
            variant="primary"
            onClick={handleInvite}
            disabled={!selected.size || inviting}
            isLoading={inviting}
            className="w-full"
          >
            {inviting
              ? t(locale, "pipeline.invite.inviting", "Invitation en cours...")
              : t(locale, "pipeline.invite.button", "Inviter {{n}} candidat(s)", { n: selected.size || "" })}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(locale, "pipeline.invite.search", "Rechercher un candidat...")}
            className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
          />
        </div>

        <div className="space-y-1">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-muted)] py-6">{t(locale, "pipeline.invite.empty", "Aucun candidat VALIDÉ disponible.")}</p>
          ) : filtered.map((app) => (
            <button
              key={app.applicationId}
              type="button"
              onClick={() => toggle(app.applicationId)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                selected.has(app.applicationId)
                  ? "bg-[var(--accent-dim)] border border-[var(--accent)]/30"
                  : "hover:bg-[var(--bg-raised)] border border-transparent"
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                selected.has(app.applicationId) ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border)]"
              }`}>
                {(app.candidateName ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{app.candidateName ?? t(locale, "pipeline.candidate.fallback", "Candidate")}</p>
                {app.matchScore != null && (
                  <p className="text-[10px] text-[var(--text-muted)]">{Math.round(app.matchScore > 1 ? app.matchScore : app.matchScore * 100)}% match</p>
                )}
              </div>
              {selected.has(app.applicationId) && <CheckCircle2 className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />}
            </button>
          ))}
        </div>

      </div>
    </Modal>
  );
}

function WaveColumn({
  wave,
  allWaves,
  candidates,
  analytics,
  loadingCandidates,
  locale,
  roleId,
  onStatusChange,
  onUpdateWave,
  onDeleteWave,
  onInvited,
  onRefresh,
  fullWidth = false,
}: {
  wave: Wave;
  allWaves: Wave[];
  candidates: WaveCandidate[];
  analytics: WaveAnalytics | null;
  loadingCandidates: boolean;
  locale: Locale;
  roleId: string;
  onStatusChange: (waveId: string, candidateId: string, status: string) => void;
  onUpdateWave: (waveId: string, patch: Partial<Wave>) => void;
  onDeleteWave: (waveId: string) => void;
  onInvited: (waveId: string) => void;
  onRefresh: () => void;
  fullWidth?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const existingIds = new Set(candidates.map((c) => c.applicationId).filter(Boolean) as string[]);
  const WAVE_STATUS_CFG = getWaveStatusCfg(locale);
  const wsCfg = WAVE_STATUS_CFG[wave.status] ?? WAVE_STATUS_CFG.DRAFT;

  const prerequisiteWave = wave.prerequisiteWaveId
    ? allWaves.find((w) => w.id === wave.prerequisiteWaveId)
    : null;

  return (
    <>
    <div className={`${fullWidth ? "w-full" : "flex-shrink-0 w-72"} flex flex-col bg-[var(--bg-surface)]/40 border border-[var(--border)] rounded-2xl overflow-hidden`}>
      {/* Column header */}
      <div className="p-4 border-b border-[var(--border)] space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${wsCfg.dot}`} />
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${wsCfg.cls}`}>
                {wsCfg.label}
              </span>
              {prerequisiteWave && (
                <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5" title={`${t(locale, "pipeline.wave.prerequisite", "Prerequisite")}: ${prerequisiteWave.name}`}>
                  <Lock className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{wave.name}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
              title={t(locale, "pipeline.invite.buttonTitle", "Inviter des candidats")}
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSlotModal(true)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors"
              title={t(locale, "pipeline.slots.generate", "Générer des créneaux")}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {wave.candidateCount ?? 0}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {wave.slotCount ?? 0} {t(locale, "pipeline.slots", "slots")}</span>
          {analytics && (
            <span className="flex items-center gap-1 text-emerald-400">
              <BarChart2 className="w-3 h-3" />
              {Math.round(analytics.slots.fillRate * 100)}%
            </span>
          )}
        </div>

        {/* Booking window */}
        {(wave.bookingOpenAt || wave.bookingCloseAt) && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Clock className="w-2.5 h-2.5" />
            {wave.bookingOpenAt && (
              <span>{t(locale, "pipeline.wave.bookingOpen", "Booking open")}: {new Date(wave.bookingOpenAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}</span>
            )}
            {wave.bookingCloseAt && (
              <span> — {t(locale, "pipeline.wave.bookingClose", "Booking close")}: {new Date(wave.bookingCloseAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}</span>
            )}
          </div>
        )}

        {/* Auto-place badge */}
        {wave.autoPlaceOnMatch && (
          <div className="flex items-center gap-1 text-[10px] text-purple-400">
            <Zap className="w-2.5 h-2.5" />
            {t(locale, "pipeline.wave.autoPlacement", "Auto-placement")} ≥ {wave.autoPlaceThreshold ?? 0}%
          </div>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div className="bg-app-bg border border-[var(--border)] rounded-xl p-3 space-y-2.5 mt-1">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{t(locale, "pipeline.wave.waveStatus", "Wave status")}</p>
            <div className="grid grid-cols-2 gap-1">
              {(["DRAFT", "ACTIVE", "CLOSED", "CANCELLED"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdateWave(wave.id, { status: s })}
                  disabled={wave.status === s}
                  className={`text-[10px] font-bold py-1 px-2 rounded-lg border transition-all ${
                    wave.status === s
                      ? `${WAVE_STATUS_CFG[s].cls} cursor-default`
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]/80"
                  }`}
                >
                  {WAVE_STATUS_CFG[s].label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { if (window.confirm(t(locale, "pipeline.wave.deleteConfirm", "Delete wave \"{{name}}\"?", { name: wave.name }))) onDeleteWave(wave.id); }}
              className="w-full flex items-center gap-1.5 text-[11px] text-red-400 hover:bg-red-400/10 px-2 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" /> {t(locale, "pipeline.wave.deleteWave", "Delete wave")}
            </button>
          </div>
        )}
      </div>

      {/* Candidates list */}
      {!collapsed && (
        <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[520px] scrollbar-hide">
          {loadingCandidates ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-6 text-center">
              <Users className="w-5 h-5 text-[var(--text-muted)] mx-auto mb-1" />
              <p className="text-[11px] text-[var(--text-muted)]">{t(locale, "pipeline.wave.noCandidate", "No candidate")}</p>
            </div>
          ) : (
            candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                locale={locale}
                onStatusChange={(id, status) => onStatusChange(wave.id, id, status)}
              />
            ))
          )}
        </div>
      )}
    </div>
    {showInviteModal && (
      <InviteCandidatesModal
        wave={wave}
        roleId={roleId}
        existingIds={existingIds}
        locale={locale}
        onClose={() => setShowInviteModal(false)}
        onInvited={() => { onInvited(wave.id); setShowInviteModal(false); }}
      />
    )}
    {showSlotModal && (
      <GenerateSlotsModal
        wave={wave}
        locale={locale}
        onClose={() => setShowSlotModal(false)}
        onGenerated={() => { onRefresh(); setShowSlotModal(false); }}
      />
    )}
    </>
  );
}

// ─── Generate Slots Modal ──────────────────────────────────────────────────────

function GenerateSlotsModal({
  wave,
  locale,
  onClose,
  onGenerated,
}: {
  wave: Wave;
  locale: Locale;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!startDate || !endDate) { setError(t(locale, "pipeline.slots.error.dates", "Start and end dates required.")); return; }
    setGenerating(true);
    setError(null);
    const res = await generateWaveSlots(wave.id, {
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      dailyStartTime: dailyStart,
      dailyEndTime: dailyEnd,
      slotDurationMinutes: duration,
      capacity,
    });
    setGenerating(false);
    if (res) {
      setResult(res.count);
      setTimeout(() => { onGenerated(); }, 1500);
    } else {
      setError(t(locale, "pipeline.slots.error.generate", "Generation failed. Please retry."));
    }
  };

  return (
    <Modal open onClose={onClose} size="md" title={t(locale, "pipeline.slots.generate", "Generate Slots")}>
      <div className="space-y-4">
        {result !== null ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-[var(--text-primary)]">{t(locale, "pipeline.slots.generated", "{{count}} slots created!", { count: result })}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.slots.startDate", "Start date")}</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.slots.endDate", "End date")}</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.slots.dailyStart", "Daily start")}</label>
                <input type="time" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.slots.dailyEnd", "Daily end")}</label>
                <input type="time" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.slots.duration", "Duration (min)")}</label>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]">
                  {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.slots.capacity", "Capacity")}</label>
                <input type="number" min={1} max={20} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={generating}>Cancel</Button>
              <Button type="button" variant="primary" onClick={handleGenerate} className="flex-1" isLoading={generating}>Generate</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Create Wave Modal ────────────────────────────────────────────────────────

function CreateWaveModal({
  roleId,
  waves,
  templates,
  locale,
  onClose,
  onCreate,
}: {
  roleId: string;
  waves: Wave[];
  templates: WaveTemplate[];
  locale: Locale;
  onClose: () => void;
  onCreate: (wave: Wave) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [waveOrder, setWaveOrder] = useState(waves.length + 1);
  const [bookingOpenAt, setBookingOpenAt] = useState("");
  const [bookingCloseAt, setBookingCloseAt] = useState("");
  const [autoPlaceOnMatch, setAutoPlaceOnMatch] = useState(false);
  const [autoPlaceThreshold, setAutoPlaceThreshold] = useState(70);
  const [prerequisiteWaveId, setPrerequisiteWaveId] = useState("");
  const [forceAddAllowed, setForceAddAllowed] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTemplateSelect = (tid: string) => {
    setTemplateId(tid);
    if (tid) {
      const tpl = templates.find((t) => t.id === tid);
      if (tpl && !name) setName(tpl.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t(locale, "pipeline.createWave.error.nameRequired", "Name is required.")); return; }
    setSaving(true);
    setError(null);
    const wave = await createWave({
      roleId,
      name: name.trim(),
      description: description.trim() || undefined,
      waveOrder,
      templateId: templateId || undefined,
      bookingOpenAt: bookingOpenAt ? new Date(bookingOpenAt).toISOString() : undefined,
      bookingCloseAt: bookingCloseAt ? new Date(bookingCloseAt).toISOString() : undefined,
      autoPlaceOnMatch,
      autoPlaceThreshold: autoPlaceOnMatch ? autoPlaceThreshold : undefined,
      prerequisiteWaveId: prerequisiteWaveId || undefined,
      forceAddAllowed,
    });
    if (!wave) {
      setError(t(locale, "pipeline.createWave.error.createFailed", "Creation failed. Please retry."));
    } else {
      onCreate(wave);
    }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} size="md" title={t(locale, "pipeline.createWave.title", "New wave")}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.wave.template", "Template (optional)")}</label>
              <select
                value={templateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50"
              >
                <option value="">{t(locale, "pipeline.wave.noTemplate", "— No template —")}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.wave.name", "Name *")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(locale, "pipeline.wave.namePlaceholder", "e.g. Wave 1 — HR Interviews")}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50 placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.wave.description", "Description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t(locale, "pipeline.wave.descriptionPlaceholder", "Optional description...")}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50 placeholder:text-[var(--text-muted)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.wave.bookingOpen", "Booking open")}</label>
              <input
                type="datetime-local"
                value={bookingOpenAt}
                onChange={(e) => setBookingOpenAt(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.wave.bookingClose", "Booking close")}</label>
              <input
                type="datetime-local"
                value={bookingCloseAt}
                onChange={(e) => setBookingCloseAt(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.wave.order", "Order")}</label>
              <input
                type="number"
                min={1}
                value={waveOrder}
                onChange={(e) => setWaveOrder(Number(e.target.value))}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t(locale, "pipeline.wave.prerequisite", "Prerequisite")}</label>
              <select
                value={prerequisiteWaveId}
                onChange={(e) => setPrerequisiteWaveId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50"
              >
                <option value="">{t(locale, "pipeline.wave.none", "— None —")}</option>
                {waves.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 p-3 bg-[var(--bg-surface)]/50 border border-[var(--border)] rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">{t(locale, "pipeline.wave.autoPlacement", "Auto-placement")}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{t(locale, "pipeline.wave.autoPlacementDesc", "Automatically invite if AI score ≥ threshold")}</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoPlaceOnMatch((v) => !v)}
                className={`w-9 h-5 rounded-full border transition-all ${autoPlaceOnMatch ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-[var(--bg-surface)] border-[var(--border)]"}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform mx-auto ${autoPlaceOnMatch ? "translate-x-2" : "-translate-x-0"}`} />
              </button>
            </div>
            {autoPlaceOnMatch && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--text-muted)]">{t(locale, "pipeline.wave.threshold", "Threshold ({{value}}%)", { value: autoPlaceThreshold })}</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={autoPlaceThreshold}
                  onChange={(e) => setAutoPlaceThreshold(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-[var(--bg-surface)]/50 border border-[var(--border)] rounded-xl">
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">{t(locale, "pipeline.wave.forceAdd", "Force add allowed")}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{t(locale, "pipeline.wave.forceAddDesc", "Allow inviting without matching criteria")}</p>
            </div>
            <button
              type="button"
              onClick={() => setForceAddAllowed((v) => !v)}
              className={`w-9 h-5 rounded-full border transition-all ${forceAddAllowed ? "bg-[var(--accent)] border-[var(--accent)]" : "bg-[var(--bg-surface)] border-[var(--border)]"}`}
            >
              <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform mx-auto ${forceAddAllowed ? "translate-x-2" : "-translate-x-0"}`} />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={saving}>
              {t(locale, "pipeline.createWave.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              isLoading={saving}
              iconLeft={<Plus className="w-3.5 h-3.5" />}
              className="flex-1"
            >
              {t(locale, "pipeline.createWave.create", "Create wave")}
            </Button>
          </div>
        </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  useRequireInstitution();
  const locale = getClientLocale();
  const routeParams = useParams<{ id: string }>();
  const roleId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [candidatesMap, setCandidatesMap] = useState<Record<string, WaveCandidate[]>>({});
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, WaveAnalytics>>({});
  const [loadingCandidatesFor, setLoadingCandidatesFor] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<WaveTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeMobileWaveId, setActiveMobileWaveId] = useState<string | null>(null);

  const loadCandidatesForWave = useCallback(async (waveId: string) => {
    setLoadingCandidatesFor((prev) => new Set([...prev, waveId]));
    const [candidates, analytics] = await Promise.all([
      listWaveCandidates(waveId),
      getWaveAnalytics(waveId),
    ]);
    setCandidatesMap((prev) => ({ ...prev, [waveId]: candidates }));
    if (analytics) setAnalyticsMap((prev) => ({ ...prev, [waveId]: analytics }));
    setLoadingCandidatesFor((prev) => { const n = new Set(prev); n.delete(waveId); return n; });
  }, []);

  const loadAll = useCallback(async () => {
    const [roleData, wavesData, tplData] = await Promise.all([
      getRoleById(roleId),
      listWavesForRole(roleId),
      listWaveTemplates(),
    ]);
    setRole(roleData);
    setWaves(wavesData);
    setTemplates(tplData);
    // Load candidates for all waves in parallel
    await Promise.all(wavesData.map((w) => loadCandidatesForWave(w.id)));
    setLoading(false);
  }, [roleId, loadCandidatesForWave]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleStatusChange = async (waveId: string, candidateId: string, status: string) => {
    const updated = await updateWaveCandidateStatus(waveId, candidateId, status);
    if (updated) {
      setCandidatesMap((prev) => ({
        ...prev,
        [waveId]: (prev[waveId] ?? []).map((c) => c.id === candidateId ? { ...c, status } : c),
      }));
    }
  };

  const handleUpdateWave = async (waveId: string, patch: Partial<Wave>) => {
    const updated = await updateWave(waveId, patch);
    if (updated) {
      setWaves((prev) => prev.map((w) => w.id === waveId ? { ...w, ...updated } : w));
    }
  };

  const handleDeleteWave = async (waveId: string) => {
    const ok = await deleteWave(waveId);
    if (ok) {
      setWaves((prev) => prev.filter((w) => w.id !== waveId));
      setCandidatesMap((prev) => { const n = { ...prev }; delete n[waveId]; return n; });
    }
  };

  const handleInvited = (waveId: string) => {
    void loadCandidatesForWave(waveId);
  };

  const handleWaveCreated = (wave: Wave) => {
    setWaves((prev) => [...prev, wave]);
    setCandidatesMap((prev) => ({ ...prev, [wave.id]: [] }));
    setShowCreateModal(false);
    void loadCandidatesForWave(wave.id);
  };

  // ── Analytics summary across all waves
  const totalCandidates = waves.reduce((sum, w) => sum + (w.candidateCount ?? 0), 0);
  const totalSlots = waves.reduce((sum, w) => sum + (w.slotCount ?? 0), 0);
  const totalBooked = Object.values(analyticsMap).reduce((sum, a) => sum + a.slots.booked, 0);
  const avgFillRate = Object.values(analyticsMap).length > 0
    ? Object.values(analyticsMap).reduce((sum, a) => sum + a.slots.fillRate, 0) / Object.values(analyticsMap).length
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-surface)]/30 sticky top-0 z-10">
        <div className="max-w-full px-6 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(rolePath(roleId))}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--accent)]" />
              <h1 className="text-base font-bold text-[var(--text-primary)] truncate">
                {t(locale, "pipeline.title", "Pipeline — {{role}}", { role: role?.title ?? t(locale, "interview.scheduler.default.role", "Role") })}
              </h1>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{t(locale, "pipeline.waves", "{{count}} wave(s)", { count: waves.length })}</p>
          </div>

          {/* Summary stats */}
          <div className="hidden md:flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <strong className="text-[var(--text-secondary)]">{totalCandidates}</strong> {t(locale, "pipeline.candidates", "candidates")}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <strong className="text-[var(--text-secondary)]">{totalBooked}/{totalSlots}</strong> {t(locale, "pipeline.booked", "booked")}
            </span>
            {avgFillRate > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <BarChart2 className="w-3.5 h-3.5" />
                <strong>{Math.round(avgFillRate * 100)}%</strong> {t(locale, "pipeline.fillRate", "fill rate")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:bg-[var(--accent)]/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> {t(locale, "pipeline.newWave", "New wave")}
            </button>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="p-4 sm:p-6 overflow-x-auto">
        {waves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
              <Layers className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-base font-bold text-[var(--text-primary)]">{t(locale, "pipeline.noWaves.title", "No waves created")}</p>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">
              {t(locale, "pipeline.noWaves.subtitle", "Create your first recruitment wave to organize interviews by stages.")}
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-bold hover:bg-[var(--accent)]/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t(locale, "pipeline.createFirstWave", "Create first wave")}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop: side-by-side kanban */}
            <div className="hidden lg:flex gap-4 min-h-[600px] pb-4" style={{ minWidth: `${waves.length * 300}px` }}>
              {waves.map((wave) => (
                <WaveColumn
                  key={wave.id}
                  wave={wave}
                  allWaves={waves}
                  candidates={candidatesMap[wave.id] ?? []}
                  analytics={analyticsMap[wave.id] ?? null}
                  loadingCandidates={loadingCandidatesFor.has(wave.id)}
                  locale={locale}
                  roleId={roleId}
                  onStatusChange={handleStatusChange}
                  onUpdateWave={handleUpdateWave}
                  onDeleteWave={handleDeleteWave}
                  onInvited={handleInvited}
                  onRefresh={loadAll}
                />
              ))}
            </div>

            {/* Mobile: wave selector chips + single full-width column */}
            <div className="lg:hidden space-y-4">
              <div className="flex gap-2 overflow-x-auto snap-x-mandatory scrollbar-hide pb-1">
                {waves.map((wave) => {
                  const isActive = (activeMobileWaveId ?? waves[0]?.id) === wave.id;
                  const count = (candidatesMap[wave.id] ?? []).length;
                  return (
                    <button
                      key={wave.id}
                      type="button"
                      onClick={() => setActiveMobileWaveId(wave.id)}
                      className={`snap-start flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors ${isActive ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/40" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)]"}`}
                    >
                      {wave.name} <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const active = waves.find((w) => w.id === (activeMobileWaveId ?? waves[0]?.id)) ?? waves[0];
                if (!active) return null;
                return (
                  <WaveColumn
                    key={active.id}
                    wave={active}
                    allWaves={waves}
                    candidates={candidatesMap[active.id] ?? []}
                    analytics={analyticsMap[active.id] ?? null}
                    loadingCandidates={loadingCandidatesFor.has(active.id)}
                    locale={locale}
                    roleId={roleId}
                    onStatusChange={handleStatusChange}
                    onUpdateWave={handleUpdateWave}
                    onDeleteWave={handleDeleteWave}
                    onInvited={handleInvited}
                    onRefresh={loadAll}
                    fullWidth
                  />
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Create wave modal */}
      {showCreateModal && (
        <CreateWaveModal
          roleId={roleId}
          waves={waves}
          templates={templates}
          locale={locale}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleWaveCreated}
        />
      )}
    </div>
  );
}
