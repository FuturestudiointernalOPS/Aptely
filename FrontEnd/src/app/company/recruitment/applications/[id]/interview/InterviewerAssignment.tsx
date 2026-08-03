"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/apiHelper";
import {
  assignInterviewers,
  createInterview,
  getHRMembersPaginated,
  getInterviewAvailability,
  type HRMember,
  type InterviewSlot,
  scheduleInterview,
} from "@/lib/api";
import { RefreshCw, Search, ChevronDown } from "lucide-react";
import { getClientLocale, t } from "@/lib/i18n";

interface InterviewerAssignmentProps {
  applicationId: string;
}

type ViewState = "IDLE" | "READY" | "SCHEDULED";
type TimeFilter = "ALL" | "MORNING" | "AFTERNOON" | "EVENING";

function mapStateToBadge(state: ViewState) {
  if (state === "SCHEDULED") return "VALIDATED" as const;
  if (state === "READY") return "ANALYSING" as const;
  return "PENDING" as const;
}

export default function InterviewerAssignment({ applicationId }: InterviewerAssignmentProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string, params?: Record<string, string | number>) =>
    t(locale, key, fallback, params);

  const [state, setState] = useState<ViewState>("IDLE");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  // ── Members state with search + pagination ──
  const [members, setMembers] = useState<HRMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [memberHasMore, setMemberHasMore] = useState(false);
  const [memberTotal, setMemberTotal] = useState(0);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>([]);
  const [interviewerRoles, setInterviewerRoles] = useState<Record<string, "MANDATORY" | "SECONDARY">>({});
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [manualLocalDateTime, setManualLocalDateTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingSlots, setRefreshingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");
  const [weekStartKey, setWeekStartKey] = useState<string | null>(null);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );

  const hourColumns = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 8), []);

  const startOfWeek = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const getDayKey = (date: Date): string => date.toISOString().slice(0, 10);

  const fetchMembers = useCallback(async (search: string, page: number, append = false) => {
    setLoadingMembers(true);
    const result = await getHRMembersPaginated({ search, page, limit: 20 });
    setMembers((prev) => append ? [...prev, ...result.members] : result.members);
    setMemberHasMore(result.meta.hasMore);
    setMemberTotal(result.meta.total);
    setLoadingMembers(false);
  }, []);

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await fetchMembers("", 1);
      setLoading(false);
    };
    loadInitial();
  }, [fetchMembers]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setMemberSearch(value);
    setMemberPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchMembers(value, 1, false);
    }, 300);
  };

  const loadMoreMembers = () => {
    const next = memberPage + 1;
    setMemberPage(next);
    void fetchMembers(memberSearch, next, true);
  };

  const filteredSlots = useMemo(() => {
    if (timeFilter === "ALL") return slots;
    return slots.filter((slot) => {
      const hour = new Date(slot.start).getHours();
      if (timeFilter === "MORNING") return hour >= 6 && hour < 12;
      if (timeFilter === "AFTERNOON") return hour >= 12 && hour < 18;
      return hour >= 18 && hour < 23;
    });
  }, [slots, timeFilter]);

  const groupedSlots = useMemo(() => {
    return filteredSlots.reduce((acc, slot) => {
      const dayKey = new Date(slot.start).toISOString().slice(0, 10);
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(slot);
      return acc;
    }, {} as Record<string, InterviewSlot[]>);
  }, [filteredSlots]);

  const visibleDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, []);

  const selectedDaySlots = useMemo(() => {
    if (!selectedDay) return [];
    return groupedSlots[selectedDay] ?? [];
  }, [groupedSlots, selectedDay]);

  const weekDays = useMemo(() => {
    if (!weekStartKey) return [] as Date[];
    const start = new Date(weekStartKey);
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      return d;
    });
  }, [weekStartKey]);

  const weeklySlotMap = useMemo(() => {
    const map: Record<string, InterviewSlot[]> = {};
    filteredSlots.forEach((slot) => {
      const start = new Date(slot.start);
      const dayKey = getDayKey(start);
      const hour = start.getHours();
      const key = `${dayKey}-${hour}`;
      if (!map[key]) map[key] = [];
      map[key].push(slot);
    });
    Object.values(map).forEach((items) => {
      items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    });
    return map;
  }, [filteredSlots]);

  const bestSuggestions = useMemo(() => {
    if (filteredSlots.length === 0) return [] as Array<InterviewSlot & { score: number; loadScore: number; proximityScore: number }>;
    const dayCounts = filteredSlots.reduce((acc, slot) => {
      const dayKey = new Date(slot.start).toISOString().slice(0, 10);
      acc[dayKey] = (acc[dayKey] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const maxDayCount = Math.max(...Object.values(dayCounts), 1);
    const now = Date.now();
    return filteredSlots
      .map((slot) => {
        const slotDate = new Date(slot.start);
        const dayKey = slotDate.toISOString().slice(0, 10);
        const hoursAway = Math.max(0, (slotDate.getTime() - now) / (1000 * 60 * 60));
        const proximityScore = Math.max(0, 100 - Math.min(hoursAway, 120) * 0.8);
        const loadScore = (dayCounts[dayKey] / maxDayCount) * 100;
        const score = Math.round(proximityScore * 0.55 + loadScore * 0.45);
        return { ...slot, score, loadScore: Math.round(loadScore), proximityScore: Math.round(proximityScore) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [filteredSlots]);

  const loadAvailability = useCallback(
    async (opts?: { silent?: boolean; interviewIdOverride?: string }) => {
      const targetInterviewId = opts?.interviewIdOverride ?? interviewId;
      if (!targetInterviewId) return;
      if (opts?.silent) setRefreshingSlots(true);
      else setSaving(true);
      setError(null);
      setSuccess(null);
      const now = new Date();
      const inThreeWeeks = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
      const availableSlots = await getInterviewAvailability(targetInterviewId, {
        from: now.toISOString(),
        to: inThreeWeeks.toISOString(),
        slotMinutes: 30,
        timezone,
      });
      setSlots(availableSlots.slots);
      if (availableSlots.slots.length > 0) {
        const firstDate = new Date(availableSlots.slots[0].start);
        const firstDay = firstDate.toISOString().slice(0, 10);
        setSelectedDay((prev) => prev ?? firstDay);
        setWeekStartKey((prev) => prev ?? getDayKey(startOfWeek(firstDate)));
        if (!opts?.silent) {
          setSuccess(tr("interview.assignment.slotsProposed", "{{count}} slots proposed automatically.", { count: availableSlots.slots.length }));
        }
      } else if (!opts?.silent) {
        setError(tr("interview.assignment.noSlotsAvailable", "No slots available for this period."));
      }
      if (opts?.silent) setRefreshingSlots(false);
      else setSaving(false);
    },
    [interviewId, timezone, locale]
  );

  useEffect(() => {
    if (!interviewId || !autoRefreshEnabled) return;
    const interval = setInterval(() => { loadAvailability({ silent: true }); }, 60000);
    return () => clearInterval(interval);
  }, [interviewId, autoRefreshEnabled, loadAvailability]);

  useEffect(() => {
    if (!selectedDay) return;
    const day = new Date(selectedDay);
    setWeekStartKey(getDayKey(startOfWeek(day)));
  }, [selectedDay]);

  const initializeInterview = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const created = await createInterview({
      applicationId,
      name: "Interview Draft",
      interviewType: "CUSTOM",
      durationMinutes,
      timezone,
      meetingProvider: "MANUAL",
    });
    if (!created) {
      setError(tr("interview.assignment.draftError", "Failed to create interview draft."));
      setSaving(false);
      return;
    }
    setInterviewId(created.id);
    setBookingToken(created.bookingToken ?? null);
    setScheduledAt(created.scheduledAt ?? null);
    setMeetingLink(created.meetingLink ?? null);
    if (Array.isArray(created.participants) && created.participants.length > 0) {
      setSelectedInterviewers(created.participants.map((it) => it.userId));
    }
    setState("READY");
    setSuccess(tr("interview.assignment.draftSuccess", "Interview draft created. You can now schedule from the calendar."));
    setSaving(false);
    await loadAvailability({ interviewIdOverride: created.id });
  };

  const toggleInterviewer = (userId: string) => {
    setSelectedInterviewers((prev: string[]) =>
      prev.includes(userId) ? prev.filter((id: string) => id !== userId) : [...prev, userId]
    );
  };

  const saveInterviewers = async () => {
    if (!interviewId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const updated = await assignInterviewers(
      interviewId,
      selectedInterviewers.map(id => ({
        userId: id,
        evaluationWeight: 100 / selectedInterviewers.length,
        role: interviewerRoles[id] ?? "MANDATORY",
      } as any)),
      null
    );
    if (!updated) {
      setError(tr("interview.assignment.assignError", "Failed to assign interviewers."));
      setSaving(false);
      return;
    }
    setSuccess(tr("interview.assignment.assignSuccess", "Interviewers assigned."));
    setSaving(false);
  };


  const confirmSchedule = async () => {
    if (!interviewId || !selectedSlot || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const scheduled = await scheduleInterview(interviewId, { start: selectedSlot, timezone });
    if (!scheduled) {
      setError(tr("interview.assignment.scheduleError", "Failed to book this slot."));
      setSaving(false);
      return;
    }
    setState("SCHEDULED");
    setScheduledAt(scheduled.scheduledAt ?? selectedSlot);
    setMeetingLink(scheduled.meetingLink ?? null);
    setSuccess(tr("interview.assignment.scheduleSuccess", "Interview scheduled. You can still reschedule if needed."));
    setSaving(false);
  };

  const scheduleManualDate = async () => {
    if (!interviewId || !manualLocalDateTime) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const isoStart = new Date(manualLocalDateTime).toISOString();
    const scheduled = await scheduleInterview(interviewId, { start: isoStart, timezone });
    if (!scheduled) {
      setError(tr("interview.assignment.manualError", "Failed to reschedule on this manual slot."));
      setSaving(false);
      return;
    }
    setState("SCHEDULED");
    setSelectedSlot(isoStart);
    setScheduledAt(scheduled.scheduledAt ?? isoStart);
    setMeetingLink(scheduled.meetingLink ?? null);
    setSuccess(tr("interview.assignment.manualSuccess", "Interview rescheduled."));
    setSaving(false);
  };

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{tr("interview.assignment.loading", "Loading members...")}</p>;
  }


  return (
    <div className="space-y-4">
      <Card
        title={tr("interview.assignment.setup.title", "Interview setup")}
        subtitle={tr("interview.assignment.setup.subtitle", "Assignment + availability + booking")}
      >
        <div className="space-y-4">

          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">Application: {applicationId}</p>
            <StatusBadge status={mapStateToBadge(state)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]" htmlFor="durationMinutes">
              {tr("interview.assignment.duration", "Duration")}
            </label>
            <select
              id="durationMinutes"
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </div>

          {!interviewId ? (
            <Button onClick={initializeInterview} isLoading={saving}>
              {tr("interview.assignment.createDraft", "Create / Load interview schedule")}
            </Button>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Interview ID: {interviewId}</p>
          )}

          {scheduledAt && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm">
              <p className="font-semibold text-emerald-400">
                {tr("interview.assignment.scheduled", "Interview scheduled: {{date}}", {
                  date: new Date(scheduledAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US"),
                })}
              </p>
              {meetingLink && (
                <a href={meetingLink} target="_blank" rel="noreferrer" className="text-emerald-400 underline">
                  {tr("interview.assignment.openMeeting", "Open meeting link")}
                </a>
              )}
            </div>
          )}

          {bookingToken && (
            <p className="text-xs text-[var(--text-muted)] break-all">Booking token: {bookingToken}</p>
          )}

          {/* Interviewer search + grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{tr("interview.assignment.selectInterviewers", "Select interviewers")}</p>
              <span className="text-xs text-[var(--text-muted)]">{selectedInterviewers.length} sélectionné(s) · {memberTotal} total</span>
            </div>

            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={tr("interview.assignment.searchPlaceholder", "Search by name or email…")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>

            {loadingMembers && members.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">{tr("interview.assignment.membersLoading", "Loading…")}</p>
            ) : members.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">{tr("interview.assignment.noResults", "No results for \"{{term}}\"").replace("{{term}}", memberSearch)}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {members.map((member) => {
                  const checked = selectedInterviewers.includes(member.userId);
                  const memberRole = interviewerRoles[member.userId] ?? "MANDATORY";
                  return (
                    <div
                      key={member.userId}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        checked
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)] bg-[var(--bg-surface)] border border-[var(--border)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleInterviewer(member.userId)}
                        className="w-full text-left"
                      >
                        <p className="font-medium text-[var(--text-primary)] truncate">{member.fullName ?? member.email}</p>
                        {member.fullName && <p className="text-xs text-[var(--text-muted)] truncate">{member.email}</p>}
                      </button>
                      {checked && (
                        <div className="mt-1.5 flex gap-1">
                          <button
                            type="button"
                            onClick={() => setInterviewerRoles((prev) => ({ ...prev, [member.userId]: "MANDATORY" }))}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              memberRole === "MANDATORY"
                                ? "bg-[var(--accent)]/20 border-[var(--accent)]/40 text-[var(--accent)]"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40"
                            }`}
                          >
                            Obligatoire
                          </button>
                          <button
                            type="button"
                            onClick={() => setInterviewerRoles((prev) => ({ ...prev, [member.userId]: "SECONDARY" }))}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              memberRole === "SECONDARY"
                                ? "bg-sky-400/20 border-sky-400/40 text-sky-400"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:border-sky-400/40"
                            }`}
                          >
                            Secondaire
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {memberHasMore && (
              <button
                type="button"
                onClick={loadMoreMembers}
                disabled={loadingMembers}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
              >
                {loadingMembers ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                Charger plus de membres
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={saveInterviewers} isLoading={saving} disabled={!interviewId}>
              {tr("interview.assignment.saveInterviewers", "Save interviewers")}
            </Button>
            <Button variant="secondary" onClick={() => loadAvailability()} isLoading={saving} disabled={!interviewId}>
              {tr("interview.assignment.proposeSlots", "Propose slots")}
            </Button>
            <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
              <input type="checkbox" checked={autoRefreshEnabled} onChange={(event) => setAutoRefreshEnabled(event.target.checked)} />
              {tr("interview.assignment.autoRefresh", "Auto-refresh (60s)")}
            </label>
            {refreshingSlots && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {tr("interview.assignment.updating", "Updating...")}
              </span>
            )}
          </div>
        </div>
      </Card>

      {interviewId && (
        <Card
          title={tr("interview.assignment.calendar.title", "Interview calendar")}
          subtitle={`Timezone: ${timezone}`}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">{tr("interview.assignment.filters", "Filters:")}</p>
              {([
                ["ALL", tr("interview.assignment.filter.all", "All day")],
                ["MORNING", tr("interview.assignment.filter.morning", "Morning")],
                ["AFTERNOON", tr("interview.assignment.filter.afternoon", "Afternoon")],
                ["EVENING", tr("interview.assignment.filter.evening", "Evening")],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTimeFilter(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    timeFilter === value
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {bestSuggestions.length > 0 && (
              <div className="rounded-xl border border-blue-400/20 bg-blue-400/10 p-3">
                <p className="mb-2 text-sm font-semibold text-blue-400">{tr("interview.assignment.bestSlots", "Best 3 suggested slots")}</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {bestSuggestions.map((slot, index) => (
                    <button
                      key={`${slot.start}-best-${index}`}
                      type="button"
                      onClick={() => { setSelectedSlot(slot.start); setSelectedDay(new Date(slot.start).toISOString().slice(0, 10)); }}
                      className={`rounded-lg border bg-[var(--bg-surface)] border border-[var(--border)] p-2 text-left text-xs transition-colors ${
                        selectedSlot === slot.start ? "border-[var(--accent)]" : "border-blue-100 hover:border-[var(--accent)]"
                      }`}
                    >
                      <p className="font-semibold text-[var(--text-primary)]">
                        {new Date(slot.start).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
                      </p>
                      <p className="text-blue-400">Score: {slot.score}/100</p>
                      <p className="text-[var(--text-secondary)]">Load: {slot.loadScore}/100</p>
                      <p className="text-[var(--text-secondary)]">Proximity: {slot.proximityScore}/100</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
              {visibleDays.map((day) => {
                const dayKey = day.toISOString().slice(0, 10);
                const daySlots = groupedSlots[dayKey] ?? [];
                const selected = selectedDay === dayKey;
                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => setSelectedDay(dayKey)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      selected ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <div className="font-semibold capitalize">
                      {day.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {daySlots.length > 0
                        ? tr("interview.assignment.slotsCount", "{{count}} slot(s)", { count: daySlots.length })
                        : tr("interview.assignment.noSlotsDay", "None")}
                    </div>
                  </button>
                );
              })}
            </div>

            {weekStartKey && weekDays.length === 7 && (
              <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{tr("interview.assignment.weekView", "Week view (hourly columns)")}</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => { const prev = new Date(weekStartKey); prev.setDate(prev.getDate() - 7); setWeekStartKey(getDayKey(prev)); }}>
                      {tr("interview.assignment.prevWeek", "Week -1")}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { const next = new Date(weekStartKey); next.setDate(next.getDate() + 7); setWeekStartKey(getDayKey(next)); }}>
                      {tr("interview.assignment.nextWeek", "Week +1")}
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] table-fixed border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-left">{tr("interview.assignment.weekHeader.day", "Day")}</th>
                        {hourColumns.map((hour) => (
                          <th key={`h-${hour}`} className="border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                            {`${String(hour).padStart(2, "0")}:00`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weekDays.map((day) => {
                        const dayKey = getDayKey(day);
                        return (
                          <tr key={`row-${dayKey}`}>
                            <td className="border border-[var(--border)] p-2 font-semibold capitalize">
                              {day.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { weekday: "long", day: "2-digit", month: "2-digit" })}
                            </td>
                            {hourColumns.map((hour) => {
                              const cellSlots = weeklySlotMap[`${dayKey}-${hour}`] ?? [];
                              const first = cellSlots[0];
                              const selected = Boolean(first && selectedSlot === first.start);
                              return (
                                <td key={`${dayKey}-${hour}`} className="border border-[var(--border)] p-1 align-top">
                                  {first ? (
                                    <button
                                      type="button"
                                      onClick={() => { setSelectedDay(dayKey); setSelectedSlot(first.start); }}
                                      className={`w-full rounded-md px-2 py-1 text-left transition-colors ${
                                        selected ? "bg-[var(--accent)]/10 text-[var(--text-primary)]" : "bg-emerald-400/10 text-emerald-400 hover:bg-[var(--accent)]/10"
                                      }`}
                                    >
                                      <div>{new Date(first.start).toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</div>
                                      {cellSlots.length > 1 && <div className="text-[10px] text-[var(--text-secondary)]">+{cellSlots.length - 1}</div>}
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-[var(--text-muted)]">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedDaySlots.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {selectedDaySlots.map((slot) => {
                  const selected = selectedSlot === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        selected ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <div className="font-semibold">{new Date(slot.start).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}</div>
                      <div className="text-xs text-[var(--text-muted)]">{new Date(slot.end).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                {tr("interview.assignment.noSlots", "No slots available on this day. Choose another day or use manual rescheduling.")}
              </p>
            )}

            <Button onClick={confirmSchedule} isLoading={saving} disabled={!selectedSlot || saving} className="w-full">
              {state === "SCHEDULED"
                ? tr("interview.assignment.reschedule", "Reschedule on this slot")
                : tr("interview.assignment.scheduleSlot", "Schedule on this slot")}
            </Button>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{tr("interview.assignment.manualReschedule", "Manual rescheduling")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="datetime-local"
                  value={manualLocalDateTime}
                  onChange={(event) => setManualLocalDateTime(event.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
                <Button type="button" variant="outline" onClick={scheduleManualDate} disabled={!manualLocalDateTime || saving}>
                  {tr("interview.assignment.apply", "Apply")}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-400">{success}</p>}
    </div>
  );
}
