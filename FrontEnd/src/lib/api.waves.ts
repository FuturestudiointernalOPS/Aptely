import { apiFetch } from "./apiHelper";
import { API, mkApiPath, wavesTemplatesApi } from "@/lib/routes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Wave {
  id: string;
  roleId: string;
  templateId: string | null;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "CANCELLED";
  waveOrder: number;
  prerequisiteWaveId: string | null;
  forceAddAllowed: boolean;
  autoPlaceOnMatch: boolean;
  autoPlaceThreshold: number | null;
  bookingOpenAt: string | null;
  bookingCloseAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  candidateCount?: number;
  slotCount?: number;
}

export interface WaveCandidate {
  id: string;
  waveId: string;
  applicationId: string;
  status: string;
  forceAdded: boolean;
  inviteToken: string | null;
  invitedAt: string;
  bookingId: string | null;
  notes: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
}

export interface WaveTemplate {
  id: string;
  institutionId: string;
  name: string;
  description: string | null;
  defaultDurationMinutes: number;
  defaultSlotCapacity: number;
  criteriaJson: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaveBookingData {
  inviteToken: string;
  waveCandidateId: string;
  status: string;
  wave: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    bookingOpenAt: string | null;
    bookingCloseAt: string | null;
    roleTitle: string;
  };
  availableSlots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    meetingProvider: string;
    meetingLocation: string | null;
    availableSpots: number;
  }>;
  currentBooking: {
    id: string;
    slotId: string;
    bookedAt: string;
    cancelledAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
    meetingProvider: string | null;
    meetingLink: string | null;
  } | null;
}

export interface WaveAnalytics {
  waveId: string;
  candidates: {
    total: number;
    byStatus: Record<string, number>;
  };
  slots: {
    total: number;
    totalCapacity: number;
    booked: number;
    available: number;
    fillRate: number;
  };
}

// ─── HR API ───────────────────────────────────────────────────────────────────

export async function listWavesForRole(roleId: string): Promise<Wave[]> {
  const res = await apiFetch(mkApiPath(`/waves/role/${roleId}`), "HR", { method: "GET", cache: "no-store" });
  return Array.isArray(res) ? res : [];
}

export async function createWave(payload: {
  roleId: string;
  name: string;
  description?: string;
  waveOrder?: number;
  templateId?: string;
  bookingOpenAt?: string;
  bookingCloseAt?: string;
  autoPlaceOnMatch?: boolean;
  autoPlaceThreshold?: number;
  prerequisiteWaveId?: string;
  forceAddAllowed?: boolean;
}): Promise<Wave | null> {
  const res = await apiFetch(mkApiPath("/waves"), "HR", { method: "POST", body: JSON.stringify(payload) });
  return res ?? null;
}

export async function updateWave(waveId: string, payload: Partial<{
  name: string;
  description: string | null;
  status: string;
  waveOrder: number;
  bookingOpenAt: string | null;
  bookingCloseAt: string | null;
  autoPlaceOnMatch: boolean;
  autoPlaceThreshold: number | null;
  prerequisiteWaveId: string | null;
  forceAddAllowed: boolean;
}>): Promise<Wave | null> {
  const res = await apiFetch(mkApiPath(`/waves/${waveId}`), "HR", { method: "PATCH", body: JSON.stringify(payload) });
  return res ?? null;
}

export async function deleteWave(waveId: string): Promise<boolean> {
  const res = await apiFetch(mkApiPath(`/waves/${waveId}`), "HR", { method: "DELETE" });
  return res?.success === true;
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export async function listWaveCandidates(waveId: string): Promise<WaveCandidate[]> {
  const res = await apiFetch(mkApiPath(`/waves/${waveId}/candidates`), "HR", { method: "GET", cache: "no-store" });
  return Array.isArray(res) ? res : [];
}

export async function inviteCandidatesToWave(
  waveId: string,
  applicationIds: string[],
  options?: { forceAdd?: boolean; sendEmail?: boolean }
): Promise<{ invited: number; skipped: number } | null> {
  const res = await apiFetch(mkApiPath(`/waves/${waveId}/candidates/invite`), "HR", {
    method: "POST",
    body: JSON.stringify({ applicationIds, forceAdd: options?.forceAdd ?? false, sendEmail: options?.sendEmail ?? true }),
  });
  return res ?? null;
}

export async function updateWaveCandidateStatus(
  waveId: string,
  waveCandidateId: string,
  status: string,
  notes?: string | null
): Promise<WaveCandidate | null> {
  const res = await apiFetch(mkApiPath(`/waves/${waveId}/candidates/${waveCandidateId}/status`), "HR", {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
  return res ?? null;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getWaveAnalytics(waveId: string): Promise<WaveAnalytics | null> {
  const res = await apiFetch(mkApiPath(`/waves/${waveId}/analytics`), "HR", { method: "GET", cache: "no-store" });
  return res ?? null;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listWaveTemplates(): Promise<WaveTemplate[]> {
  const res = await apiFetch(wavesTemplatesApi, "HR", { method: "GET", cache: "no-store" });
  return Array.isArray(res) ? res : [];
}

// ─── Public booking ───────────────────────────────────────────────────────────

export async function getWaveBookingByToken(token: string): Promise<WaveBookingData | null> {
  const res = await apiFetch(mkApiPath(`/waves/booking/${token}`), "none", { method: "GET", cache: "no-store" });
  return res ?? null;
}

export async function confirmWaveBooking(token: string, slotId: string): Promise<{
  success: boolean;
  bookingId?: string;
  startsAt?: string;
  endsAt?: string;
  meetingProvider?: string;
  meetingLink?: string | null;
} | null> {
  const res = await apiFetch(mkApiPath(`/waves/booking/${token}/confirm`), "none", {
    method: "POST",
    body: JSON.stringify({ slotId }),
  });
  return res ?? null;
}

// ─── Slot management ─────────────────────────────────────────────────────────

export async function generateWaveSlots(waveId: string, payload: {
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  slotDurationMinutes: number;
  capacity: number;
}): Promise<{ count: number } | null> {
  const [startH] = payload.dailyStartTime.split(":").map(Number);
  const [endH] = payload.dailyEndTime.split(":").map(Number);
  const res = await apiFetch(mkApiPath(`/waves/${waveId}/slots/generate`), "HR", {
    method: "POST",
    body: JSON.stringify({
      startDate: payload.startDate,
      endDate: payload.endDate,
      slotDurationMinutes: payload.slotDurationMinutes,
      capacity: payload.capacity,
      workingHoursStart: startH,
      workingHoursEnd: endH,
    }),
  });
  return res ?? null;
}
