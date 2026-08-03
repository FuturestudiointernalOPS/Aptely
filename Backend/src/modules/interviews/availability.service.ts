/**
 * availability.service.ts
 *
 * Pure function to compute available interview slots.
 * Given busy windows (calendar blocks), compute free slots
 * that fit the requested duration.
 *
 * Deterministic, no side effects, 100% testable.
 */

export interface BusyWindow {
  start: string; // ISO 8601 datetime
  end: string;
}

export interface TimeRange {
  from: string; // ISO 8601 datetime
  to: string;
}

export interface AvailabilitySlot {
  start: string; // ISO 8601 datetime (with .000Z)
  end: string;
}

export interface ParticipantAvailability {
  userId: string;
  email: string;
  name?: string;
  busyWindows: BusyWindow[];
  calendarConnected: boolean;
  role?: "MANDATORY" | "SECONDARY"; // default: MANDATORY
}

export interface SlotParticipant {
  userId: string;
  email: string;
  name?: string;
}

export interface AvailabilitySlotEnriched {
  start: string;
  end: string;
  availableParticipants: SlotParticipant[];
  unavailableParticipants: SlotParticipant[];
  availableMandatory: SlotParticipant[];
  unavailableMandatory: SlotParticipant[];
  availableSecondary: SlotParticipant[];
  unavailableSecondary: SlotParticipant[];
  isValid: boolean;
}

/**
 * computeCandidateSlots — Compute available slots for interview scheduling.
 *
 * Algorithm:
 * 1. Parse all busy windows into intervals
 * 2. Sort and merge overlapping intervals
 * 3. Find gaps between merged intervals
 * 4. Generate slots of requested duration within gaps
 * 5. Return slots in chronological order (stable)
 *
 * @param busyWindows — Array of occupied time blocks
 * @param range — Requested search range (from/to)
 * @param slotMinutes — Duration of each slot (30, 45, 60, 90 min)
 * @param timezone — IANA timezone for display (not used for calculation, all inputs are ISO)
 * @returns Array of available slots, sorted by start time
 */
export function computeCandidateSlots(
  busyWindows: BusyWindow[],
  range: TimeRange,
  slotMinutes: number,
  _timezone: string  // Not used in calculation (all inputs are ISO), kept for API contract
): AvailabilitySlot[] {
  // Parse range boundaries
  const rangeStart = new Date(range.from).getTime();
  const rangeEnd = new Date(range.to).getTime();

  if (rangeStart >= rangeEnd) {
    return [];
  }

  const slotDurationMs = slotMinutes * 60 * 1000;

  // Parse and normalize busy windows to timestamps
  const busyIntervals: Array<{ start: number; end: number }> = busyWindows.map((w) => ({
    start: new Date(w.start).getTime(),
    end: new Date(w.end).getTime(),
  }));

  // Sort intervals by start time
  busyIntervals.sort((a, b) => a.start - b.start);

  // Merge overlapping/adjacent intervals
  const mergedIntervals: Array<{ start: number; end: number }> = [];
  for (const interval of busyIntervals) {
    if (mergedIntervals.length === 0) {
      mergedIntervals.push(interval);
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1];
      // If overlap or adjacent, merge
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        mergedIntervals.push(interval);
      }
    }
  }

  // Generate free slots from gaps
  const slots: AvailabilitySlot[] = [];
  let currentStart = rangeStart;

  for (const busy of mergedIntervals) {
    // Gap before this busy window?
    if (currentStart < busy.start) {
      const gapStart = Math.max(currentStart, rangeStart);
      const gapEnd = Math.min(busy.start, rangeEnd);

      // How many slots fit in this gap?
      let slotStart = gapStart;
      while (slotStart + slotDurationMs <= gapEnd) {
        slots.push({
          start: new Date(slotStart).toISOString(),
          end: new Date(slotStart + slotDurationMs).toISOString(),
        });
        slotStart += slotDurationMs;
      }
    }

    currentStart = Math.max(currentStart, busy.end);
  }

  // Gap after last busy window (until rangeEnd)?
  {
    const gapStart = Math.max(currentStart, rangeStart);
    const gapEnd = rangeEnd;

    let slotStart = gapStart;
    while (slotStart + slotDurationMs <= gapEnd) {
      slots.push({
        start: new Date(slotStart).toISOString(),
        end: new Date(slotStart + slotDurationMs).toISOString(),
      });
      slotStart += slotDurationMs;
    }
  }

  // Ensure stable sort and format with .000Z precision
  return slots
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((s) => ({
      start: new Date(s.start).toISOString(),
      end: new Date(s.end).toISOString(),
    }));
}

// ─── Per-Participant Availability ─────────────────────────────────────────────

function getLocalTimeInfo(utcMs: number, tz: string): { hour: number; minute: number; weekdayIndex: number } {
  const date = new Date(utcMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "9";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "0";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    hour: parseInt(hourStr, 10) % 24,
    minute: parseInt(minuteStr, 10),
    weekdayIndex: weekdayMap[weekday] ?? 1,
  };
}

/**
 * computeSlotsWithParticipantAvailability
 *
 * Generates all potential interview slots within working hours, then annotates
 * each slot with which participants are available/unavailable based on their
 * individual calendar busy windows.
 *
 * Participants without a connected calendar are treated as available (unknown).
 */
export function computeSlotsWithParticipantAvailability(
  participants: ParticipantAvailability[],
  range: TimeRange,
  slotMinutes: number,
  timezone: string,
  workingHoursStart = 9,
  workingHoursEnd = 18
): AvailabilitySlotEnriched[] {
  const rangeStart = new Date(range.from).getTime();
  const rangeEnd = new Date(range.to).getTime();

  if (rangeStart >= rangeEnd) return [];

  const slotDurationMs = slotMinutes * 60 * 1000;

  // Pre-process: parse each participant's busy windows into numeric intervals
  const participantData = participants.map((p) => ({
    userId: p.userId,
    email: p.email,
    name: p.name,
    calendarConnected: p.calendarConnected,
    role: p.role ?? "MANDATORY" as "MANDATORY" | "SECONDARY",
    intervals: p.busyWindows
      .map((w) => ({ start: new Date(w.start).getTime(), end: new Date(w.end).getTime() }))
      .filter((i) => i.start < i.end)
      .sort((a, b) => a.start - b.start),
  }));

  const hasConnectedCalendars = participantData.some((p) => p.calendarConnected);

  const SNAP_MS = 15 * 60 * 1000;
  const slots: AvailabilitySlotEnriched[] = [];
  let cursor = Math.ceil(rangeStart / SNAP_MS) * SNAP_MS;

  while (cursor + slotDurationMs <= rangeEnd) {
    const slotEnd = cursor + slotDurationMs;
    const { hour: startHour, minute: startMinute, weekdayIndex } = getLocalTimeInfo(cursor, timezone);
    const { hour: endHour, minute: endMinute } = getLocalTimeInfo(slotEnd, timezone);

    const startDecimal = startHour + startMinute / 60;
    const endDecimal = endHour + endMinute / 60;

    const isWeekday = weekdayIndex >= 1 && weekdayIndex <= 5;
    // startDecimal < endDecimal guards against midnight-crossing slots (e.g. 23:45→00:15)
    const fitsWorkHours =
      startDecimal >= workingHoursStart &&
      endDecimal <= workingHoursEnd &&
      startDecimal < endDecimal;

    if (isWeekday && fitsWorkHours) {
      const available: SlotParticipant[] = [];
      const unavailable: SlotParticipant[] = [];

      for (const p of participantData) {
        if (!p.calendarConnected) {
          available.push({ userId: p.userId, email: p.email, name: p.name });
          continue;
        }
        const isBusy = p.intervals.some((i) => i.start < slotEnd && i.end > cursor);
        if (isBusy) {
          unavailable.push({ userId: p.userId, email: p.email, name: p.name });
        } else {
          available.push({ userId: p.userId, email: p.email, name: p.name });
        }
      }

      const availableIds = new Set(available.map((p) => p.userId));

      const availableMandatory = participantData
        .filter((p) => p.role === "MANDATORY" && availableIds.has(p.userId))
        .map((p) => ({ userId: p.userId, email: p.email, name: p.name }));
      const unavailableMandatory = participantData
        .filter((p) => p.role === "MANDATORY" && !availableIds.has(p.userId))
        .map((p) => ({ userId: p.userId, email: p.email, name: p.name }));
      const availableSecondary = participantData
        .filter((p) => p.role === "SECONDARY" && availableIds.has(p.userId))
        .map((p) => ({ userId: p.userId, email: p.email, name: p.name }));
      const unavailableSecondary = participantData
        .filter((p) => p.role === "SECONDARY" && !availableIds.has(p.userId))
        .map((p) => ({ userId: p.userId, email: p.email, name: p.name }));

      const hasSecondaries = participantData.some((p) => p.role === "SECONDARY");
      const isValid =
        unavailableMandatory.length === 0 &&
        (!hasSecondaries || availableSecondary.length >= 1);

      // When calendars are connected, skip slots that are not valid
      if (hasConnectedCalendars && !isValid) {
        cursor += SNAP_MS;
        continue;
      }

      slots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(slotEnd).toISOString(),
        availableParticipants: available,
        unavailableParticipants: unavailable,
        availableMandatory,
        unavailableMandatory,
        availableSecondary,
        unavailableSecondary,
        isValid,
      });
    }

    cursor += SNAP_MS;
  }

  return slots;
}
