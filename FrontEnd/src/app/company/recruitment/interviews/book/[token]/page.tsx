"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BookingSlotPicker from "./BookingSlotPicker";
import { getBookingByToken, InterviewSlot } from "@/lib/api";
import { useParams } from "next/navigation";
import { getClientLocale, t } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";

export default function InterviewBookingPage() {
  const routeParams = useParams<{ token: string }>();
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const token = Array.isArray(routeParams.token) ? routeParams.token[0] : routeParams.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [slots, setSlots] = useState<InterviewSlot[]>([]);

  const loadBooking = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!token) {
        setError(tr("interviews.booking.error.invalidLink", "Invalid or expired booking link."));
        return;
      }

      const data = await getBookingByToken(token);
      if (!data) {
        setError(tr("interviews.booking.error.invalidLink", "Invalid or expired booking link."));
        return;
      }

      setRoleTitle(data.roleTitle);
      setStatus(data.status);
      setSlots(data.slots || []);
    } catch {
      setError(tr("interviews.booking.error.loadSlots", "Unable to load available slots."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [token]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <p className="text-center text-sm text-[var(--text-muted)]">{tr("interviews.booking.loading", "Loading availability...")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-16 space-y-4 text-center">
        <p className="text-sm font-semibold text-red-400">{error}</p>
        <Link href={ROUTES.login} className="text-sm font-semibold text-[var(--accent)] hover:underline">
          {tr("interviews.booking.backHome", "Back to home")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-10">
      <BookingSlotPicker
        token={token ?? ""}
        roleTitle={roleTitle}
        status={status}
        slots={slots}
        onRefresh={loadBooking}
      />
    </div>
  );
}
