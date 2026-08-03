"use client";

import { use, useEffect, useState } from "react";
import {
  Calendar, Clock, CheckCircle2, Video, MapPin,
  Loader2, AlertCircle, ChevronRight,
} from "lucide-react";
import {
  getWaveBookingByToken,
  confirmWaveBooking,
  type WaveBookingData,
} from "@/lib/api.waves";
import { getClientLocale, t } from "@/lib/i18n";

const STATUS_CLS: Record<string, string> = {
  INVITED:   "bg-blue-400/10 text-blue-400 border-blue-400/20",
  BOOKED:    "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  NO_SHOW:   "bg-red-400/10 text-red-400 border-red-400/20",
  PASSED:    "bg-green-400/10 text-green-400 border-green-400/20",
  FAILED:    "bg-rose-400/10 text-rose-400 border-rose-400/20",
  WITHDRAWN: "bg-zinc-400/10 text-zinc-400 border-zinc-400/20",
};

export default function WaveBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(locale, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  function groupByDay(slots: WaveBookingData["availableSlots"]) {
    const groups: Record<string, typeof slots> = {};
    for (const slot of slots) {
      const day = new Date(slot.startsAt).toISOString().split("T")[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push(slot);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }
  const [data, setData] = useState<WaveBookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await getWaveBookingByToken(token);
      if (!cancelled) {
        if (!result) setNotFound(true);
        else setData(result);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [token]);

  const handleConfirm = async () => {
    if (!selectedSlotId) return;
    setConfirming(true);
    setError(null);
    const result = await confirmWaveBooking(token, selectedSlotId);
    if (result?.success) {
      setConfirmed(true);
      const refreshed = await getWaveBookingByToken(token);
      if (refreshed) setData(refreshed);
    } else {
      setError(tr("waveBooking.error.booking", "Unable to confirm booking. The slot may be full or expired."));
    }
    setConfirming(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-aptely-orange" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-8 text-center space-y-4 shadow-lg">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{tr("waveBooking.invalid", "Invalid or expired link")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {tr("waveBooking.invalidDesc", "This invitation link does not exist or has expired. Contact your recruiter.")}
          </p>
        </div>
      </div>
    );
  }

  const currentBooking = data.currentBooking;
  const isAlreadyBooked =
    data.status === "BOOKED" && currentBooking !== null && currentBooking?.cancelledAt === null;
  const grouped = groupByDay(data.availableSlots);
  const statusLabel = tr(`waveBooking.status.${data.status}`, data.status);
  const statusCls = STATUS_CLS[data.status] ?? "bg-zinc-400/10 text-zinc-400 border-zinc-400/20";

  return (
    <div className="min-h-screen bg-app-bg py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header card */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-aptely-orange" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-aptely-orange">
              {tr("waveBooking.header", "Recruitment Interview")}
            </span>
          </div>
          <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">{data.wave.name}</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">{data.wave.roleTitle}</p>
          {data.wave.description && (
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{data.wave.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusCls}`}>
              {statusLabel}
            </span>
            {data.wave.bookingOpenAt && (
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {tr("waveBooking.bookingOpen", "Opens:")} {new Date(data.wave.bookingOpenAt).toLocaleDateString(locale)}
              </span>
            )}
            {data.wave.bookingCloseAt && (
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {tr("waveBooking.bookingClose", "Closes:")} {new Date(data.wave.bookingCloseAt).toLocaleDateString(locale)}
              </span>
            )}
          </div>
        </div>

        {/* Already booked confirmation */}
        {isAlreadyBooked && currentBooking && (
          <div className="bg-emerald-400/5 border border-emerald-400/25 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-[var(--text-primary)]">{tr("waveBooking.confirmed.title", "Slot confirmed")}</h2>
            </div>
            <div className="space-y-2.5">
              {currentBooking.startsAt && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Calendar className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span className="capitalize">{formatDate(currentBooking.startsAt)}</span>
                </div>
              )}
              {currentBooking.startsAt && currentBooking.endsAt && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Clock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span>
                    {formatTime(currentBooking.startsAt)} – {formatTime(currentBooking.endsAt)}
                  </span>
                </div>
              )}
              {currentBooking.meetingProvider && currentBooking.meetingProvider !== "MANUAL" && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Video className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span>{currentBooking.meetingProvider}</span>
                  {currentBooking.meetingLink && (
                    <a
                      href={currentBooking.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-aptely-orange hover:underline flex items-center gap-0.5 ml-1"
                    >
                      {tr("waveBooking.confirmed.join", "Join")} <ChevronRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] pt-1">
              {tr("waveBooking.confirmed.bookedAt", "Booked on")} {new Date(currentBooking.bookedAt).toLocaleString(locale)}
            </p>
          </div>
        )}

        {/* Post-confirm success flash */}
        {confirmed && !isAlreadyBooked && (
          <div className="bg-emerald-400/5 border border-emerald-400/25 rounded-2xl p-6 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-[var(--text-primary)]">{tr("waveBooking.success.title", "Booking confirmed!")}</p>
            <p className="text-xs text-[var(--text-muted)]">{tr("waveBooking.success.email", "You will receive a confirmation by email.")}</p>
          </div>
        )}

        {/* Slot selection */}
        {!isAlreadyBooked && !confirmed && (
          <div className="space-y-4">
            {grouped.length === 0 ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 text-center shadow-sm">
                <Calendar className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">{tr("waveBooking.noSlots.title", "No slots available")}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {tr("waveBooking.noSlots.desc", "All slots are full or the booking period has ended. Contact your recruiter.")}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest px-1">
                  {tr("waveBooking.slots.title", "Available slots — select one")}
                </h2>
                {grouped.map(([day, slots]) => (
                  <div
                    key={day}
                    className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 space-y-3 shadow-sm"
                  >
                    <p className="text-sm font-bold text-[var(--text-primary)] capitalize">
                      {formatDate(day + "T12:00:00")}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {slots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-bold transition-all ${
                            selectedSlotId === slot.id
                              ? "border-aptely-orange bg-aptely-orange/10 text-aptely-orange"
                              : "border-[var(--border)] bg-[var(--bg-surface)]/30 text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:bg-aptely-orange/5"
                          }`}
                        >
                          <span className="text-sm font-bold">{formatTime(slot.startsAt)}</span>
                          <span className="text-[11px] font-normal text-[var(--text-muted)]">
                            {slot.durationMinutes} min
                          </span>
                          {slot.meetingLocation && (
                            <span className="flex items-center gap-0.5 text-[10px] font-normal text-[var(--text-muted)]">
                              <MapPin className="w-2.5 h-2.5" />
                              {slot.meetingLocation}
                            </span>
                          )}
                          {slot.availableSpots > 1 && (
                            <span className="text-[10px] text-emerald-400">
                              {slot.availableSpots} {tr("waveBooking.slots.places", "spots")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selectedSlotId || confirming}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-aptely-orange text-white hover:bg-aptely-orange/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  {confirming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {confirming ? tr("waveBooking.confirm.confirming", "Confirming…") : tr("waveBooking.confirm.button", "Confirm this slot")}
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[11px] text-[var(--text-muted)] text-center pb-4">
          {tr("waveBooking.powered", "Powered by Aptely — If you have any issues, contact your recruiter.")}
        </p>
      </div>
    </div>
  );
}
