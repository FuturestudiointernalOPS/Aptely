"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, Building2, Clock, Video, Briefcase } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { apiFetch } from "@/lib/apiHelper";
import { getClientLocale, t, type Locale } from "@/lib/i18n";
import { ROUTES, createAuthRedirect, individualsMyApplicationsApi } from "@/lib/routes";

interface ApplicationEvent {
  id: string;
  status: string;
  interview_scheduled_at?: string | null;
  interview_id?: string | null;
  interview_status?: string | null;
  interviews?: { id?: string; status: string | null; scheduled_at: string | null }[];
  role: {
    id: string | null;
    title: string;
    institution_name: string | null;
    institution_logo: string | null;
  };
}

interface CalendarEvent {
  date: Date;
  appId: string;
  roleTitle: string;
  institutionName: string | null;
  institutionLogo: string | null;
  interviewStatus: string | null;
}

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // Monday = 0, Sunday = 6
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function InstitutionLogo({ logo, name }: { logo: string | null; name: string | null }) {
  const [error, setError] = useState(false);
  if (logo && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo} alt={name ?? ""}
        onError={() => setError(true)}
        className="w-8 h-8 rounded-lg object-cover border border-[var(--border)] shrink-0"
      />
    );
  }
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] border border-[var(--border)] shrink-0 flex items-center justify-center">
      <span className="text-[10px] font-bold text-[var(--accent)]">{initials}</span>
    </div>
  );
}

export default function CandidateCalendarPage() {
  const locale = getClientLocale();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isPersonal } = useWorkspace();
  const [fetching, setFetching] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(createAuthRedirect(ROUTES.candidate.calendar)); return; }
    if (!isPersonal) { router.replace(ROUTES.company.dashboard); return; }

    const load = async () => {
      setFetching(true);
      try {
        const res = await apiFetch(individualsMyApplicationsApi, "HR", { method: "GET", cache: "no-store" });
        const apps: ApplicationEvent[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        // One event per scheduled interview (an application can have several).
        const calEvents: CalendarEvent[] = apps.flatMap((a) => {
          const interviews = a.interviews ?? (a.interview_scheduled_at
            ? [{ status: a.interview_status ?? null, scheduled_at: a.interview_scheduled_at }]
            : []);
          return interviews
            .filter((i) => i.scheduled_at)
            .map((i) => ({
              date: new Date(i.scheduled_at!),
              appId: a.id,
              roleTitle: a.role.title,
              institutionName: a.role.institution_name,
              institutionLogo: a.role.institution_logo,
              interviewStatus: i.status ?? null,
            }));
        });
        calEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
        setEvents(calEvents);
      } finally {
        setFetching(false);
      }
    };
    void load();
  }, [loading, router, user, isPersonal]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const months = locale === "fr" ? MONTHS_FR : MONTHS_EN;

  const eventsThisMonth = useMemo(() =>
    events.filter((e) => e.date.getFullYear() === viewYear && e.date.getMonth() === viewMonth),
  [events, viewYear, viewMonth]);

  const eventsForDay = (day: number) =>
    eventsThisMonth.filter((e) => e.date.getDate() === day);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return events.filter((e) => isSameDay(e.date, selectedDay));
  }, [selectedDay, events]);

  const upcomingEvents = useMemo(() =>
    events.filter((e) => e.date >= new Date(today.setHours(0, 0, 0, 0))).slice(0, 5),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [events]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(null);
  };

  if (loading || fetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 text-sm text-[var(--text-muted)]">
          {t(locale, "individual.calendar.loading", "Chargement de votre agenda...")}
        </div>
      </div>
    );
  }

  const calendarCells: Array<{ day: number | null }> = [
    ...Array(firstDay).fill({ day: null }),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];
  // Pad to complete last week row
  const remainder = calendarCells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) calendarCells.push({ day: null });
  }

  return (
    <div className="py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t(locale, "individual.calendar.space", "Espace candidat")}
          </p>
          <h1 className="text-page-title text-[var(--text-primary)] mt-1">
            {t(locale, "individual.calendar.title", "Mon Agenda")}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t(locale, "individual.calendar.subtitle", "Vos entretiens et événements à venir.")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

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
                  {t(locale, "individual.calendar.today", "Aujourd'hui")}
                </button>
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--border)]">
              {(locale === "fr" ? DAYS_FR : DAYS_EN).map((d) => (
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
                      ${isPast ? "opacity-50" : ""}
                    `}
                  >
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? "bg-[var(--accent)] text-white" : isSelected ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}
                    `}>
                      {cell.day}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map((ev, i) => (
                        <div key={i} className="text-[9px] font-semibold text-[var(--accent)] bg-[var(--accent-dim)] rounded px-1 truncate">
                          {ev.roleTitle}
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

          {/* Right panel: selected day events or upcoming */}
          <div className="space-y-4">
            {selectedDay && selectedDayEvents.length > 0 ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {selectedDay.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {selectedDayEvents.map((ev) => (
                    <EventCard key={`${ev.appId}-${ev.date.getTime()}`} ev={ev} locale={locale} />
                  ))}
                </div>
              </div>
            ) : selectedDay ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  {t(locale, "individual.calendar.noEvents", "Aucun événement ce jour.")}
                </p>
              </div>
            ) : null}

            {/* Upcoming events */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {t(locale, "individual.calendar.upcoming", "Prochains événements")}
                </p>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="p-4">
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Calendar className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
                    <p className="text-xs text-[var(--text-muted)] text-center">
                      {t(locale, "individual.calendar.noUpcoming", "Aucun entretien planifié.")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {upcomingEvents.map((ev) => (
                    <EventCard key={`${ev.appId}-${ev.date.getTime()}`} ev={ev} locale={locale} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ ev, locale }: { ev: CalendarEvent; locale: Locale }) {
  const isPast = ev.date < new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div className="flex items-start gap-3 p-3">
      <InstitutionLogo logo={ev.institutionLogo} name={ev.institutionName} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{ev.roleTitle}</p>
        <p className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1">
          <Building2 size={10} />
          {ev.institutionName ?? "—"}
        </p>
        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
          <Clock size={10} />
          {ev.date.toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          {ev.date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short" })}
        </div>
        {!isPast && (
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">
            <Video size={9} />
            {t(locale, "individual.calendar.interview", "Entretien")}
          </span>
        )}
      </div>
    </div>
  );
}
