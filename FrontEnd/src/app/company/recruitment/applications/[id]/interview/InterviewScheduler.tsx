"use client";

import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
const JitsiEmbed = lazy(() => import("@/components/JitsiEmbed"));
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getClientLocale, t } from "@/lib/i18n";
import { getPersonalSettings } from "@/lib/api";
import InterviewHistory from "./InterviewHistory";
import { apiFetch } from "@/lib/apiHelper";
import { withTimeout } from "@/lib/retryApi";
import {
  assignInterviewers,
  createInterview,
  generateDuringInterviewQuestions,
  getHRMembers,
  getInterviewerQuestionPack,
  getDefaultInterviewQuestionTemplate,
  submitDebriefForm,
  InterviewerQuestionPack,
  getInterviewAvailability,
  InterviewSlot,
  notifyInterviewerQuestionPacks,
  scheduleInterview,
  getApplicationById,
  getCandidateInterviewHistory,
  getCandidateInterviewHistoryEnriched,
  getApplicationInterviewHistoryEnriched,
  type CandidateInterviewHistoryEnrichedItem,
} from "@/lib/api";
import {
  ArrowLeft,
  Video,
  MapPin,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Link2,
  Copy,
  ExternalLink,
  Loader,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Mail,
  Send,
  Info,
} from "lucide-react";
import {
  API,
  interviewBookPath,
  interviewConfirmSecondaryApi,
  absoluteUrl,
  interviewApiPath,
  interviewProposeWindowApi,
  interviewNotifyApi,
  appPath,
  interviewNotesPath,
} from "@/lib/routes";
import InterviewerPicker, { type InterviewerMember } from "@/components/InterviewerPicker";
import ScorecardTemplateEditor from "./ScorecardTemplateEditor";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface InterviewSchedulerProps {
  applicationId: string;
  mode?: "full" | "planning-only";
  backHref?: string;
  backLabel?: string;
  redirectAfterScheduleTo?: string;
  rescheduleInterviewId?: string;
}

type InterviewType = "REMOTE" | "IN_PERSON" | null;
type WizardStep = 1 | 2 | 3 | 4;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function participantInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?")[0].toUpperCase();
}

function participantLabel(name?: string, email?: string): string {
  return name && name.trim() ? name.trim() : (email ?? "");
}

function getDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstNonEmptyString(source: Record<string, unknown> | null, keys: string[]): string | null {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized.length > 0) return normalized;
  }

  return null;
}

function resolveRoleTitleFromApplication(appData: any): string | null {
  const appRecord = asRecord(appData);
  const roleRecord = asRecord(appRecord?.roles);
  const roleDnaRaw = Array.isArray(roleRecord?.role_dna) ? roleRecord?.role_dna[0] : roleRecord?.role_dna;
  const roleDna = asRecord(roleDnaRaw);
  const fullForm = asRecord(roleDna?.full_form_json);

  return (
    firstNonEmptyString(appRecord, ["roleTitle"]) ||
    firstNonEmptyString(roleRecord, ["title"]) ||
    firstNonEmptyString(fullForm, ["name_role", "title", "roleTitle", "jobTitle", "positionTitle"])
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return getDayKey(a) === getDayKey(b);
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  // pad with previous month days so the grid starts on Monday
  const paddingDays = startDay === 0 ? 6 : startDay - 1;
  for (let i = paddingDays; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }
  // pad to complete last week
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }
  return days;
}

/* ─── Duration Options ───────────────────────────────────────────────────── */

const DURATION_OPTIONS = [15, 30, 45, 60, 90];

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function InterviewScheduler({
  applicationId,
  mode = "full",
  backHref,
  backLabel,
  redirectAfterScheduleTo,
  rescheduleInterviewId,
}: InterviewSchedulerProps) {
  const router = useRouter();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  const durationOptions = [
    { value: 15, label: tr("interview.scheduler.duration.15.label", "15 min"), subtitle: tr("interview.scheduler.duration.15.subtitle", "Quick intro") },
    { value: 30, label: tr("interview.scheduler.duration.30.label", "30 min"), subtitle: tr("interview.scheduler.duration.30.subtitle", "Short meeting") },
    { value: 45, label: tr("interview.scheduler.duration.45.label", "45 min"), subtitle: tr("interview.scheduler.duration.45.subtitle", "Standard") },
    { value: 60, label: tr("interview.scheduler.duration.60.label", "1 hour"), subtitle: tr("interview.scheduler.duration.60.subtitle", "In-depth") },
    { value: 90, label: tr("interview.scheduler.duration.90.label", "1h 30"), subtitle: tr("interview.scheduler.duration.90.subtitle", "Deep-dive") },
  ];

  const weekDayLabels = [
    tr("interview.scheduler.weekday.mon", "Mon"),
    tr("interview.scheduler.weekday.tue", "Tue"),
    tr("interview.scheduler.weekday.wed", "Wed"),
    tr("interview.scheduler.weekday.thu", "Thu"),
    tr("interview.scheduler.weekday.fri", "Fri"),
    tr("interview.scheduler.weekday.sat", "Sat"),
    tr("interview.scheduler.weekday.sun", "Sun"),
  ];

  const statusLabel = (status: string) => {
    if (status === "SCHEDULED") return tr("interview.scheduler.status.scheduled", "Scheduled");
    if (status === "COMPLETED") return tr("interview.scheduler.status.completed", "Completed");
    if (status === "CANCELLED") return tr("interview.scheduler.status.cancelled", "Cancelled");
    if (status === "DRAFT") return tr("interview.scheduler.status.draft", "Draft");
    return status || tr("interview.scheduler.status.unknown", "Unknown");
  };

  const formatTime = useCallback((iso: string): string => {
    return new Date(iso).toLocaleTimeString(localeTag, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [localeTag]);

  const formatDate = useCallback((iso: string): string => {
    // YYYY-MM-DD keys must be parsed as local midnight, not UTC midnight
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00") : new Date(iso);
    return d.toLocaleDateString(localeTag, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [localeTag]);

  const planningOnly = mode === "planning-only";

  function distributeWeights<T extends { evaluationWeight: number }>(profiles: T[]): T[] {
    const n = profiles.length;
    if (n === 0) return profiles;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    return profiles.map((p, i) => ({ ...p, evaluationWeight: i === 0 ? base + remainder : base }));
  }
  // ── Wizard state ──
  const [step, setStep] = useState<WizardStep>(1);
  const [interviewType, setInterviewType] = useState<InterviewType>("REMOTE");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetingLocation, setMeetingLocation] = useState("");

  // ── Calendar navigation ──
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Interview data ──
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);
  const [showMeetEmbed, setShowMeetEmbed] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotAdjustMinutes, setSlotAdjustMinutes] = useState(0);
  const [bestSlotsOnly, setBestSlotsOnly] = useState(false);
  const [slots, setSlots] = useState<InterviewSlot[]>([]);

  // ── HR Members / Interviewers ──
  const [members, setMembers] = useState<InterviewerMember[]>([]);
  const [interviewName, setInterviewName] = useState("");
  const [interviewCategory, setInterviewCategory] = useState<string>("CUSTOM");
  const [customInterviewName, setCustomInterviewName] = useState("");
  const [interviewerProfiles, setInterviewerProfiles] = useState<Array<{ userId: string; profileText: string; evaluationWeight: number; role: "MANDATORY" | "SECONDARY" }>>([]);
  const [secondaryCollectiveWeight, setSecondaryCollectiveWeight] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [enrichedHistory, setEnrichedHistory] = useState<CandidateInterviewHistoryEnrichedItem[]>([]);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [selectedHistoryInterviewId, setSelectedHistoryInterviewId] = useState<string | null>(null);
  const [historySort, setHistorySort] = useState<"DATE_DESC" | "DATE_ASC" | "STATUS">("DATE_DESC");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"ALL" | "DRAFT" | "SCHEDULED" | "CANCELLED" | "COMPLETED">("ALL");

  // ── Working hours ──
  const [workingHoursStart, setWorkingHoursStart] = useState(9);
  const [workingHoursEnd, setWorkingHoursEnd] = useState(18);

  // ── Secondary participant selection ──
  const [selectedSecondaryUserId, setSelectedSecondaryUserId] = useState<string | null>(null);

  // ── Slot popover ──
  const [activeSlotPopover, setActiveSlotPopover] = useState<string | null>(null);

  // ── Google Calendar ──
  const [selectedMeetingProvider, setSelectedMeetingProvider] = useState<"GOOGLE_MEET" | "TEAMS" | "MANUAL" | "JITSI">("MANUAL");
  const [manualMeetingUrl, setManualMeetingUrl] = useState("");
  const [questionPackLoading, setQuestionPackLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(6);
  const [selectedInterviewerPackUserId, setSelectedInterviewerPackUserId] = useState<string | null>(null);
  const [questionPacksByInterviewer, setQuestionPacksByInterviewer] = useState<Record<string, InterviewerQuestionPack>>({});
  const [defaultQuestionTemplate, setDefaultQuestionTemplate] = useState<string>("");

  // ── Application context ──
  const [candidateName, setCandidateName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [canLeaveAfterConfirm, setCanLeaveAfterConfirm] = useState(true);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<"candidate" | "interviewer">("candidate");
  const [editedTemplateContent, setEditedTemplateContent] = useState<string>("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [templateInitialized, setTemplateInitialized] = useState<string | null>(null);
  const [sendingInterviewerQuestions, setSendingInterviewerQuestions] = useState(false);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );

  const adjustedSlotStart = useMemo(() => {
    if (!selectedSlot) return null;
    return new Date(new Date(selectedSlot).getTime() + slotAdjustMinutes * 60_000).toISOString();
  }, [selectedSlot, slotAdjustMinutes]);

  const isAdjustedOutsideWorkingHours = useMemo(() => {
    if (!adjustedSlotStart) return false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(adjustedSlotStart));
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "9", 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const startDecimal = hour + minute / 60;
    const endDecimal = startDecimal + durationMinutes / 60;
    return startDecimal < workingHoursStart || endDecimal > workingHoursEnd;
  }, [adjustedSlotStart, durationMinutes, workingHoursStart, workingHoursEnd]);

  /* ── Initial load ── */
  const loadInitialSchedulerData = useCallback(async () => {
      setLoading(true);
      setInitialLoadError(null);

      try {
        const [membersData, appData, personalPrefs] = await withTimeout(
          Promise.all([
            getHRMembers(),
            getApplicationById(applicationId),
            getPersonalSettings(),
          ]),
          12000,
          tr("interview.scheduler.error.loadTimeout", "Loading interview scheduler timed out")
        );

        setMembers(membersData.map((m) => ({
          userId: m.userId,
          email: m.email,
          fullName: m.fullName,
          roleSpecialization: m.roleSpecialization,
          roleCustomLabel: m.roleCustomLabel,
        })));

        if (appData) {
          const resolvedCandidateName = appData.candidateName || appData.guest_name || appData.profiles?.full_name || tr("interview.scheduler.default.candidate", "Candidate");
          const resolvedRoleTitle =
            resolveRoleTitleFromApplication(appData) || tr("common.roleToComplete", "Role to complete");
          setCandidateName(resolvedCandidateName);
          setRoleTitle(resolvedRoleTitle);
          setInterviewName(`${tr("interview.scheduler.default.interviewPrefix", "Interview")} ${resolvedCandidateName} - ${resolvedRoleTitle}`);

          const resolvedCandidateId = appData.candidateId || appData.candidate_id || appData.profiles?.id;
          if (resolvedCandidateId) {
            setCandidateId(resolvedCandidateId);
            const [h, enriched] = await withTimeout(
              Promise.all([
                getCandidateInterviewHistory(resolvedCandidateId),
                getCandidateInterviewHistoryEnriched(resolvedCandidateId),
              ]),
              12000,
              tr("interview.scheduler.error.historyTimeout", "Loading candidate interview history timed out")
            );

            const sortedEnriched = [...enriched].sort((a, b) => {
              const aDate = new Date(a.interview.scheduledAt || a.interview.createdAt || 0).getTime();
              const bDate = new Date(b.interview.scheduledAt || b.interview.createdAt || 0).getTime();
              return bDate - aDate;
            });

            setHistory(h);
            setEnrichedHistory(sortedEnriched);
            if (sortedEnriched.length > 0) {
              setSelectedHistoryInterviewId((prev) => prev || sortedEnriched[0].interview.id);
            }
          } else {
            const enriched = await withTimeout(
              getApplicationInterviewHistoryEnriched(applicationId),
              12000,
              tr("interview.scheduler.error.historyTimeoutGeneric", "Loading interview history timed out")
            );
            const sortedEnriched = [...enriched].sort((a, b) => {
              const aDate = new Date(a.interview.scheduledAt || a.interview.createdAt || 0).getTime();
              const bDate = new Date(b.interview.scheduledAt || b.interview.createdAt || 0).getTime();
              return bDate - aDate;
            });

            setHistory(sortedEnriched.map((item) => item.interview));
            setEnrichedHistory(sortedEnriched);
            if (sortedEnriched.length > 0) {
              setSelectedHistoryInterviewId((prev) => prev || sortedEnriched[0].interview.id);
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : tr("interview.scheduler.error.loadFailed", "Unable to load interview scheduler");
        setInitialLoadError(message);
      } finally {
        setLoading(false);
      }
    }, [applicationId]);

  useEffect(() => {
    loadInitialSchedulerData();
  }, [loadInitialSchedulerData]);

  useEffect(() => {
    if (interviewId) {
      setSelectedHistoryInterviewId(interviewId);
    }
  }, [interviewId]);

  // Pre-fill wizard from existing interview when rescheduling
  useEffect(() => {
    if (!rescheduleInterviewId || loading) return;
    const loadReschedule = async () => {
      try {
        const data = await apiFetch(interviewApiPath(rescheduleInterviewId), "HR", { method: "GET", cache: "no-store" });
        const iv = data?.data ?? data;
        if (!iv) return;
        if (iv.name) setInterviewName(iv.name);
        if (iv.durationMinutes) setDurationMinutes(iv.durationMinutes);
        if (iv.interviewType) setInterviewType(iv.interviewType);
        if (iv.meetingProvider) setSelectedMeetingProvider(iv.meetingProvider);
        if (iv.meetingLink) setMeetingLink(iv.meetingLink);
        if (iv.scheduledAt) { setScheduledAt(iv.scheduledAt); setStep(4); return; } // already scheduled — show step 4 with join button
        if (iv.interviewers?.length > 0) {
          setInterviewerProfiles(
            iv.interviewers.map((iv: { userId: string; role?: string; evaluationWeight?: number }) => ({
              userId: iv.userId,
              profileText: "",
              evaluationWeight: iv.evaluationWeight ?? 50,
              role: (iv.role ?? "MANDATORY") as "MANDATORY" | "SECONDARY",
            }))
          );
        }
        // Jump to step 2 (date selection) — keep existing setup pre-filled
        setStep(2);
      } catch { /* ignore */ }
    };
    void loadReschedule();
  }, [rescheduleInterviewId, loading]);

  /* ── Calendar data ── */
  const monthDays = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);

  const slotsGroupedByDate = useMemo(() => {
    const map: Record<string, InterviewSlot[]> = {};
    slots.forEach((slot) => {
      const key = getDayKey(new Date(slot.start));
      if (!map[key]) map[key] = [];
      map[key].push(slot);
    });
    return map;
  }, [slots]);

  const selectedDateSlots = useMemo(() => {
    if (!selectedDate) return [];
    const raw = slotsGroupedByDate[selectedDate] ?? [];
    if (!bestSlotsOnly) return raw;
    return raw.filter((s) => {
      const avail = s.availableMandatory ?? s.availableParticipants ?? [];
      const unavail = s.unavailableMandatory ?? s.unavailableParticipants ?? [];
      const total = avail.length + unavail.length;
      return total === 0 || avail.length === total;
    });
  }, [slotsGroupedByDate, selectedDate, bestSlotsOnly]);

  // Auto-select single secondary participant when slot is selected
  useEffect(() => {
    if (!selectedSlot) {
      setSelectedSecondaryUserId(null);
      return;
    }
    const sel = selectedDateSlots.find(s => s.start === selectedSlot);
    const availSec = sel?.availableSecondary ?? [];
    if (availSec.length === 1) {
      setSelectedSecondaryUserId(availSec[0].userId);
    } else {
      setSelectedSecondaryUserId(null);
    }
  }, [selectedSlot, selectedDateSlots]);

  const datesWithSlots = useMemo(() => {
    return new Set(Object.keys(slotsGroupedByDate));
  }, [slotsGroupedByDate]);

  const filteredHistory = useMemo(() => {
    if (historyStatusFilter === "ALL") return history;
    return history.filter((row) => row?.status === historyStatusFilter);
  }, [history, historyStatusFilter]);

  const sortedHistory = useMemo(() => {
    const sorted = [...filteredHistory];
    const getDateValue = (row: any) => {
      const date = row?.scheduledAt || row?.createdAt;
      const time = date ? new Date(date).getTime() : 0;
      return Number.isNaN(time) ? 0 : time;
    };

    if (historySort === "STATUS") {
      return sorted.sort((a, b) => String(a?.status || "").localeCompare(String(b?.status || "")));
    }

    const dir = historySort === "DATE_ASC" ? 1 : -1;
    return sorted.sort((a, b) => (getDateValue(a) - getDateValue(b)) * dir);
  }, [filteredHistory, historySort]);

  const refreshInterviewHistory = useCallback(async (overrideCandidateId?: string) => {
    const targetCandidateId = overrideCandidateId ?? candidateId;
    const [h, enriched] = targetCandidateId
      ? await Promise.all([
          getCandidateInterviewHistory(targetCandidateId),
          getCandidateInterviewHistoryEnriched(targetCandidateId),
        ])
      : await Promise.all([
          getApplicationInterviewHistoryEnriched(applicationId).then((items) => items.map((item) => item.interview)),
          getApplicationInterviewHistoryEnriched(applicationId),
        ]);

    const sortedEnriched = [...enriched].sort((a, b) => {
      const aDate = new Date(a.interview.scheduledAt || a.interview.createdAt || 0).getTime();
      const bDate = new Date(b.interview.scheduledAt || b.interview.createdAt || 0).getTime();
      return bDate - aDate;
    });

    setHistory(h);
    setEnrichedHistory(sortedEnriched);
    setSelectedHistoryInterviewId((prev) => prev ?? sortedEnriched[0]?.interview.id ?? null);
  }, [applicationId, candidateId]);

  /* ── API Calls ── */

  const loadAvailability = useCallback(
    async (overrideId?: string) => {
      const targetId = overrideId ?? interviewId;
      if (!targetId) return;

      const inThreeWeeks = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
      const data = await getInterviewAvailability(targetId, {
        from: new Date().toISOString(),
        to: inThreeWeeks.toISOString(),
        slotMinutes: durationMinutes,
        timezone,
        workingHoursStart,
        workingHoursEnd,
      });

      setSlots(data.slots);
      return data.slots;
    },
    [interviewId, timezone, durationMinutes, workingHoursStart, workingHoursEnd]
  );

  const loadInterviewerPack = useCallback(async (userId: string, targetInterviewId?: string) => {
    const interviewTarget = targetInterviewId ?? interviewId;
    if (!interviewTarget) return;

    const pack = await getInterviewerQuestionPack(interviewTarget, userId);
    if (!pack) return;

    setQuestionPacksByInterviewer((prev) => ({ ...prev, [userId]: pack }));
    setSelectedInterviewerPackUserId(userId);
  }, [interviewId]);

  const loadDefaultTemplate = useCallback(async () => {
    const tpl = await getDefaultInterviewQuestionTemplate();
    if (tpl?.markdownContent) {
      setDefaultQuestionTemplate(tpl.markdownContent);
    }
  }, []);

  const initializeInterview = async () => {
    // Rebuild trigger
    setSaving(true);
    setError(null);

    if (interviewerProfiles.length > 0) {
      const mandatory = interviewerProfiles.filter(p => (p.role ?? "MANDATORY") === "MANDATORY");
      const secondary = interviewerProfiles.filter(p => p.role === "SECONDARY");
      const mandatorySum = mandatory.reduce((acc, p) => acc + p.evaluationWeight, 0);
      const scw = secondary.length > 0 ? secondaryCollectiveWeight : 0;

      if (Math.abs(mandatorySum + scw - 100) > 0.01) {
        setError(tr(
          "interview.scheduler.error.weightSum",
          `Weights must total 100%. Currently: ${mandatorySum} (mandatory) + ${scw} (secondary collective) = ${mandatorySum + scw}%`
        ));
        setSaving(false);
        return;
      }
    }

    const secondaryProfiles = interviewerProfiles.filter(p => p.role === "SECONDARY");
    const resolvedName = interviewName || (interviewCategory === "CUSTOM" && customInterviewName.trim() ? customInterviewName.trim() : tr("interview.scheduler.default.interviewPrefix", "Interview"));
    const created = await createInterview({
      applicationId,
      name: resolvedName,
      interviewType: interviewCategory,
      durationMinutes,
      timezone,
      meetingProvider: interviewType === "REMOTE" ? selectedMeetingProvider : "MANUAL",
      interviewerProfiles: interviewerProfiles.length > 0
        ? interviewerProfiles.map(p => ({
            ...p,
            evaluationWeight: p.role === "SECONDARY" ? 0 : p.evaluationWeight,
          }))
        : undefined,
      secondaryCollectiveWeight: secondaryProfiles.length > 0 ? secondaryCollectiveWeight : null,
    });

    if (!created) {
      setError(tr("interview.scheduler.error.create", "Failed to create interview. Please try again."));
      setSaving(false);
      return;
    }

    setInterviewId(created.id);
    setBookingToken(created.bookingToken ?? null);
    // Don't set scheduledAt/meetingLink yet to avoid jumping steps
    
    // Load available slots
    await loadAvailability(created.id);
    await loadDefaultTemplate();
    await refreshInterviewHistory();
    setSaving(false);
    
    // Always move to Step 2
    setStep(2);
  };

  const confirmSchedule = async () => {
    if (!interviewId || !adjustedSlotStart || saving) return;
    setSaving(true);
    setError(null);

    // Auto-pick single secondary when no explicit radio selection was made
    let effectiveSecondaryUserId = selectedSecondaryUserId;
    if (!effectiveSecondaryUserId && selectedSlot) {
      const selSlot = selectedDateSlots.find(s => s.start === selectedSlot);
      const availSec = selSlot?.availableSecondary ?? [];
      if (availSec.length === 1) effectiveSecondaryUserId = availSec[0].userId;
    }

    if (effectiveSecondaryUserId) {
      const confirmRes = await apiFetch(
        interviewConfirmSecondaryApi(interviewId),
        "HR",
        {
          method: "PATCH",
          body: JSON.stringify({ userId: effectiveSecondaryUserId }),
        }
      );
      if (!confirmRes || (confirmRes as { isAuthError?: boolean }).isAuthError) {
        setError(tr("interview.scheduler.error.confirmSecondary", "Failed to confirm secondary participant."));
        setSaving(false);
        return;
      }
    }

    const scheduled = await scheduleInterview(interviewId, {
      start: adjustedSlotStart,
      timezone,
      meetingLocation: interviewType === "IN_PERSON" ? meetingLocation.trim() : undefined,
      manualMeetingUrl: (selectedMeetingProvider === "MANUAL" && interviewType === "REMOTE" && manualMeetingUrl.trim())
        ? manualMeetingUrl.trim()
        : undefined,
    });

    if (!scheduled) {
      setError(tr("interview.scheduler.error.schedule", "Failed to schedule interview. Please try again."));
      setSaving(false);
      return;
    }

    setScheduledAt(scheduled.scheduledAt ?? selectedSlot);
    setMeetingLink(scheduled.meetingLink ?? null);
    setMeetingLocation(scheduled.meetingLocation ?? meetingLocation);

    // Emails are sent manually by HR via the notification panel below (step 4)
    setSuccess(tr("interview.scheduler.success.scheduledNoNotify", "Interview scheduled successfully."));
    setStep(4);
    await refreshInterviewHistory();
    setSaving(false);

    if (planningOnly) {
      setCanLeaveAfterConfirm(false);
      setTimeout(() => setCanLeaveAfterConfirm(true), 700);
    }
  };

  const saveInterviewers = async () => {
    if (!interviewId) return;
    setSaving(true);
    setError(null);

    const secondaryProfiles = interviewerProfiles.filter(p => p.role === "SECONDARY");
    const updated = await assignInterviewers(
      interviewId,
      interviewerProfiles,
      secondaryProfiles.length > 0 ? secondaryCollectiveWeight : null
    );
    if (!updated) {
      setError(tr("interview.scheduler.error.updateInterviewers", "Failed to update interviewers."));
      setSaving(false);
      return;
    }

    setSuccess(tr("interview.scheduler.success.updateInterviewers", "Interviewers updated!"));
    setSaving(false);
    setTimeout(() => setSuccess(null), 3000);
  };


  const copyBookingLink = () => {
    if (!bookingToken) return;
    const link = absoluteUrl(interviewBookPath(bookingToken));
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleGenerateQuestionPacks = async () => {
    if (!interviewId || questionPackLoading) return;

    setQuestionPackLoading(true);
    setError(null);

    const generated = await generateDuringInterviewQuestions(interviewId, {
      questionsCount: questionCount,
      locale,
    });

    if (!generated || generated.length === 0) {
      setError(tr("interview.scheduler.error.generatePacks", "Question pack generation is currently unavailable."));
      setQuestionPackLoading(false);
      return;
    }

    const firstInterviewerId = interviewerProfiles[0]?.userId;
    if (firstInterviewerId) {
      await loadInterviewerPack(firstInterviewerId);
    }

    setSuccess(tr("interview.scheduler.success.generatePacks", "Question packs generated successfully."));
    setQuestionPackLoading(false);
  };

  const handleNotifyInterviewerQuestionPacks = async () => {
    if (!interviewId || sendingInterviewerQuestions) return;

    setSendingInterviewerQuestions(true);
    setError(null);

    const ok = await notifyInterviewerQuestionPacks(interviewId, { sendEmail: true });
    if (!ok) {
      setError(tr("interview.scheduler.error.notifyInterviewerQuestions", "Unable to queue interviewer question emails."));
      setSendingInterviewerQuestions(false);
      return;
    }

    setSuccess(tr("interview.scheduler.success.notifyInterviewerQuestions", "Interviewer question emails queued successfully."));
    setSendingInterviewerQuestions(false);
  };

  /* ── Calendar Navigation ── */
  const goToPrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString(localeTag, {
    month: "long",
    year: "numeric",
  });

  const showEvaluationPanels = !planningOnly && step === 4;

  /* ── Rendering ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center space-y-4">
          <Loader className="w-10 h-10 text-[var(--accent)] animate-spin mx-auto" />
          <p className="text-[var(--text-muted)] text-sm font-medium">{tr("interview.scheduler.loading", "Preparing interview scheduler...")}</p>
        </div>
      </div>
    );
  }

  if (initialLoadError) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-red-400 text-sm font-semibold">{initialLoadError}</p>
          <button
            onClick={loadInitialSchedulerData}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent)] transition-colors"
          >
            {tr("common.retry", "Retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8 animate-fade-in-up">
      {/* ── Header Section ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-6">
        <div>
          <button
            onClick={() => {
              if (backHref) {
                router.push(backHref);
                return;
              }
              window.history.back();
            }}
            className="flex items-center gap-2 text-[var(--text-muted)] font-semibold text-sm hover:text-[var(--accent)] transition-colors mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {backLabel ?? tr("interview.scheduler.backToApplication", "Back to application")}
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            {tr("interview.scheduler.title", "Schedule an interview")}
          </h1>
          <p className="text-[var(--text-muted)] font-medium mt-1">
            {tr("interview.scheduler.candidate", "Candidate")}: <span className="text-[var(--text-primary)] font-semibold">{candidateName || tr("common.loading", "Loading...")}</span> • 
            {tr("interview.scheduler.role", "Role")}: <span className="text-[var(--text-primary)] font-semibold">{roleTitle || tr("common.loading", "Loading...")}</span>
          </p>
        </div>
      </div>

      {/* ── Interview Lifecycle Stepper (T7) ── */}
      {!planningOnly && (() => {
        const currentInterviewStatus = enrichedHistory.find(
          (h) => h.interview.id === (interviewId || selectedHistoryInterviewId)
        )?.interview.status ?? (scheduledAt ? "SCHEDULED" : interviewId ? "DRAFT" : null);

        const lifecycleStep =
          currentInterviewStatus === "COMPLETED" ? 5 :
          step === 4 ? 4 :
          scheduledAt ? 3 :
          interviewerProfiles.length > 0 ? 2 : 1;

        const lifesteps = [
          { label: tr("interview.lifecycle.draft", "Brouillon"), done: lifecycleStep >= 1, isCurrent: lifecycleStep === 1 },
          { label: tr("interview.lifecycle.interviewers", "Interviewers"), done: lifecycleStep >= 2, isCurrent: lifecycleStep === 2 },
          { label: tr("interview.lifecycle.scheduled", "Planifié"), done: lifecycleStep >= 3, isCurrent: lifecycleStep === 3 },
          { label: tr("interview.lifecycle.notified", "Envoyé"), done: lifecycleStep >= 4, isCurrent: lifecycleStep === 4 },
          { label: tr("interview.lifecycle.completed", "Terminé"), done: lifecycleStep >= 5, isCurrent: lifecycleStep === 5 },
        ];

        return (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 sm:px-6 py-3 sm:py-4 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-max sm:min-w-0">
              {lifesteps.map((ls, i) => (
                <div key={ls.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                      ls.isCurrent
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white scale-110 shadow-md"
                        : ls.done
                        ? "bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)]"
                    }`}>
                      {ls.done && !ls.isCurrent ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${ls.isCurrent ? "text-[var(--accent)]" : ls.done ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                      {ls.label}
                    </span>
                  </div>
                  {i < lifesteps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${ls.done ? "bg-[var(--accent-dim)]" : "bg-[var(--border)]"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Wizard Progress Bar ── */}
      <div className="relative pt-4 pb-8 px-2">
        <div className="absolute top-[calc(1rem+20px)] left-0 w-full h-0.5 bg-[var(--bg-raised)] -translate-y-1/2 z-0"></div>
        <div
          className="absolute top-[calc(1rem+20px)] left-0 h-0.5 bg-[var(--accent)] -translate-y-1/2 z-0 transition-all duration-500 ease-out"
          style={{ width: `${((step - 1) / 3) * 100}%` }}
        ></div>

        <div className="relative z-10 flex justify-between items-center">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 border-2 ${
                  s === step
                    ? "bg-[var(--accent)] text-white border-[var(--accent)] scale-110 shadow-lg shadow-[var(--accent)]/20"
                    : s < step
                      ? "bg-[var(--bg-surface)] text-[var(--accent)] border-[var(--accent)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)]"
                }`}
              >
                {s < step ? <CheckCircle2 className="w-6 h-6" /> : s}
              </div>
              <span className={`mt-3 text-xs font-bold uppercase tracking-wider ${
                s === step ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}>
                {s === 1 ? tr("interview.scheduler.step.setup", "Setup") : s === 2 ? tr("interview.scheduler.step.date", "Date") : s === 3 ? tr("interview.scheduler.step.time", "Time") : tr("interview.scheduler.step.confirmed", "Confirmed")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toast notifications ── */}
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-3 bg-red-400/10 border border-red-400/20 rounded-2xl px-5 py-4 animate-fade-in-up shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm font-semibold flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-400 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 bg-emerald-400/10 border border-emerald-400/20 rounded-2xl px-5 py-4 animate-fade-in-up shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-400 text-sm font-semibold flex-1">{success}</p>
          </div>
        )}
      </div>

      {/* ── Main Step Content ── */}
      <div className="min-h-[280px] sm:min-h-[400px]">

      {showEvaluationPanels && (
        <InterviewHistory
          history={enrichedHistory}
          selectedInterviewId={selectedHistoryInterviewId}
          onSelectInterview={setSelectedHistoryInterviewId}
        />
      )}

      {showEvaluationPanels && (selectedHistoryInterviewId || interviewId) && (
        <ScorecardTemplateEditor
          interviewId={selectedHistoryInterviewId || interviewId || ""}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}




      {/* ==================================================================
           STEP 1 — Interview Type + Duration + Interviewers
         ================================================================== */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* ── Interview Type ── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-[var(--text-primary)] font-bold text-lg mb-1">{tr("interview.scheduler.details.title", "Interview details")}</h2>
              <p className="text-[var(--text-muted)] text-sm">{tr("interview.scheduler.details.subtitle", "Configure core interview information.")}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interview.scheduler.details.name", "Interview name")}</label>
              <input
                type="text"
                value={interviewName}
                onChange={(e) => setInterviewName(e.target.value)}
                placeholder={tr("interview.scheduler.details.namePlaceholder", "Ex: Technical interview - Senior Backend")}
                className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interview.scheduler.details.type", "Interview type")}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "TECH_REVIEW", icon: "💻", label: tr("interview.scheduler.category.techReview", "Technical review") },
                  { value: "CULTURE_FIT", icon: "🤝", label: tr("interview.scheduler.category.cultureFit", "Culture fit") },
                  { value: "CUSTOM", icon: "✨", label: tr("interview.scheduler.category.custom", "Other / Custom") },
                ].map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setInterviewCategory(cat.value)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      interviewCategory === cat.value
                        ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                    }`}
                  >
                    <span className="text-base leading-none">{cat.icon}</span>
                    {cat.label}
                    {interviewCategory === cat.value && (
                      <Check className="w-3.5 h-3.5 ml-0.5" />
                    )}
                  </button>
                ))}
              </div>
              {interviewCategory === "CUSTOM" && (
                <input
                  type="text"
                  value={customInterviewName}
                  onChange={(e) => setCustomInterviewName(e.target.value)}
                  placeholder={tr("interview.scheduler.category.customPlaceholder", "Ex: Entretien de groupe, Test pratique...")}
                  className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all"
                />
              )}
            </div>

            {interviewType === "IN_PERSON" && (
              <div className="space-y-1.5 animate-fade-in-up">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {tr("interview.scheduler.location.fullLabel", "Interview location (full address)")}
                </label>
                <textarea
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder={tr(
                    "interview.scheduler.location.placeholder",
                    "Ex: Aptely HQ, 123 Avenue de la Republique, 75011 Paris, Floor 4, Room Atlas"
                  )}
                  className="w-full min-h-[90px] resize-y bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all"
                />
              </div>
            )}

            <div className="border-t border-[var(--border)] pt-4">
              <h3 className="text-[var(--text-primary)] font-bold text-base mb-1">{tr("interview.scheduler.format.title", "Interview format")}</h3>
              <p className="text-[var(--text-muted)] text-xs mb-4">{tr("interview.scheduler.format.subtitle", "Choose how the interview will take place")}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Remote */}
              <button
                type="button"
                onClick={() => { setInterviewType("REMOTE"); setSelectedMeetingProvider("JITSI"); }}
                className={`relative group rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
                  interviewType === "REMOTE"
                    ? "border-[var(--accent)] bg-gradient-to-br from-[var(--accent)]/10 to-transparent shadow-lg shadow-[var(--accent)]/10"
                    : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                    interviewType === "REMOTE"
                      ? "bg-[var(--accent)] text-white shadow-md"
                      : "bg-[var(--bg-raised)] text-[var(--text-muted)] group-hover:bg-[var(--accent-dim)] group-hover:text-[var(--accent)]"
                  }`}
                >
                  <Video className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg mb-1">{tr("interview.scheduler.type.remoteTitle", "Remote interview")}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                  {tr("interview.scheduler.type.remoteDescription", "Video call. A secure meeting link will be generated automatically.")}
                </p>
                {interviewType === "REMOTE" && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>

              {/* In-person */}
              <button
                type="button"
                onClick={() => setInterviewType("IN_PERSON")}
                className={`relative group rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
                  interviewType === "IN_PERSON"
                    ? "border-[var(--accent)] bg-gradient-to-br from-[var(--accent)]/10 to-transparent shadow-lg shadow-[var(--accent)]/10"
                    : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 ${
                    interviewType === "IN_PERSON"
                      ? "bg-[var(--accent)] text-white shadow-md"
                      : "bg-[var(--bg-raised)] text-[var(--text-muted)] group-hover:bg-[var(--accent-dim)] group-hover:text-[var(--accent)]"
                  }`}
                >
                  <MapPin className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-[var(--text-primary)] text-lg mb-1">{tr("interview.scheduler.type.inPersonTitle", "In-person interview")}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                  {tr("interview.scheduler.type.inPersonDescription", "Face-to-face meeting at your office. The candidate will receive location details via email.")}
                </p>
                {interviewType === "IN_PERSON" && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* ── Duration ── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6  space-y-5">
            <div>
              <h2 className="text-[var(--text-primary)] font-bold text-lg mb-1">{tr("interview.scheduler.duration.title", "Interview duration")}</h2>
              <p className="text-[var(--text-muted)] text-sm">{tr("interview.scheduler.duration.subtitle", "Select the expected length of the interview")}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {durationOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDurationMinutes(opt.value);
                    setIsCustomDuration(false);
                  }}
                  className={`relative rounded-xl border-2 px-5 py-3.5 text-left transition-all duration-300 min-w-[100px] ${
                    durationMinutes === opt.value && !isCustomDuration
                      ? "border-[var(--accent)] bg-[var(--accent-dim)] shadow-md shadow-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                  }`}
                >
                  <div
                    className={`font-bold text-base mb-0.5 transition-colors ${
                      durationMinutes === opt.value && !isCustomDuration ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </div>
                  <div className="text-[var(--text-muted)] text-xs">{opt.subtitle}</div>
                  {durationMinutes === opt.value && !isCustomDuration && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}

              {/* Custom Duration Toggle */}
              <button
                type="button"
                onClick={() => setIsCustomDuration(true)}
                className={`relative rounded-xl border-2 px-5 py-3.5 text-left transition-all duration-300 min-w-[100px] ${
                  isCustomDuration
                    ? "border-[var(--accent)] bg-[var(--accent-dim)] shadow-md shadow-[var(--accent)]/10"
                    : "border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                }`}
              >
                <div className={`font-bold text-base mb-0.5 ${isCustomDuration ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                  {tr("interview.scheduler.duration.other", "Other...")}
                </div>
                <div className="text-[var(--text-muted)] text-xs">{tr("interview.scheduler.duration.custom", "Custom duration")}</div>
              </button>
            </div>

            {/* Custom Duration Input */}
            {isCustomDuration && (
              <div className="mt-4 p-4 bg-[var(--bg-raised)] rounded-2xl border border-[var(--border)] animate-fade-in-up">
                <label className="block text-sm font-bold text-[var(--text-secondary)] mb-2">{tr("interview.scheduler.duration.enter", "Enter duration (minutes)")}</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-[200px]">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] font-semibold text-[var(--text-primary)]"
                      placeholder={tr("interview.scheduler.duration.placeholder", "e.g. 287")}
                    />
                  </div>
                    <span className="text-[var(--text-muted)] font-medium">{tr("interview.scheduler.duration.minutes", "minutes")}</span>
                </div>
              </div>
            )}
          </div>


          {/* ── Interviewers (Enrichi Lot A) ── */}
          {members.length > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[var(--accent)]" />
                  <div>
                    <h2 className="text-[var(--text-primary)] font-bold text-lg">{tr("interview.scheduler.interviewers.title", "Interviewers & weighting")}</h2>
                    <p className="text-[var(--text-muted)] text-sm">{tr("interview.scheduler.interviewers.subtitle", "Select members and define their role in final scoring.")}</p>
                  </div>
                </div>
                {interviewerProfiles.length > 0 && (
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    interviewerProfiles.reduce((acc, p) => acc + p.evaluationWeight, 0) === 100 
                    ? "bg-emerald-400/10 text-emerald-400" 
                    : "bg-[var(--accent-dim)] text-[var(--accent)]"
                  }`}>
                    {tr("interview.scheduler.total", "Total")}: {interviewerProfiles.reduce((acc, p) => acc + p.evaluationWeight, 0)}%
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* InterviewerPicker — searchable, filterable, chip-based */}
                <InterviewerPicker
                  members={members}
                  selectedIds={interviewerProfiles.map(p => p.userId)}
                  onToggle={(userId) => {
                    const isSelected = interviewerProfiles.some(p => p.userId === userId);
                    if (isSelected) {
                      setInterviewerProfiles(prev => distributeWeights(prev.filter(p => p.userId !== userId)));
                    } else {
                      setInterviewerProfiles(prev => distributeWeights([...prev, { userId, profileText: "", evaluationWeight: 0, role: "MANDATORY" }]));
                    }
                  }}
                />


                {/* Rich editor for each selected interviewer */}
                <div className="grid grid-cols-1 gap-4 mt-4">
                  {interviewerProfiles.map((p, idx) => {
                    const memberInfo = members.find(m => m.userId === p.userId);
                    return (
                      <div key={p.userId} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-raised)]/50 border-[var(--border)] space-y-3 animate-fade-in-up">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              {memberInfo?.fullName?.trim() || memberInfo?.email}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const newProfiles = [...interviewerProfiles];
                                  newProfiles[idx] = { ...newProfiles[idx], role: "MANDATORY" };
                                  setInterviewerProfiles(newProfiles);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                  (p.role ?? "MANDATORY") === "MANDATORY"
                                    ? "bg-[var(--accent-dim)] border-[var(--accent)]/40 text-[var(--accent)]"
                                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"
                                }`}
                              >
                                {tr("interview.scheduler.role.mandatory", "Obligatoire")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newProfiles = [...interviewerProfiles];
                                  newProfiles[idx] = { ...newProfiles[idx], role: "SECONDARY" };
                                  setInterviewerProfiles(newProfiles);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                  p.role === "SECONDARY"
                                    ? "bg-sky-400/20 border-sky-400/40 text-sky-400"
                                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-sky-400/40"
                                }`}
                              >
                                {tr("interview.scheduler.role.secondary", "Secondaire")}
                              </button>
                            </div>
                          </div>
                          {(p.role ?? "MANDATORY") === "MANDATORY" && (
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                                {tr("interview.scheduler.weight", "Weight")} (%)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={p.evaluationWeight}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  const newProfiles = [...interviewerProfiles];
                                  newProfiles[idx].evaluationWeight = val;
                                  setInterviewerProfiles(newProfiles);
                                }}
                                className="w-16 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-bold text-[var(--text-primary)] text-center"
                              />
                            </div>
                          )}
                        </div>
                        <textarea
                          placeholder={tr("interview.scheduler.interviewerProfilePlaceholder", "Interviewer profile/focus (e.g. Node.js technical expertise, culture fit...)")}
                          value={p.profileText}
                          onChange={(e) => {
                            const newProfiles = [...interviewerProfiles];
                            newProfiles[idx].profileText = e.target.value;
                            setInterviewerProfiles(newProfiles);
                          }}
                          className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all min-h-[60px]"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Collective secondary weight field */}
                {interviewerProfiles.some(p => p.role === "SECONDARY") && (
                  <div className="flex items-center gap-3 mt-4 p-3 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl">
                    <span className="text-xs text-[var(--text-secondary)] flex-1">
                      {tr("interview.scheduler.secondaryCollectiveWeight", "Secondary collective weight (%)")}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={secondaryCollectiveWeight}
                      onChange={(e) => setSecondaryCollectiveWeight(parseInt(e.target.value) || 0)}
                      className="w-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-bold text-[var(--text-primary)] text-center"
                    />
                  </div>
                )}

                {/* Live weight validation indicator */}
                {interviewerProfiles.length > 0 && (() => {
                  const mandatory = interviewerProfiles.filter(p => (p.role ?? "MANDATORY") === "MANDATORY");
                  const secondary = interviewerProfiles.filter(p => p.role === "SECONDARY");
                  const mandatorySum = mandatory.reduce((acc, p) => acc + p.evaluationWeight, 0);
                  const scw = secondary.length > 0 ? secondaryCollectiveWeight : 0;
                  const total = mandatorySum + scw;
                  const ok = Math.abs(total - 100) <= 0.01;
                  return (
                    <div className={`flex items-center gap-2 mt-3 text-xs font-semibold ${ok ? "text-emerald-500" : "text-red-400"}`}>
                      <span>{ok ? "✓" : "✗"}</span>
                      <span>
                        {tr("interview.scheduler.weightTotal", "Total")} : {total}/100
                        {!ok && ` — ${tr("interview.scheduler.weightError", "must equal 100")}`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── Working hours ── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-[var(--text-primary)] font-bold text-lg mb-1">{tr("interview.scheduler.workingHours.title", "Working hours")}</h2>
              <p className="text-[var(--text-muted)] text-sm">{tr("interview.scheduler.workingHours.subtitle", "Slots will only be proposed within these hours (Mon–Fri).")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interview.scheduler.workingHours.from", "From")}</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={workingHoursStart}
                  onChange={(e) => setWorkingHoursStart(Math.min(workingHoursEnd - 1, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-16 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm font-bold text-[var(--text-primary)] text-center focus:border-[var(--accent)] outline-none"
                />
                <span className="text-[var(--text-muted)] text-sm font-semibold">h</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interview.scheduler.workingHours.to", "To")}</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={workingHoursEnd}
                  onChange={(e) => setWorkingHoursEnd(Math.max(workingHoursStart + 1, Math.min(24, parseInt(e.target.value) || 18)))}
                  className="w-16 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm font-bold text-[var(--text-primary)] text-center focus:border-[var(--accent)] outline-none"
                />
                <span className="text-[var(--text-muted)] text-sm font-semibold">h</span>
              </div>
              <span className="text-[var(--text-muted)] text-xs">{tr("interview.scheduler.workingHours.example", "e.g. 9h → 18h")}</span>
            </div>
          </div>

          {/* ── Next button ── */}
          <button
            onClick={initializeInterview}
            disabled={!interviewType || saving || durationMinutes <= 0 || (interviewType === "IN_PERSON" && meetingLocation.trim().length < 3) || (() => {
              if (interviewerProfiles.length === 0) return false;
              const mandatory = interviewerProfiles.filter(p => (p.role ?? "MANDATORY") === "MANDATORY");
              const secondary = interviewerProfiles.filter(p => p.role === "SECONDARY");
              const mandatorySum = mandatory.reduce((acc, p) => acc + p.evaluationWeight, 0);
              const scw = secondary.length > 0 ? secondaryCollectiveWeight : 0;
              return Math.abs(mandatorySum + scw - 100) > 0.01;
            })()}
            className="w-full py-4 bg-[var(--accent)] hover:bg-[var(--accent)] text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-[var(--accent)]/25 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] text-base uppercase tracking-wider flex items-center justify-center gap-2 group"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                {tr("interview.scheduler.initializing", "Initializing...")}
              </>
            ) : (
              <>
                {tr("interview.scheduler.continueToCalendar", "Continue to calendar")}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ==================================================================
           STEP 2 — Date picker (Calendly-style)
         ================================================================== */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in-up">

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* ── Calendar grid ── */}
          <div className="lg:col-span-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3 sm:p-6">
            {/* Month header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={goToPrevMonth}
                className="w-10 h-10 rounded-xl hover:bg-[var(--bg-raised)] flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
              <h2 className="text-[var(--text-primary)] font-bold text-lg capitalize">{monthLabel}</h2>
              <button
                onClick={goToNextMonth}
                className="w-10 h-10 rounded-xl hover:bg-[var(--bg-raised)] flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDayLabels.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-[var(--text-muted)] py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day, idx) => {
                const key = getDayKey(day);
                const isCurrentMonth = day.getMonth() === calMonth;
                const isToday = isSameDay(day, now);
                const hasSlots = datesWithSlots.has(key);
                const isSelected = selectedDate === key;
                const isPast = day < new Date(now.getFullYear(), now.getMonth(), now.getDate());

                return (
                  <button
                    key={`${key}-${idx}`}
                    type="button"
                    disabled={isPast || !isCurrentMonth}
                    onClick={() => {
                      setSelectedDate(key);
                      setSelectedSlot(null);
                      setSelectedSecondaryUserId(null);
                    }}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all duration-300 ${
                      !isCurrentMonth
                        ? "text-[var(--text-muted)] cursor-default"
                        : isPast
                        ? "text-[var(--text-muted)] cursor-not-allowed"
                        : isSelected
                        ? "bg-[var(--accent)] text-white font-bold shadow-lg shadow-[var(--accent)]/25 scale-105"
                        : hasSlots
                        ? "text-[var(--accent)] font-semibold bg-[var(--accent-dim)] hover:bg-[var(--accent-dim)] cursor-pointer"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-raised)] cursor-pointer"
                    }`}
                  >
                    <span>{day.getDate()}</span>
                    {hasSlots && !isSelected && (
                      <div className="flex gap-0.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                      </div>
                    )}
                    {isToday && !isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Next button in Step 2 */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 animate-fade-in-up">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 border-2 border-[var(--border)] text-[var(--text-secondary)] font-bold rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all text-center text-sm uppercase tracking-wide bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                {tr("interview.scheduler.previousStep", "Previous step")}
              </button>
              {selectedDate && (() => {
                const dateHasSlots = datesWithSlots.has(selectedDate);
                return (
                  <button
                    onClick={() => setStep(3)}
                    className={`flex-[2] py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 group text-sm ${
                      dateHasSlots
                        ? "bg-[var(--accent)] hover:bg-[var(--accent)] text-white shadow-none"
                        : "border-2 border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                    }`}
                  >
                    {dateHasSlots
                      ? <>{tr("interview.scheduler.chooseTimeFor", "Choose time for")} {formatDate(selectedDate)}</>
                      : <>{tr("interview.scheduler.setManualTimeFor", "Set manual time for")} {formatDate(selectedDate)}</>
                    }
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                );
              })()}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                {tr("interview.scheduler.legend.availableDates", "Available dates")}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full bg-t-muted" />
                {tr("interview.scheduler.legend.noSlots", "No slots")}
              </div>
            </div>
          </div>

          {/* ── Side info panel ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Interview summary */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5  space-y-3">
              <h3 className="font-bold text-[var(--text-primary)] text-sm">{tr("interview.scheduler.settings.title", "Interview settings")}</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {interviewType === "REMOTE" ? (
                    <Video className="w-4 h-4 text-[var(--accent)]" />
                  ) : (
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                  )}
                  <span className="text-[var(--text-secondary)]">
                    {interviewType === "REMOTE"
                      ? tr("interview.scheduler.settings.remote", "Remote (video call)")
                      : tr("interview.scheduler.settings.inPerson", "In-person meeting")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-[var(--text-secondary)]">{durationMinutes} min</span>
                </div>
                {interviewerProfiles.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-[var(--text-secondary)]">{interviewerProfiles.length} {tr("interview.scheduler.settings.interviewersCount", "interviewer(s)")}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                {tr("interview.scheduler.settings.edit", "Edit settings")}
              </button>
            </div>

            {/* AI suggestions */}
            {slots.length > 0 && (
              <div className="bg-gradient-to-br from-elevated to-canvas rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="font-bold text-white text-sm">{tr("interview.scheduler.suggestions.title", "Smart suggestions")}</h3>
                </div>
                <p className="text-[var(--text-muted)] text-xs">{tr("interview.scheduler.suggestions.subtitle", "Best slots based on availability")}</p>
                <div className="space-y-2">
                  {slots.slice(0, 3).map((slot, i) => (
                    <button
                      key={slot.start}
                      onClick={() => {
                        const slotDate = new Date(slot.start);
                        setSelectedDate(getDayKey(slotDate));
                        setCalYear(slotDate.getFullYear());
                        setCalMonth(slotDate.getMonth());
                        setSelectedSlot(slot.start);
                        setSlotAdjustMinutes(0);
                        setSelectedSecondaryUserId(null);
                        setStep(3);
                      }}
                      className="w-full flex items-center gap-3 bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] rounded-xl px-4 py-3 text-left transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] text-xs font-bold">
                        #{i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">
                          {formatTime(slot.start)} – {formatTime(slot.end)}
                        </p>
                        <p className="text-[var(--text-muted)] text-xs capitalize">
                          {new Date(slot.start).toLocaleDateString(localeTag, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-muted)] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Refresh button */}
            {interviewId && (
              <button
                onClick={() => loadAvailability()}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--accent)] py-3 rounded-xl hover:bg-[var(--accent-dim)] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {tr("interview.scheduler.refreshAvailability", "Refresh availability")}
              </button>
            )}
          </div>
        </div>
        </div>
      )}

      {/* ==================================================================
           STEP 3 — Time slot picker
         ================================================================== */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* ── Selected date header ── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 ">
            <div className="flex items-center justify-between mb-6">
              <div>
                <button
                  onClick={() => {
                    setStep(2);
                    setSelectedSlot(null);
                    setSelectedSecondaryUserId(null);
                  }}
                  className="text-sm text-[var(--accent)] font-semibold hover:underline flex items-center gap-1 mb-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {tr("interview.scheduler.changeDate", "Change date")}
                </button>
                <h2 className="text-[var(--text-primary)] font-bold text-xl capitalize">
                  {selectedDate ? formatDate(selectedDate) : tr("interview.scheduler.selectTime", "Select a time")}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Clock className="w-4 h-4" />
                {durationMinutes} min · {interviewType === "REMOTE"
                  ? tr("interview.scheduler.remoteShort", "Remote")
                  : tr("interview.scheduler.inPersonShort", "In-person")}
              </div>
            </div>

            {/* ── Filters ── */}
            {selectedDateSlots.length > 0 || bestSlotsOnly ? (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setBestSlotsOnly((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    bestSlotsOnly
                      ? "bg-emerald-400/10 border-emerald-400 text-emerald-400"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-emerald-400 hover:text-emerald-400 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {tr("interview.scheduler.bestOnly", "All available only")}
                </button>
              </div>
            ) : null}

            {/* ── Time slots grid ── */}
            {selectedDateSlots.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                  {selectedDateSlots.map((slot) => {
                    const isSelected = selectedSlot === slot.start;
                    const isSlotValid = slot.isValid ?? ((slot.unavailableMandatory?.length ?? 0) === 0);
                    const mandatoryUnavail = slot.unavailableMandatory ?? [];
                    const availSec = slot.availableSecondary ?? [];
                    const invalidReason = !isSlotValid
                      ? mandatoryUnavail.length > 0
                        ? t(locale, "interview.scheduler.slot.mandatoryUnavailable", "{{n}} mandatory participant(s) unavailable", { n: mandatoryUnavail.length })
                        : tr("interview.scheduler.slot.noSecondaryAvailable", "No secondary available")
                      : null;
                    // Fallback to legacy fields if new ones not present
                    const availableMandatory = slot.availableMandatory ?? slot.availableParticipants ?? [];
                    const unavailableMandatory = slot.unavailableMandatory ?? slot.unavailableParticipants ?? [];
                    const hasParticipantData = availableMandatory.length > 0 || unavailableMandatory.length > 0 || availSec.length > 0;
                    const availCount = availableMandatory.length;
                    const totalMandatoryCount = availCount + unavailableMandatory.length;
                    const allAvailable = totalMandatoryCount > 0 && availCount === totalMandatoryCount;
                    const noneAvailable = totalMandatoryCount > 0 && availCount === 0;
                    const borderColor = isSelected
                      ? "border-[var(--accent)]"
                      : !isSlotValid
                      ? "border-red-400/30"
                      : allAvailable
                      ? "border-emerald-400/60 hover:border-emerald-400"
                      : noneAvailable
                      ? "border-red-400/40 hover:border-red-400/60"
                      : hasParticipantData
                      ? "border-amber-400/40 hover:border-amber-400/60"
                      : "border-[var(--border)] hover:border-[var(--accent)]";
                    return (
                      <div key={slot.start} className="relative">
                        <button
                          type="button"
                          disabled={!isSlotValid}
                          title={invalidReason ?? undefined}
                          onClick={() => {
                            if (!isSlotValid) return;
                            setSelectedSlot(slot.start);
                            setSlotAdjustMinutes(0);
                            setActiveSlotPopover(null);
                            setSelectedSecondaryUserId(null);
                          }}
                          className={`w-full relative rounded-xl border-2 px-4 py-3.5 text-center transition-all duration-200 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl hover:shadow-md ${borderColor} ${
                            isSelected ? "bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/25 scale-[1.02]" : ""
                          } ${!isSlotValid ? "opacity-40 cursor-not-allowed grayscale" : ""}`}
                        >
                          <div className={`font-bold text-base ${isSelected ? "text-white" : "text-[var(--text-primary)]"}`}>
                            {formatTime(slot.start)}
                          </div>
                          <div className={`text-xs mt-0.5 ${isSelected ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                            → {formatTime(slot.end)}
                          </div>
                          {hasParticipantData && (
                            <div className="flex justify-center gap-1 mt-2 flex-wrap">
                              {availableMandatory.map((p) => (
                                <span
                                  key={p.userId}
                                  title={`${participantLabel(p.name, p.email)} — ${p.email}`}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${
                                    isSelected
                                      ? "bg-white/20 border-white/40 text-white"
                                      : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                  }`}
                                >
                                  {participantInitials(p.name, p.email)}
                                </span>
                              ))}
                              {unavailableMandatory.map((p) => (
                                <span
                                  key={p.userId}
                                  title={`${participantLabel(p.name, p.email)} — ${p.email} — ${tr("interview.scheduler.busy", "busy")}`}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border opacity-50 ${
                                    isSelected
                                      ? "bg-white/10 border-white/20 text-white"
                                      : "bg-red-500/20 border-red-500/40 text-red-400"
                                  }`}
                                >
                                  {participantInitials(p.name, p.email)}
                                </span>
                              ))}
                              {availSec.map((p) => (
                                <span
                                  key={p.userId}
                                  title={`${participantLabel(p.name, p.email)} — ${tr("interview.scheduler.secondary", "secondaire")}`}
                                  className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[9px] font-bold border border-amber-500/40"
                                >
                                  {participantInitials(p.name, p.email)}
                                </span>
                              ))}
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                              <Check className="w-3 h-3 text-[var(--accent)]" />
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Secondary participant selector */}
                {(() => {
                  const sel = selectedDateSlots.find(s => s.start === selectedSlot);
                  const availSecSlot = sel?.availableSecondary ?? [];
                  if (!selectedSlot || availSecSlot.length <= 1) return null;
                  return (
                    <div className="mt-4 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        {tr("interview.scheduler.chooseSecondary", "Choose a secondary interviewer")}
                      </p>
                      {availSecSlot.map(p => (
                        <label key={p.userId} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="secondary-participant"
                            value={p.userId}
                            checked={selectedSecondaryUserId === p.userId}
                            onChange={() => setSelectedSecondaryUserId(p.userId)}
                            className="accent-[var(--accent)]"
                          />
                          <span className="text-sm text-[var(--text-primary)]">
                            {p.name ?? p.email}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-12 bg-[var(--bg-raised)] rounded-2xl border-2 border-dashed border-[var(--border)]">
                <CalendarDays className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-[var(--text-secondary)] text-sm font-bold">{tr("interview.scheduler.noAutoSlot", "No auto-detected slot")}</p>
                <p className="text-[var(--text-muted)] text-xs mt-1 px-4 max-w-xs mx-auto">
                  {tr("interview.scheduler.noAutoSlotHint", "No synchronized availability found. You can still force a manual time.")}
                </p>
                
                {/* Manual override for Step 3 if no slots */}
                <div className="mt-6 inline-flex flex-col gap-3">
                   <input 
                    type="time" 
                    onChange={(e) => {
                      if (selectedDate && e.target.value) {
                        const [h, m] = e.target.value.split(":");
                        // Use local midnight to avoid UTC date shift
                        const d = new Date(selectedDate + "T00:00:00");
                        d.setHours(parseInt(h), parseInt(m), 0, 0);
                        setSelectedSlot(d.toISOString());
                        setSlotAdjustMinutes(0);
                      }
                    }}
                    className="px-4 py-3 rounded-xl border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none font-bold text-[var(--text-primary)]"
                   />
                   <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">{tr("interview.scheduler.selectManualTime", "Select a manual time")}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Confirm button ── */}
          {selectedSlot && adjustedSlotStart && (
            <div className="animate-fade-in-up space-y-3">
              {/* Time adjustment controls */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interview.scheduler.adjustTime", "Adjust time")}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {([-15, -5, 5, 15] as const).map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setSlotAdjustMinutes((prev) => prev + delta)}
                      className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-bold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
                    >
                      {delta > 0 ? `+${delta}` : delta} min
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[var(--accent)] font-bold text-base tabular-nums">
                      {formatTime(adjustedSlotStart)} – {formatTime(new Date(new Date(adjustedSlotStart).getTime() + durationMinutes * 60000).toISOString())}
                    </span>
                    {slotAdjustMinutes !== 0 && (
                      <button
                        type="button"
                        onClick={() => setSlotAdjustMinutes(0)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] underline"
                      >
                        {tr("interview.scheduler.resetTime", "Reset")}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-[var(--text-muted)] font-semibold shrink-0">{tr("interview.scheduler.customTime", "Custom:")}</label>
                  <input
                    type="time"
                    value={(() => {
                      const d = new Date(adjustedSlotStart);
                      const h = String(d.getHours()).padStart(2, "0");
                      const m = String(d.getMinutes()).padStart(2, "0");
                      return `${h}:${m}`;
                    })()}
                    onChange={(e) => {
                      if (e.target.value && selectedSlot) {
                        const [h, m] = e.target.value.split(":").map(Number);
                        const base = new Date(selectedSlot);
                        const target = new Date(base);
                        target.setHours(h, m, 0, 0);
                        setSlotAdjustMinutes(Math.round((target.getTime() - base.getTime()) / 60_000));
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-[var(--border)] focus:border-[var(--accent)] outline-none text-sm font-bold text-[var(--text-primary)] bg-[var(--bg-raised)]"
                  />
                </div>
                {isAdjustedOutsideWorkingHours && (
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {tr("interview.scheduler.outsideWorkingHours", "This time is outside working hours")}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-r from-elevated to-canvas rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">{tr("interview.scheduler.readyToConfirm", "Ready to confirm")}</p>
                  <p className="text-white font-bold text-lg">
                    {selectedDate && formatDate(selectedDate)}
                  </p>
                  <p className="text-[var(--accent)] font-bold text-xl">
                    {formatTime(adjustedSlotStart)} – {formatTime(
                      new Date(new Date(adjustedSlotStart).getTime() + durationMinutes * 60000).toISOString()
                    )}
                  </p>
                  {(() => {
                    const slotData = selectedDateSlots.find(s => s.start === selectedSlot);
                    const avail = slotData?.availableParticipants ?? [];
                    const unavail = slotData?.unavailableParticipants ?? [];
                    if (avail.length === 0 && unavail.length === 0) return null;
                    return (
                      <div className="mt-3 space-y-1.5">
                        {avail.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{tr("interview.scheduler.freeInterviewers", "Free")} ({avail.length})</p>
                            {avail.map(p => (
                              <div key={p.userId} className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-emerald-400/15 border border-emerald-400/60 flex items-center justify-center text-[9px] font-bold text-emerald-400 shrink-0">
                                  {participantInitials(p.name, p.email)}
                                </span>
                                <div className="min-w-0">
                                  {p.name && <p className="text-xs text-emerald-400 font-bold leading-tight truncate">{p.name}</p>}
                                  <p className="text-[10px] text-emerald-400/70 truncate">{p.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {unavail.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400/70">{tr("interview.scheduler.busyInterviewers", "Busy")} ({unavail.length})</p>
                            {unavail.map(p => (
                              <div key={p.userId} className="flex items-center gap-2 opacity-60">
                                <span className="w-5 h-5 rounded-full bg-red-400/10 border border-red-400/40 flex items-center justify-center text-[9px] font-bold text-red-400 shrink-0">
                                  {participantInitials(p.name, p.email)}
                                </span>
                                <div className="min-w-0">
                                  {p.name && <p className="text-xs text-red-400 font-bold leading-tight line-through truncate">{p.name}</p>}
                                  <p className="text-[10px] text-red-400/70 line-through truncate">{p.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-4 border-2 border-[var(--border)]-hover text-white font-bold rounded-xl hover:bg-[var(--bg-raised)] transition-all text-sm uppercase tracking-wide flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    {tr("common.back", "Back")}
                  </button>
                  {(() => {
                    const selSlot = selectedDateSlots.find(s => s.start === selectedSlot);
                    const availSecConfirm = selSlot?.availableSecondary ?? [];
                    const needsSecondarySelection = availSecConfirm.length > 1 && !selectedSecondaryUserId;
                    return (
                      <button
                        onClick={confirmSchedule}
                        disabled={saving || !selectedSlot || needsSecondarySelection}
                        className="flex items-center justify-center gap-2 px-8 py-4 bg-[var(--accent)] hover:bg-[var(--accent)] text-white font-bold rounded-xl transition-all shadow-lg shadow-[var(--accent)]/25 disabled:opacity-50 active:scale-[0.97] text-sm uppercase tracking-wide"
                      >
                        {saving ? (
                          <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                        {saving ? tr("interview.scheduler.scheduling", "Scheduling...") : tr("interview.scheduler.confirmInterview", "Confirm interview")}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
           STEP 4 — Confirmation
         ================================================================== */}
      {step === 4 && (
        <div className="space-y-6 animate-fade-in-up">
          {/* ── Success card ── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden ">
            <div className="bg-[var(--bg-raised)] border-b border-emerald-500/20 px-6 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-emerald-400 font-bold text-2xl mb-1">
                {tr("interview.scheduler.scheduledTitle", "Interview scheduled!")}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm">
                <>{tr("interview.scheduler.scheduledSubtitlePrefix", "The interview has been successfully scheduled with")} {candidateName}</>
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--bg-raised)] rounded-xl p-4">
                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">{tr("interview.scheduler.dateTime", "Date & time")}</p>
                  <p className="text-[var(--text-primary)] font-bold text-sm">
                    {scheduledAt
                      ? new Date(scheduledAt).toLocaleDateString(localeTag, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                  <p className="text-[var(--accent)] font-bold text-lg">
                    {scheduledAt ? formatTime(scheduledAt) : "—"}
                  </p>
                </div>

                <div className="bg-[var(--bg-raised)] rounded-xl p-4">
                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">{tr("interview.scheduler.durationLabel", "Duration")}</p>
                  <p className="text-[var(--text-primary)] font-bold text-sm">{durationMinutes} {tr("interview.scheduler.duration.minutes", "minutes")}</p>
                  <p className="text-[var(--text-muted)] text-xs mt-1">
                    {interviewType === "REMOTE"
                      ? tr("interview.scheduler.summary.remote", "📹 Remote — Video call")
                      : tr("interview.scheduler.summary.inPerson", "🏢 In-person at the office")}
                  </p>
                </div>
              </div>

              {interviewType === "IN_PERSON" && meetingLocation.trim().length > 0 && (
                <div className="bg-[var(--bg-raised)] rounded-xl p-4">
                  <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider mb-1">
                    {tr("interview.scheduler.location", "Location")}
                  </p>
                  <p className="text-[var(--text-primary)] font-semibold text-sm">{meetingLocation}</p>
                </div>
              )}

              {/* Meeting — clean join button, no provider branding */}
              {meetingLink && (
                <div className="space-y-3">
                  {showMeetEmbed ? (
                    <Suspense fallback={<div className="h-40 flex items-center justify-center text-[var(--text-muted)] text-sm">{tr("interview.scheduler.joiningMeeting", "Connexion en cours…")}</div>}>
                      <JitsiEmbed
                        meetingUrl={meetingLink}
                        displayName={tr("interview.scheduler.hrLabel", "Recruteur")}
                        onClose={() => setShowMeetEmbed(false)}
                      />
                    </Suspense>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMeetEmbed(true)}
                      className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_4px_16px_oklch(65%_0.22_42_/_0.3)]"
                    >
                      <Video className="w-4 h-4" />
                      {tr("interview.scheduler.joinMeeting", "Rejoindre l'entretien")}
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* ── Email Templates Section ── */}
          {!planningOnly && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="bg-[var(--bg-raised)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="font-bold text-[var(--text-primary)]">{tr("interview.scheduler.communicationTemplates", "Communication templates")}</h3>
              </div>
              <div className="flex p-1 bg-[var(--bg-raised)] rounded-lg gap-1">
                <button
                  onClick={() => setActiveTemplate("candidate")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTemplate === "candidate" ? "bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tr("interview.scheduler.recipient.candidate", "Candidate")}
                </button>
                <button
                  onClick={() => setActiveTemplate("interviewer")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTemplate === "interviewer" ? "bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tr("interview.scheduler.recipient.interviewers", "Interviewers")}
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-[var(--accent-dim)] border-b border-[var(--border)]">
              <p className="text-xs text-[var(--accent)] font-medium">
                <Info className="w-3.5 h-3.5 inline mr-1.5" />
                {tr("interview.scheduler.sendEmailDescription", "L'email sera envoyé au candidat et à tous les intervenants assignés.")}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Editable textarea */}
              <textarea
                value={(() => {
                  // Auto-fill template content when switching tabs
                  if (templateInitialized !== activeTemplate) {
                    const templates: Record<string, string> = {
                      candidate: `Subject: ${tr("interview.scheduler.emailTemplate.candidate.subject", "Interview confirmation")} — ${roleTitle}\n\n${tr("interview.scheduler.emailTemplate.hello", "Hello")} ${candidateName},\n\n${tr("interview.scheduler.emailTemplate.candidate.intro", "We are pleased to confirm your interview for the role of")} ${roleTitle}.\n\n📅 ${tr("interview.scheduler.date", "Date")}: ${scheduledAt ? formatDate(scheduledAt) : "—"}\n🕒 ${tr("interview.scheduler.time", "Time")}: ${scheduledAt ? formatTime(scheduledAt) : "—"} (${timezone})\n📍 ${tr("interview.scheduler.location", "Location")}: ${interviewType === "REMOTE" ? tr("interview.scheduler.emailTemplate.location.remote", "Video call (link below)") : (meetingLocation || tr("interview.scheduler.emailTemplate.location.office", "Our office"))}\n\n${meetingLink ? `🔗 ${tr("interview.scheduler.meetingLink", "Meeting link")}: ${meetingLink}\n\n` : ""}${bookingToken ? `🔗 ${tr("interview.scheduler.emailTemplate.bookingLink", "Reschedule link")}: ${absoluteUrl(interviewBookPath(bookingToken))}\n\n` : ""}${tr("interview.scheduler.emailTemplate.candidate.outro", "We look forward to meeting you.")}\n\n${tr("interview.scheduler.emailTemplate.regards", "Best regards")},\n${tr("interview.scheduler.emailTemplate.team", "Aptely Recruiting Team")}.`,
                      interviewer: `Subject: ${tr("interview.scheduler.emailTemplate.interviewer.subject", "Interview invitation")} — ${candidateName} (${roleTitle})\n\n${tr("interview.scheduler.emailTemplate.interviewer.intro", "You are invited to join the interview.")}\n\n📅 ${tr("interview.scheduler.date", "Date")}: ${scheduledAt ? formatDate(scheduledAt) : "—"}\n🕒 ${tr("interview.scheduler.time", "Time")}: ${scheduledAt ? formatTime(scheduledAt) : "—"}\n⏱️ ${tr("interview.scheduler.durationLabel", "Duration")}: ${durationMinutes} ${tr("interview.scheduler.duration.minutes", "minutes")}\n📍 ${tr("interview.scheduler.format", "Format")}: ${interviewType === "REMOTE" ? tr("interview.scheduler.remoteShort", "Remote") : tr("interview.scheduler.inPersonShort", "In-person")}\n🔗 ${tr("interview.scheduler.emailTemplate.linkOrLocation", "Link/Location")}: ${meetingLink || meetingLocation || tr("interview.scheduler.emailTemplate.location.officeMain", "Main office")}\n\n${tr("interview.scheduler.emailTemplate.interviewer.outro", "Please submit your feedback right after the interview.")}`,
                    };
                    // Schedule the state update for next render
                    setTimeout(() => {
                      setEditedTemplateContent(templates[activeTemplate]);
                      setTemplateInitialized(activeTemplate);
                    }, 0);
                    return templates[activeTemplate];
                  }
                  return editedTemplateContent;
                })()}
                onChange={(e) => {
                  setEditedTemplateContent(e.target.value);
                }}
                rows={14}
                className="w-full bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium leading-relaxed font-mono rounded-xl p-5 border border-[var(--border)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 outline-none resize-y transition-all"
              />

              {/* Action bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(editedTemplateContent);
                      setSuccess(tr("interview.scheduler.contentCopied", "Content copied to clipboard!"));
                      setTimeout(() => setSuccess(null), 2000);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] rounded-xl text-[var(--text-secondary)] text-xs font-bold transition-all active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {tr("common.copy", "Copy")}
                  </button>
                  <button
                    onClick={() => {
                      setTemplateInitialized(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-raised)] hover:bg-[var(--bg-raised)] rounded-xl text-[var(--text-secondary)] text-xs font-bold transition-all active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {tr("common.reset", "Reset")}
                  </button>
                </div>
                <button
                  onClick={async () => {
                    setSendingEmail(true);
                    const recipientType = activeTemplate === "interviewer" ? "interviewers" : activeTemplate;
                    const notifyRes = await apiFetch(interviewNotifyApi(interviewId!), "HR", {
                      method: "POST",
                      body: JSON.stringify({
                        recipientType,
                        subject: editedTemplateContent.split("\n")[0]?.replace("Objet : ", "").replace("Subject: ", "") || tr("interview.scheduler.emailTemplate.defaultSubject", "Interview notification"),
                        body: editedTemplateContent,
                      }),
                    });
                    if (notifyRes !== null) {
                      setSuccess(tr("interview.scheduler.emailSent", "Email sent successfully!"));
                      setEmailSent(true);
                      setTimeout(() => setSuccess(null), 3000);
                    } else {
                      setError(tr("interview.scheduler.emailFailed", "Failed to send the email. Please try again."));
                      setTimeout(() => setError(null), 5000);
                    }
                    setSendingEmail(false);
                  }}
                  disabled={sendingEmail}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent)] text-white text-xs font-bold rounded-xl shadow-none transition-all active:scale-95 disabled:opacity-50"
                >
                  {sendingEmail ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {tr("interview.scheduler.sendEmail", "Send email")}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={() => {
                setStep(2);
                setSelectedSlot(null);
              }}
              className="flex-1 py-4 border-2 border-[var(--border)] text-[var(--text-secondary)] font-bold rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all text-center text-sm uppercase tracking-wide bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl"
            >
              {tr("interview.scheduler.reschedule", "Reschedule interview")}
            </button>
            {planningOnly && !canLeaveAfterConfirm ? (
              <div
                className="flex-1 py-4 bg-[var(--accent-dim)] text-white font-bold rounded-xl transition-all text-center text-sm uppercase tracking-wide flex items-center justify-center gap-2 cursor-not-allowed"
              >
                {tr("interview.scheduler.confirming", "Confirmation in progress...")}
                <Loader className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <button
                type="button"
                disabled={!emailSent}
                onClick={() => {
                  const base = redirectAfterScheduleTo || appPath(applicationId);
                  const url = base.includes('?') ? `${base}&_t=${Date.now()}` : `${base}?_t=${Date.now()}`;
                  router.push(url);
                }}
                className={`flex-1 py-4 text-white font-bold rounded-xl shadow-lg shadow-[var(--accent)]/25 transition-all text-center text-sm uppercase tracking-wide flex items-center justify-center gap-2 ${
                  emailSent
                    ? "bg-[var(--accent)] hover:bg-[var(--accent)] cursor-pointer"
                    : "bg-[var(--text-muted)] cursor-not-allowed"
                }`}
              >
                {emailSent ? (
                  <>
                    {tr("interview.scheduler.finishExit", "Finish & Exit")}
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    {tr("interview.scheduler.mustSendEmailFirst", "Send email before exit")}
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Candidate Interview History (Lot A) ── */}
      {showEvaluationPanels && (
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <h2 className="text-[var(--text-primary)] font-bold text-lg">{tr("interview.scheduler.evaluationHistoryTitle", "Evaluation history")}</h2>
              <p className="text-[var(--text-muted)] text-sm">{tr("interview.scheduler.evaluationHistorySubtitle", "Timeline of past interviews for this candidate.")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interview.scheduler.filter", "Filter")}</label>
            <select
              value={historyStatusFilter}
              onChange={(event) => setHistoryStatusFilter(event.target.value as "ALL" | "DRAFT" | "SCHEDULED" | "CANCELLED" | "COMPLETED")}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="ALL">{tr("interview.scheduler.status.all", "All")}</option>
              <option value="SCHEDULED">{tr("interview.scheduler.status.scheduled", "Scheduled")}</option>
              <option value="COMPLETED">{tr("interview.scheduler.status.completed", "Completed")}</option>
              <option value="CANCELLED">{tr("interview.scheduler.status.cancelled", "Cancelled")}</option>
              <option value="DRAFT">{tr("interview.scheduler.status.draft", "Draft")}</option>
            </select>

            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{tr("interview.scheduler.sort", "Sort")}</label>
            <select
              value={historySort}
              onChange={(event) => setHistorySort(event.target.value as "DATE_DESC" | "DATE_ASC" | "STATUS")}
              className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="DATE_DESC">{tr("interview.scheduler.sort.dateDesc", "Date (newest → oldest)")}</option>
              <option value="DATE_ASC">{tr("interview.scheduler.sort.dateAsc", "Date (oldest → newest)")}</option>
              <option value="STATUS">{tr("interview.scheduler.status", "Status")}</option>
            </select>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-raised)]/40 p-6 text-center">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{tr("interview.scheduler.noInterview", "No interview")}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{tr("interview.scheduler.noInterviewHint", "Scheduled interviews will appear here.")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sortedHistory.map((h, idx) => (
              <div key={h.id || idx} className="relative pl-8 border-l-2 border-[var(--border)] py-2">
                <div className="absolute left-[-9px] top-4 w-4 h-4 rounded-full bg-[var(--bg-raised)] border-4 border-[var(--accent)]"></div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 bg-[var(--bg-raised)]/30">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">{h.name || tr("interview.scheduler.untitledInterview", "Untitled interview")}</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)] uppercase tracking-wider">
                          {h.interviewType || tr("interview.scheduler.unknown", "Unknown")}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          h.status === "COMPLETED" ? "bg-emerald-400/10 text-emerald-400" :
                          h.status === "CANCELLED" ? "bg-red-400/10 text-red-400" :
                          "bg-[var(--bg-raised)] text-[var(--text-muted)]"
                        }`}>
                          {statusLabel(h.status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {h.scheduledAt ? formatDate(h.scheduledAt) : tr("interview.scheduler.unscheduledDate", "Unscheduled date")}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-medium">
                          {tr("interview.scheduler.createdOn", "Created on")} {new Date(h.createdAt).toLocaleDateString(localeTag)}
                        </p>
                      </div>
                      {h.id && (
                        <Link
                          href={interviewNotesPath(applicationId, h.id)}
                          className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                        >
                          {tr("interview.scheduler.viewNotes", "View notes")}
                        </Link>
                      )}
                    </div>
                  </div>

                  {h.participants && h.participants.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {h.participants.map((p: any, pIdx: number) => (
                        <div key={pIdx} className="text-[10px] bg-t-primary/5 text-[var(--text-secondary)] font-semibold px-2 py-1 rounded border border-[var(--border)]">
                          {p.userId?.slice(0, 8)}... ({p.evaluationWeight}%)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      </div>
    </div>
  );
}
