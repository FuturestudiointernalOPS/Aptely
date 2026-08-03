"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Video,
  User, Briefcase, MapPin, Loader2, Users,
  CheckCircle2, XCircle, CircleDot, Filter
} from "lucide-react";
import { useAuth, useRequireInstitution } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { getClientLocale, t } from "@/lib/i18n";
import { interviewNotesPath } from "@/lib/routes";
import {
  getInstitutionInterviews,
  getAssignedToMeInterviews,
  type AssignedInterview,
} from "@/lib/api.interviews";
import { getPersonalSettings, updatePersonalSettings, type PersonalSettings } from "@/lib/api";


interface CalendarEvent {
  id: string;
  applicationId: string;
  date: Date;
  type: "interview";
  title: string;
  candidateName: string;
  roleTitle: string;
  status: string;
  interviewType: string;
  meetingLocation: string | null;
  interviewers: Array<{ userId: string; fullName: string | null }>;
  isAssignedToMe: boolean;
}

type CalendarFilter = "all" | "interviews" | "mine";

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-amber-400/20 text-amber-400",
  SCHEDULED: "bg-blue-400/20 text-blue-400",
  PLANIFIÉ: "bg-blue-400/20 text-blue-400",
  CONFIRMED: "bg-blue-400/20 text-blue-400",
  COMPLETED: "bg-emerald-400/20 text-emerald-400",
  TERMINÉ: "bg-emerald-400/20 text-emerald-400",
  CANCELLED: "bg-red-400/20 text-red-400",
  ANNULÉ: "bg-red-400/20 text-red-400",
  NO_SHOW: "bg-red-400/20 text-red-400",
};

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-amber-400",
  SCHEDULED: "bg-blue-400",
  PLANIFIÉ: "bg-blue-400",
  CONFIRMED: "bg-blue-400",
  COMPLETED: "bg-emerald-400",
  TERMINÉ: "bg-emerald-400",
  CANCELLED: "bg-[var(--border)]",
  ANNULÉ: "bg-[var(--border)]",
  NO_SHOW: "bg-[var(--border)]",
};

function linkifyText(text: string) {
  if (typeof window === "undefined") return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{part}</a>
    ) : (
      part
    )
  );
}

function statusLabel(status: string, locale: string): string {
  const labels: Record<string, { fr: string; en: string }> = {
    DRAFT: { fr: "Brouillon", en: "Draft" },
    SCHEDULED: { fr: "Planifié", en: "Scheduled" },
    PLANIFIÉ: { fr: "Planifié", en: "Scheduled" },
    CONFIRMED: { fr: "Confirmé", en: "Confirmed" },
    COMPLETED: { fr: "Terminé", en: "Completed" },
    TERMINÉ: { fr: "Terminé", en: "Completed" },
    CANCELLED: { fr: "Annulé", en: "Cancelled" },
    ANNULÉ: { fr: "Annulé", en: "Cancelled" },
    NO_SHOW: { fr: "Absent", en: "No-show" },
  };
  return labels[status]?.[locale === "fr" ? "fr" : "en"] ?? status;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function CompanyCalendarPage() {
  useRequireInstitution();
  const { user, loading: authLoading } = useAuth();
  const { active } = useWorkspace();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
  const [fetching, setFetching] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [calcomLink, setCalcomLink] = useState<string | null>(null);
  const [personalSettings, setPersonalSettings] = useState<PersonalSettings | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncUsername, setSyncUsername] = useState("");
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncError, setSyncError] = useState("");

  const locale = getClientLocale();

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      setFetching(true);
      try {
        const [institutionInterviews, assignedInterviews] = await Promise.all([
          getInstitutionInterviews(),
          getAssignedToMeInterviews().catch(() => [] as AssignedInterview[]),
        ]);

        const assignedIds = new Set(
          (assignedInterviews as AssignedInterview[]).map((a) => a.id),
        );

        const calEvents: CalendarEvent[] = institutionInterviews
          .filter((item) => item.scheduledAt)
          .map((item) => ({
            id: item.id,
            applicationId: item.applicationId,
            date: new Date(item.scheduledAt!),
            type: "interview" as const,
            title: item.name || t(locale, "calendar.interviewFallback", "Interview"),
            candidateName: item.candidateName,
            roleTitle: item.roleTitle,
            status: item.status,
            interviewType: item.interviewType,
            meetingLocation: item.meetingLocation,
            interviewers: item.interviewers,
            isAssignedToMe: assignedIds.has(item.id),
          }));

        calEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
        setEvents(calEvents);

        // Check if Cal.com is configured — this is also where the sync popup saves to.
        try {
          const prefs = await getPersonalSettings();
          if (prefs) {
            setPersonalSettings(prefs);
            if (prefs.calcomLink) setCalcomLink(prefs.calcomLink);
          }
        } catch {
          /* Cal.com config not available */
        }
      } catch {
        /* events load error */
      } finally {
        setFetching(false);
      }
    };
    void load();
  }, [authLoading, user]);

  const filteredEvents = useMemo(() => {
    if (filter === "mine") return events.filter((e) => e.isAssignedToMe);
    return events;
  }, [events, filter]);

  const eventsThisMonth = useMemo(
    () => filteredEvents.filter((e) => e.date.getFullYear() === viewYear && e.date.getMonth() === viewMonth),
    [filteredEvents, viewYear, viewMonth],
  );

  const eventsForDay = (day: number) =>
    eventsThisMonth.filter((e) => e.date.getDate() === day);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return filteredEvents.filter((e) => isSameDay(e.date, selectedDay));
  }, [selectedDay, filteredEvents]);

  const upcomingEvents = useMemo(
    () => filteredEvents
      .filter((e) => e.date >= new Date(today.setHours(0, 0, 0, 0)))
      .slice(0, 8),
    [filteredEvents],
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const days = locale === "fr" ? DAYS_FR : DAYS_EN;
  const months = locale === "fr" ? MONTHS_FR : MONTHS_EN;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((v) => v - 1); }
    else setViewMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((v) => v + 1); }
    else setViewMonth((m) => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today);
  };

  // Cal.com sync — handled inline as a popup so the whole setup happens right here,
  // without bouncing to a Settings tab that isn't the one holding this field.
  const openSyncModal = () => {
    setSyncUsername("");
    setSyncError("");
    setSyncModalOpen(true);
  };

  const handleSyncSave = async () => {
    const username = syncUsername.trim();
    if (!username) {
      setSyncError(t(locale, "calendar.sync.error.required", "Enter your Cal.com username."));
      return;
    }
    setSyncSaving(true);
    setSyncError("");
    const base = personalSettings ?? (await getPersonalSettings());
    if (!base) {
      setSyncSaving(false);
      setSyncError(t(locale, "calendar.sync.error.save", "Couldn't save. Please try again."));
      return;
    }
    const updated = await updatePersonalSettings({ ...base, calcomLink: username });
    setSyncSaving(false);
    if (!updated) {
      setSyncError(t(locale, "calendar.sync.error.save", "Couldn't save. Please try again."));
      return;
    }
    setPersonalSettings(updated);
    setCalcomLink(updated.calcomLink ?? username);
    setSyncModalOpen(false);
  };

  const calendarCells: Array<{ day: number | null }> = [
    ...Array(firstDay).fill({ day: null }),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];
  const remainder = calendarCells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) calendarCells.push({ day: null });
  }

  if (authLoading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {active.kind === "institution" ? active.membership.institution_name : t(locale, "calendar.institutionFallback", "Institution")}
          </p>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mt-1">
            {t(locale, "nav.calendar", "Agenda")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t(locale, "calendar.subtitle", "Scheduled interviews, activities and recruiting deadlines.")}
          </p>
        </div>

        {/* Cal.com sync card */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${calcomLink ? 'bg-emerald-400/10' : 'bg-[var(--bg-raised)]'}`}>
              {calcomLink ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Video className="w-5 h-5 text-[var(--text-muted)]" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {calcomLink ? t(locale, "calendar.sync.connected", "Cal.com connecté") : t(locale, "calendar.sync.notConnected", "Cal.com non connecté")}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {calcomLink ? t(locale, "calendar.sync.connectedHint", "Vos entretiens sont synchronisés") : t(locale, "calendar.sync.notConnectedHint", "Connectez votre agenda pour synchroniser vos disponibilités")}
              </p>
            </div>
          </div>
          <button type="button" onClick={openSyncModal} className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            {t(locale, "calendar.sync.edit", "Modifier")}
          </button>
        </div>

        {/* Setup guide */}
        <details className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden group">
          <summary className="px-4 sm:px-6 py-3 cursor-pointer flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors select-none">
            <span className="text-base">{t(locale, "calendar.howItWorks.title", "Comment fonctionne l'agenda")}</span>
            <ChevronRight size={14} className="ml-auto transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 sm:px-6 pb-4 space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            <div>
              <p className="font-bold text-[var(--text-primary)] mb-2">{t(locale, "calendar.howItWorks.setup.title", "Comment connecter Cal.com ?")}</p>
              <div className="space-y-2 pl-1">
                {[1,2,3].map(n => (
                  <div key={n} className="flex gap-2"><span className="font-bold text-[var(--accent)] shrink-0">{n}.</span><span>{linkifyText(t(locale, `calendar.howItWorks.setup.step${n}`, ""))}</span></div>
                ))}
              </div>
              <p className="mt-3 text-[var(--text-primary)] font-medium">{t(locale, "calendar.howItWorks.setup.conclusion", "")}</p>
            </div>
          </div>
        </details>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-[var(--text-muted)]" />
          {([
            ["all", t(locale, "calendar.filter.all", "All")],
            ["interviews", t(locale, "calendar.filter.interviews", "Interviews")],
            ["mine", t(locale, "calendar.filter.mine", "My interviews")],
          ] as [CalendarFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
                ${filter === key
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto text-xs text-[var(--text-muted)]">
            {t(locale, "calendar.eventCount", "{{count}} event(s)", { count: filteredEvents.length })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

          {/* Calendar grid */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <button onClick={prevMonth} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {months[viewMonth]} {viewYear}
                </span>
                <button onClick={goToday} className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
                  {t(locale, "calendar.today", "Today")}
                </button>
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--border)]">
              {days.map((d) => (
                <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
              {calendarCells.map((cell, idx) => {
                if (!cell.day) {
                  return <div key={`empty-${idx}`} className="h-16 sm:h-20 border-r border-b border-[var(--border)] last:border-r-0" />;
                }
                const dayEvents = eventsForDay(cell.day);
                const cellDate = new Date(viewYear, viewMonth, cell.day);
                const isToday = isSameDay(cellDate, new Date());
                const isSelected = selectedDay ? isSameDay(cellDate, selectedDay) : false;
                const isPast = cellDate < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <button
                    key={cell.day}
                    onClick={() => setSelectedDay(isSelected ? null : cellDate)}
                    className={`h-16 sm:h-20 border-r border-b border-[var(--border)] last:border-r-0 p-1 text-left transition-colors relative
                      ${isSelected ? "bg-[var(--accent-dim)]" : "hover:bg-[var(--bg-raised)]"}
                      ${isPast ? "opacity-60" : ""}
                    `}
                  >
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? "bg-[var(--accent)] text-white" : isSelected ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}
                    `}>
                      {cell.day}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map((ev, i) => (
                        <div key={i} className="flex items-center gap-1 text-[9px] font-semibold truncate">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[ev.status] || "bg-blue-400"}`} />
                          <span className="text-[var(--text-muted)] truncate">{ev.candidateName}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[9px] text-[var(--text-muted)] px-1">+{dayEvents.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Selected day events */}
            {selectedDay ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {selectedDay.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </p>
                </div>
                {selectedDayEvents.length === 0 ? (
                  <div className="p-4">
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Calendar className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
                      <p className="text-xs text-[var(--text-muted)] text-center">
                        {t(locale, "calendar.noEventsToday", "No events today.")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {selectedDayEvents.map((ev) => (
                      <InterviewEventCard key={ev.id} ev={ev} locale={locale} />
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Upcoming events */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {t(locale, "calendar.upcomingInterviews", "Upcoming interviews")}
                </p>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="p-4">
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Calendar className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
                    <p className="text-xs text-[var(--text-muted)] text-center">
                      {t(locale, "calendar.noUpcoming", "No interview scheduled.")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)] max-h-[400px] overflow-y-auto">
                  {upcomingEvents.map((ev) => (
                    <InterviewEventCard key={ev.id} ev={ev} locale={locale} compact />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cal.com sync popup */}
      {syncModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !syncSaving && setSyncModalOpen(false)}
        >
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Video size={16} className="text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {t(locale, "calendar.sync.modalTitle", "Connect your calendar")}
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t(locale, "calendar.sync.instructions.prefix", "1) Allez sur")}{" "}
              <a href="https://cal.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">cal.com</a>
              {" "}{t(locale, "calendar.sync.instructions.suffix", "→ Settings → My Profile 2) Copiez votre username 3) Collez-le ci-dessous")}
            </p>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t(locale, "calendar.sync.usernameLabel", "Cal.com username")}
              </label>
              <input
                type="text"
                value={syncUsername}
                onChange={(e) => setSyncUsername(e.target.value)}
                placeholder={t(locale, "calendar.sync.usernamePlaceholder", "e.g. jane-doe/30min")}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                autoFocus
              />
            </div>
            {syncError && <p className="text-xs text-red-400">{syncError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSyncModalOpen(false)}
                disabled={syncSaving}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-raised)] transition-colors"
              >
                {t(locale, "common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSyncSave()}
                disabled={syncSaving}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {syncSaving ? t(locale, "calendar.sync.saving", "Connecting…") : t(locale, "calendar.sync.save", "Connect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InterviewEventCard({
  ev,
  locale,
  compact = false,
}: {
  ev: CalendarEvent;
  locale: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={interviewNotesPath(ev.applicationId, ev.id)}
      className="block rounded-xl hover:bg-[var(--bg-raised)] transition-colors"
    >
      <div className="flex items-start gap-3 p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        ev.isAssignedToMe ? "bg-[var(--accent-dim)]" : "bg-[var(--bg-raised)]"
      }`}>
        <User size={14} className={ev.isAssignedToMe ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{ev.candidateName}</p>
          {ev.isAssignedToMe && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] shrink-0">
              {t(locale as "fr" | "en", "calendar.me", "Me")}
            </span>
          )}
        </div>
        <p className={`text-[11px] truncate flex items-center gap-1 ${compact ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}`}>
          <Briefcase size={10} className="shrink-0" />
          {ev.roleTitle}
        </p>
        {!compact && (
          <>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
              <Clock size={10} />
              {ev.date.toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {ev.date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short" })}
            </div>
            {ev.meetingLocation && (
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)] flex items-center gap-1 truncate">
                <MapPin size={9} />
                {ev.meetingLocation}
              </p>
            )}
          </>
        )}
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${STATUS_COLORS[ev.status] || "bg-slate-400/20 text-slate-400"}`}>
            {ev.status === "COMPLETED" || ev.status === "TERMINÉ" ? (
              <CheckCircle2 size={9} />
            ) : ev.status === "CANCELLED" || ev.status === "ANNULÉ" ? (
              <XCircle size={9} />
            ) : (
              <CircleDot size={9} />
            )}
            {statusLabel(ev.status, locale)}
          </span>
          {!compact && ev.interviewers.length > 0 && (
            <span className="text-[9px] text-[var(--text-muted)] flex items-center gap-1">
              <Users size={9} />
              {ev.interviewers.map((i) => i.fullName || i.userId).join(", ")}
            </span>
          )}
        </div>
      </div>
      </div>
    </Link>
  );
}
