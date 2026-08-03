"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { confirmBooking, InterviewSlot } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";

interface BookingSlotPickerProps {
  token: string;
  roleTitle?: string;
  status?: string;
  slots: InterviewSlot[];
  onRefresh?: () => Promise<void> | void;
}

function formatSlot(iso: string, locale: string): string {
  const date = new Date(iso);
  return date.toLocaleString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookingSlotPicker({
  token,
  roleTitle,
  status,
  slots,
  onRefresh,
}: BookingSlotPickerProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ meetingLink?: string | null } | null>(null);
  const [displaySlots, setDisplaySlots] = useState<InterviewSlot[]>(slots);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );

  useEffect(() => {
    setDisplaySlots(slots);
    if (selectedStart && !slots.some((slot) => slot.start === selectedStart)) {
      setSelectedStart(null);
    }
  }, [slots, selectedStart]);

  const onConfirm = async () => {
    if (!selectedStart || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await confirmBooking(token, {
        start: selectedStart,
        timezone,
      });

      if (!result.success) {
        if (Array.isArray(result.availableSlots) && result.availableSlots.length > 0) {
          setDisplaySlots(result.availableSlots);
        }
        setSelectedStart(null);
        setError(result.message || tr("interviews.booking.error.confirmSlot", "Unable to confirm this slot. Please try another one."));
        return;
      }

      setSuccess({ meetingLink: result.meetingLink });
    } catch {
      setError(tr("interviews.booking.error.confirmGeneric", "An error occurred during confirmation."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card title={tr("interviews.booking.success.title", "Interview confirmed")} subtitle={tr("interviews.booking.success.subtitle", "Your appointment is booked.")}>
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {tr("interviews.booking.success.description", "Your interview is scheduled. A confirmation email will be sent to you.")}
          </p>
          {success.meetingLink && (
            <a
              href={success.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              {tr("interviews.booking.success.openMeetingLink", "Open meeting link")}
            </a>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={roleTitle ? `${tr("interviews.booking.card.titlePrefix", "Book interview -")} ${roleTitle}` : tr("interviews.booking.card.title", "Book interview")}
      subtitle={`${tr("interviews.booking.card.status", "Status")}: ${status ?? "PENDING"}`}
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">{tr("interviews.booking.card.timezoneDetected", "Detected timezone")}: {timezone}</p>

        {displaySlots.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">{tr("interviews.booking.card.noSlots", "No slot available at the moment.")}</p>
            <button
              type="button"
              onClick={() => onRefresh?.()}
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              {tr("interviews.booking.card.reloadSlots", "Reload slots")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {displaySlots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                onClick={() => setSelectedStart(slot.start)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  selectedStart === slot.start
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                    : "border-[var(--border)] bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                }`}
              >
                <div className="font-semibold">{formatSlot(slot.start, locale)}</div>
                <div className="text-xs text-[var(--text-muted)]">{tr("interviews.booking.card.end", "End")}: {formatSlot(slot.end, locale)}</div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm font-semibold text-red-400">{error}</p>}

        <Button
          onClick={onConfirm}
          isLoading={isSubmitting}
          disabled={!selectedStart || isSubmitting}
          className="w-full"
        >
          {tr("interviews.booking.card.confirmSlot", "Confirm slot")}
        </Button>
      </div>
    </Card>
  );
}
