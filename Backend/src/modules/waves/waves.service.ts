import { supabaseAdmin } from "@/config/supabase";
import { AppError } from "@/middleware/error.middleware";
import crypto from "crypto";
import { env } from "@/config/env";
import { sendWaveInviteEmail, generateICS, sendEmailDirect, type EmailAttachment } from "@/services/email.service";
import type {
  CreateWaveInput,
  UpdateWaveInput,
  GenerateWaveSlotsInput,
  CreateWaveSlotInput,
  InviteCandidatesInput,
  UpdateWaveCandidateStatusInput,
  CreateWaveTemplateInput,
} from "./waves.schema";

// ─── Row types ────────────────────────────────────────────────────────────────

interface WaveRow {
  id: string;
  role_id: string;
  template_id: string | null;
  name: string;
  description: string | null;
  status: string;
  wave_order: number;
  prerequisite_wave_id: string | null;
  force_add_allowed: boolean;
  auto_place_on_match: boolean;
  auto_place_threshold: number | null;
  booking_open_at: string | null;
  booking_close_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface WaveSlotRow {
  id: string;
  wave_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  capacity: number;
  meeting_provider: string;
  meeting_link: string | null;
  meeting_location: string | null;
  interviewer_ids: unknown;
  created_at: string;
  updated_at: string;
}

interface WaveCandidateRow {
  id: string;
  wave_id: string;
  application_id: string;
  status: string;
  force_added: boolean;
  invite_token: string | null;
  invited_at: string;
  booking_id: string | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertWaveHRAccess(waveId: string, institutionId: string): Promise<WaveRow> {
  const { data, error } = await supabaseAdmin
    .from("recruitment_waves")
    .select(`
      id, role_id, template_id, name, description, status, wave_order,
      prerequisite_wave_id, force_add_allowed, auto_place_on_match,
      auto_place_threshold, booking_open_at, booking_close_at,
      created_by, created_at, updated_at,
      roles!inner(institution_id)
    `)
    .eq("id", waveId)
    .single();

  if (error || !data) throw new AppError(404, "Wave not found");

  const roles = (data as any).roles;
  const role = Array.isArray(roles) ? roles[0] : roles;
  if ((role as { institution_id?: string } | undefined)?.institution_id !== institutionId) {
    throw new AppError(403, "Access denied to this wave");
  }

  return data as WaveRow;
}

async function assertRoleHRAccess(roleId: string, institutionId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("institution_id")
    .eq("id", roleId)
    .single();

  if (error || !data) throw new AppError(404, "Role not found");
  if ((data as { institution_id: string }).institution_id !== institutionId) {
    throw new AppError(403, "Access denied to this role");
  }
}

function mapWave(row: WaveRow) {
  return {
    id: row.id,
    roleId: row.role_id,
    templateId: row.template_id,
    name: row.name,
    description: row.description,
    status: row.status,
    waveOrder: row.wave_order,
    prerequisiteWaveId: row.prerequisite_wave_id,
    forceAddAllowed: row.force_add_allowed,
    autoPlaceOnMatch: row.auto_place_on_match,
    autoPlaceThreshold: row.auto_place_threshold,
    bookingOpenAt: row.booking_open_at,
    bookingCloseAt: row.booking_close_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSlot(row: WaveSlotRow) {
  return {
    id: row.id,
    waveId: row.wave_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    meetingProvider: row.meeting_provider,
    meetingLink: row.meeting_link,
    meetingLocation: row.meeting_location,
    interviewerIds: Array.isArray(row.interviewer_ids) ? row.interviewer_ids as string[] : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWaveCandidate(row: WaveCandidateRow) {
  return {
    id: row.id,
    waveId: row.wave_id,
    applicationId: row.application_id,
    status: row.status,
    forceAdded: row.force_added,
    inviteToken: row.invite_token,
    invitedAt: row.invited_at,
    bookingId: row.booking_id,
    notes: row.notes,
  };
}

// ─── Wave CRUD ────────────────────────────────────────────────────────────────

export async function listWavesForRole(roleId: string, institutionId: string) {
  await assertRoleHRAccess(roleId, institutionId);

  const { data, error } = await supabaseAdmin
    .from("recruitment_waves")
    .select("*")
    .eq("role_id", roleId)
    .order("wave_order", { ascending: true });

  if (error) throw new AppError(500, "Failed to list waves");

  const waveIds = (data ?? []).map((w: any) => w.id as string);

  // Enrich with candidate count and slot count
  const [{ data: candidateCounts }, { data: slotCounts }] = await Promise.all([
    supabaseAdmin
      .from("wave_candidates")
      .select("wave_id")
      .in("wave_id", waveIds.length > 0 ? waveIds : ["__none__"]),
    supabaseAdmin
      .from("wave_slots")
      .select("wave_id")
      .in("wave_id", waveIds.length > 0 ? waveIds : ["__none__"]),
  ]);

  const candidateCountMap: Record<string, number> = {};
  (candidateCounts ?? []).forEach((r: any) => {
    candidateCountMap[r.wave_id] = (candidateCountMap[r.wave_id] ?? 0) + 1;
  });

  const slotCountMap: Record<string, number> = {};
  (slotCounts ?? []).forEach((r: any) => {
    slotCountMap[r.wave_id] = (slotCountMap[r.wave_id] ?? 0) + 1;
  });

  return (data ?? []).map((row: any) => ({
    ...mapWave(row as WaveRow),
    candidateCount: candidateCountMap[row.id] ?? 0,
    slotCount: slotCountMap[row.id] ?? 0,
  }));
}

export async function createWave(input: CreateWaveInput, institutionId: string, userId: string) {
  await assertRoleHRAccess(input.roleId, institutionId);

  const { data, error } = await supabaseAdmin
    .from("recruitment_waves")
    .insert({
      role_id: input.roleId,
      name: input.name,
      description: input.description ?? null,
      wave_order: input.waveOrder ?? 1,
      template_id: input.templateId ?? null,
      booking_open_at: input.bookingOpenAt ?? null,
      booking_close_at: input.bookingCloseAt ?? null,
      auto_place_on_match: input.autoPlaceOnMatch ?? false,
      auto_place_threshold: input.autoPlaceThreshold ?? null,
      prerequisite_wave_id: input.prerequisiteWaveId ?? null,
      force_add_allowed: input.forceAddAllowed ?? true,
      status: "DRAFT",
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) throw new AppError(500, "Failed to create wave");
  return mapWave(data as WaveRow);
}

export async function getWave(waveId: string, institutionId: string) {
  const wave = await assertWaveHRAccess(waveId, institutionId);
  return mapWave(wave);
}

export async function updateWave(waveId: string, institutionId: string, input: UpdateWaveInput) {
  await assertWaveHRAccess(waveId, institutionId);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.waveOrder !== undefined) patch.wave_order = input.waveOrder;
  if (input.bookingOpenAt !== undefined) patch.booking_open_at = input.bookingOpenAt;
  if (input.bookingCloseAt !== undefined) patch.booking_close_at = input.bookingCloseAt;
  if (input.autoPlaceOnMatch !== undefined) patch.auto_place_on_match = input.autoPlaceOnMatch;
  if (input.autoPlaceThreshold !== undefined) patch.auto_place_threshold = input.autoPlaceThreshold;
  if (input.prerequisiteWaveId !== undefined) patch.prerequisite_wave_id = input.prerequisiteWaveId;
  if (input.forceAddAllowed !== undefined) patch.force_add_allowed = input.forceAddAllowed;

  const { data, error } = await supabaseAdmin
    .from("recruitment_waves")
    .update(patch)
    .eq("id", waveId)
    .select("*")
    .single();

  if (error || !data) throw new AppError(500, "Failed to update wave");
  return mapWave(data as WaveRow);
}

export async function deleteWave(waveId: string, institutionId: string) {
  await assertWaveHRAccess(waveId, institutionId);

  const { error } = await supabaseAdmin
    .from("recruitment_waves")
    .delete()
    .eq("id", waveId);

  if (error) throw new AppError(500, "Failed to delete wave");
  return { success: true };
}

// ─── Wave Slots ───────────────────────────────────────────────────────────────

export async function listWaveSlots(waveId: string, institutionId: string) {
  await assertWaveHRAccess(waveId, institutionId);

  const { data, error } = await supabaseAdmin
    .from("wave_slots")
    .select("*")
    .eq("wave_id", waveId)
    .order("starts_at", { ascending: true });

  if (error) throw new AppError(500, "Failed to list wave slots");

  const slotIds = (data ?? []).map((s: any) => s.id as string);

  // Booking counts per slot
  const { data: bookingRows } = await supabaseAdmin
    .from("wave_slot_bookings")
    .select("slot_id")
    .in("slot_id", slotIds.length > 0 ? slotIds : ["__none__"])
    .is("cancelled_at", null);

  const bookingCountMap: Record<string, number> = {};
  (bookingRows ?? []).forEach((r: any) => {
    bookingCountMap[r.slot_id] = (bookingCountMap[r.slot_id] ?? 0) + 1;
  });

  return (data ?? []).map((row: any) => ({
    ...mapSlot(row as WaveSlotRow),
    bookedCount: bookingCountMap[row.id] ?? 0,
    availableCount: Math.max(0, (row.capacity as number) - (bookingCountMap[row.id] ?? 0)),
  }));
}

export async function createWaveSlot(waveId: string, institutionId: string, input: CreateWaveSlotInput) {
  await assertWaveHRAccess(waveId, institutionId);

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (startsAt >= endsAt) throw new AppError(400, "Slot end must be after start");

  const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);

  const { data, error } = await supabaseAdmin
    .from("wave_slots")
    .insert({
      wave_id: waveId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      duration_minutes: durationMinutes,
      capacity: input.capacity ?? 1,
      meeting_provider: input.meetingProvider ?? "MANUAL",
      meeting_link: input.meetingLink ?? null,
      meeting_location: input.meetingLocation ?? null,
      interviewer_ids: input.interviewerIds ?? [],
    })
    .select("*")
    .single();

  if (error || !data) throw new AppError(500, "Failed to create slot");
  return mapSlot(data as WaveSlotRow);
}

export async function generateWaveSlots(waveId: string, institutionId: string, input: GenerateWaveSlotsInput) {
  await assertWaveHRAccess(waveId, institutionId);

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  if (start >= end) throw new AppError(400, "endDate must be after startDate");
  if ((end.getTime() - start.getTime()) > 90 * 24 * 60 * 60 * 1000) {
    throw new AppError(400, "Date range cannot exceed 90 days");
  }

  const SNAP_MS = 15 * 60 * 1000;
  const durationMs = input.slotDurationMinutes * 60 * 1000;
  const tz = "UTC";

  const slots: Array<{
    wave_id: string; starts_at: string; ends_at: string;
    duration_minutes: number; capacity: number;
    meeting_provider: string; meeting_location: string | null;
    interviewer_ids: string[];
  }> = [];

  let cursor = Math.ceil(start.getTime() / SNAP_MS) * SNAP_MS;
  const endMs = end.getTime();

  while (cursor + durationMs <= endMs) {
    const slotEnd = cursor + durationMs;
    const slotDate = new Date(cursor);
    const weekday = slotDate.getUTCDay();
    const isWeekday = weekday >= 1 && weekday <= 5;

    const hour = slotDate.getUTCHours() + slotDate.getUTCMinutes() / 60;
    const endHour = new Date(slotEnd).getUTCHours() + new Date(slotEnd).getUTCMinutes() / 60;
    const fitsWork = hour >= input.workingHoursStart && endHour <= input.workingHoursEnd;

    if (isWeekday && fitsWork) {
      slots.push({
        wave_id: waveId,
        starts_at: new Date(cursor).toISOString(),
        ends_at: new Date(slotEnd).toISOString(),
        duration_minutes: input.slotDurationMinutes,
        capacity: input.capacity,
        meeting_provider: input.meetingProvider,
        meeting_location: input.meetingLocation ?? null,
        interviewer_ids: input.interviewerIds ?? [],
      });
    }

    cursor += SNAP_MS;
  }

  void tz; // used for clarity

  if (slots.length === 0) throw new AppError(422, "No slots could be generated for the given range and working hours");
  if (slots.length > 2000) throw new AppError(422, `Too many slots would be generated (${slots.length}). Narrow the range.`);

  const { data, error } = await supabaseAdmin
    .from("wave_slots")
    .insert(slots)
    .select("id");

  if (error) throw new AppError(500, "Failed to generate slots");

  return {
    generated: data?.length ?? 0,
    slotsCount: slots.length,
  };
}

export async function deleteWaveSlot(waveId: string, slotId: string, institutionId: string) {
  await assertWaveHRAccess(waveId, institutionId);

  const { error } = await supabaseAdmin
    .from("wave_slots")
    .delete()
    .eq("id", slotId)
    .eq("wave_id", waveId);

  if (error) throw new AppError(500, "Failed to delete slot");
  return { success: true };
}

// ─── Wave Candidates ──────────────────────────────────────────────────────────

export async function listWaveCandidates(waveId: string, institutionId: string) {
  await assertWaveHRAccess(waveId, institutionId);

  const { data, error } = await supabaseAdmin
    .from("wave_candidates")
    .select(`
      id, wave_id, application_id, status, force_added,
      invite_token, invited_at, booking_id, notes,
      applications!inner(
        candidate_id,
        profiles:candidate_id(full_name, email)
      )
    `)
    .eq("wave_id", waveId)
    .order("invited_at", { ascending: false });

  if (error) throw new AppError(500, "Failed to list wave candidates");

  return (data ?? []).map((row: any) => {
    const app = Array.isArray(row.applications) ? row.applications[0] : row.applications;
    const profile = Array.isArray(app?.profiles) ? app?.profiles[0] : app?.profiles;
    return {
      id: row.id as string,
      waveId: row.wave_id as string,
      applicationId: row.application_id as string,
      status: row.status as string,
      forceAdded: Boolean(row.force_added),
      inviteToken: row.invite_token as string | null,
      invitedAt: row.invited_at as string,
      bookingId: row.booking_id as string | null,
      notes: row.notes as string | null,
      candidateName: (profile?.full_name as string | null) ?? null,
      candidateEmail: (profile?.email as string | null) ?? null,
    };
  });
}

export async function inviteCandidatesToWave(
  waveId: string,
  institutionId: string,
  input: InviteCandidatesInput,
  _actorId: string
) {
  await assertWaveHRAccess(waveId, institutionId);

  // Check existing invites to avoid duplicates
  const { data: existing } = await supabaseAdmin
    .from("wave_candidates")
    .select("application_id")
    .eq("wave_id", waveId)
    .in("application_id", input.applicationIds);

  const alreadyInvited = new Set((existing ?? []).map((r: any) => r.application_id as string));
  const toInvite = input.applicationIds.filter((id) => !alreadyInvited.has(id));

  if (toInvite.length === 0) {
    return { invited: 0, skipped: input.applicationIds.length, message: "All candidates already invited" };
  }

  const rows = toInvite.map((applicationId) => ({
    wave_id: waveId,
    application_id: applicationId,
    status: "INVITED",
    force_added: Boolean(input.forceAdd),
    invite_token: `wv_${crypto.randomBytes(24).toString("hex")}`,
    invited_at: new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin
    .from("wave_candidates")
    .insert(rows)
    .select("id, invite_token");

  if (error) throw new AppError(500, "Failed to invite candidates");

  // W6: Send invite emails asynchronously (non-blocking)
  if (input.sendEmail !== false && (data ?? []).length > 0) {
    void sendWaveInviteEmailsAsync(waveId, data ?? [], rows).catch((err) => {
      console.error("[WAVES] Email invite error:", err);
    });
  }

  return {
    invited: data?.length ?? 0,
    skipped: alreadyInvited.size,
    invites: (data ?? []).map((r: any) => ({ id: r.id, inviteToken: r.invite_token })),
  };
}

async function sendWaveInviteEmailsAsync(
  waveId: string,
  _insertedRows: Array<{ id: string; invite_token: string }>,
  originalRows: Array<{ application_id: string; invite_token: string }>
) {
  // Load wave + role info
  const { data: wave } = await supabaseAdmin
    .from("recruitment_waves")
    .select("name, booking_close_at, roles!inner(role_dna(full_form_json), institution_id, institutions:institution_id(name))")
    .eq("id", waveId)
    .single();

  if (!wave) return;

  const waveRow = wave as any;
  const roleRaw = Array.isArray(waveRow.roles) ? waveRow.roles[0] : waveRow.roles;
  const instRaw = Array.isArray(roleRaw?.institutions) ? roleRaw.institutions[0] : roleRaw?.institutions;
  const roleDnaRaw = Array.isArray(roleRaw?.role_dna) ? roleRaw.role_dna[0] : roleRaw?.role_dna;
  const roleTitle = ((roleDnaRaw?.full_form_json as any)?.title as string | undefined) ?? "Poste";
  const institutionName = (instRaw?.name as string | undefined) ?? "Recruteur";

  // Build token map: application_id → invite_token
  const tokenMap = new Map(originalRows.map((r) => [r.application_id, r.invite_token]));

  // Load candidate emails for the applications
  const applicationIds = originalRows.map((r) => r.application_id);
  const { data: applications } = await supabaseAdmin
    .from("applications")
    .select("id, candidate_id, profiles:candidate_id(full_name, email)")
    .in("id", applicationIds);

  // Build send tasks — filter out rows without email or token
  const emailTasks = (applications ?? [])
    .map((app) => {
      const appRow = app as any;
      const profile = Array.isArray(appRow.profiles) ? appRow.profiles[0] : appRow.profiles;
      const email = profile?.email as string | undefined;
      const name = profile?.full_name as string | undefined;
      const inviteToken = tokenMap.get(app.id as string);
      if (!email || !inviteToken) return null;
      return { email, name, inviteToken };
    })
    .filter((t): t is { email: string; name: string | undefined; inviteToken: string } => t !== null);

  // Send in parallel batches of 5 (Resend rate limit safety)
  const CONCURRENCY = 5;
  for (let i = 0; i < emailTasks.length; i += CONCURRENCY) {
    const batch = emailTasks.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async ({ email, name, inviteToken }) => {
        const bookingUrl = `${env.FRONTEND_URL}/waves/booking/${inviteToken}`;
        try {
          await sendWaveInviteEmail({
            candidateEmail: email,
            candidateName: name ?? "Candidat",
            waveName: waveRow.name as string,
            roleTitle,
            institutionName,
            bookingUrl,
            bookingCloseAt: waveRow.booking_close_at as string | null,
          });
        } catch (err) {
          console.error(`[WAVES] Failed to send invite email to ${email}:`, err);
        }
      })
    );
  }
}

export async function updateWaveCandidateStatus(
  waveId: string,
  waveCandidateId: string,
  institutionId: string,
  input: UpdateWaveCandidateStatusInput
) {
  await assertWaveHRAccess(waveId, institutionId);

  const { data, error } = await supabaseAdmin
    .from("wave_candidates")
    .update({ status: input.status, notes: input.notes ?? null })
    .eq("id", waveCandidateId)
    .eq("wave_id", waveId)
    .select("*")
    .single();

  if (error || !data) throw new AppError(500, "Failed to update candidate status");
  return mapWaveCandidate(data as WaveCandidateRow);
}

export async function removeWaveCandidate(waveId: string, waveCandidateId: string, institutionId: string) {
  await assertWaveHRAccess(waveId, institutionId);

  const { error } = await supabaseAdmin
    .from("wave_candidates")
    .delete()
    .eq("id", waveCandidateId)
    .eq("wave_id", waveId);

  if (error) throw new AppError(500, "Failed to remove candidate from wave");
  return { success: true };
}

// ─── Public Booking (candidate) ───────────────────────────────────────────────

export async function getWaveBookingByToken(inviteToken: string) {
  const { data: candidate, error: candError } = await supabaseAdmin
    .from("wave_candidates")
    .select(`
      id, wave_id, application_id, status, invite_token,
      booking_id
    `)
    .eq("invite_token", inviteToken)
    .single();

  if (candError || !candidate) throw new AppError(404, "Invite token not found");

  const waveCandidate = candidate as WaveCandidateRow;

  const { data: wave } = await supabaseAdmin
    .from("recruitment_waves")
    .select("id, name, description, status, booking_open_at, booking_close_at, roles!inner(role_dna(full_form_json))")
    .eq("id", waveCandidate.wave_id)
    .single();

  // Load available slots (capacity > bookings, not cancelled)
  const { data: slots } = await supabaseAdmin
    .from("wave_slots")
    .select("*")
    .eq("wave_id", waveCandidate.wave_id)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  const slotIds = (slots ?? []).map((s: any) => s.id as string);

  const { data: bookings } = await supabaseAdmin
    .from("wave_slot_bookings")
    .select("slot_id")
    .in("slot_id", slotIds.length > 0 ? slotIds : ["__none__"])
    .is("cancelled_at", null);

  const bookingCountMap: Record<string, number> = {};
  (bookings ?? []).forEach((b: any) => {
    bookingCountMap[b.slot_id] = (bookingCountMap[b.slot_id] ?? 0) + 1;
  });

  const availableSlots = (slots ?? [])
    .filter((s: any) => (bookingCountMap[s.id] ?? 0) < (s.capacity as number))
    .map((s: any) => ({
      id: s.id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      durationMinutes: s.duration_minutes,
      meetingProvider: s.meeting_provider,
      meetingLocation: s.meeting_location,
      availableSpots: (s.capacity as number) - (bookingCountMap[s.id] ?? 0),
    }));

  const waveRow = wave as any;
  const roleRaw = waveRow?.roles;
  const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;
  const roleDna = Array.isArray(role?.role_dna) ? role.role_dna[0] : role?.role_dna;
  const roleFullForm = (roleDna as any)?.full_form_json as Record<string, unknown> | undefined;

  // Load current booking if exists
  let currentBooking = null;
  if (waveCandidate.booking_id) {
    const { data: bookingRow } = await supabaseAdmin
      .from("wave_slot_bookings")
      .select("id, slot_id, booked_at, cancelled_at, wave_slots!inner(starts_at, ends_at, meeting_provider, meeting_link)")
      .eq("id", waveCandidate.booking_id)
      .single();

    if (bookingRow) {
      const bRow = bookingRow as any;
      const slotRaw = bRow.wave_slots;
      const slot = Array.isArray(slotRaw) ? slotRaw[0] : slotRaw;
      currentBooking = {
        id: bRow.id,
        slotId: bRow.slot_id,
        bookedAt: bRow.booked_at,
        cancelledAt: bRow.cancelled_at,
        startsAt: slot?.starts_at ?? null,
        endsAt: slot?.ends_at ?? null,
        meetingProvider: slot?.meeting_provider ?? null,
        meetingLink: slot?.meeting_link ?? null,
      };
    }
  }

  return {
    inviteToken,
    waveCandidateId: waveCandidate.id,
    status: waveCandidate.status,
    wave: {
      id: waveRow?.id,
      name: waveRow?.name,
      description: waveRow?.description,
      status: waveRow?.status,
      bookingOpenAt: waveRow?.booking_open_at,
      bookingCloseAt: waveRow?.booking_close_at,
      roleTitle: (roleFullForm?.title as string) ?? "Role",
    },
    availableSlots,
    currentBooking,
  };
}

export async function confirmWaveBooking(inviteToken: string, slotId: string) {
  const { data: candidate, error: candError } = await supabaseAdmin
    .from("wave_candidates")
    .select("id, wave_id, status, booking_id")
    .eq("invite_token", inviteToken)
    .single();

  if (candError || !candidate) throw new AppError(404, "Invite token not found");

  const waveCandidate = candidate as WaveCandidateRow;

  if (waveCandidate.status === "BOOKED") {
    throw new AppError(409, "You have already booked a slot");
  }

  // Check slot exists and belongs to this wave
  const { data: slot, error: slotError } = await supabaseAdmin
    .from("wave_slots")
    .select("id, wave_id, capacity, starts_at, ends_at, meeting_provider, meeting_link")
    .eq("id", slotId)
    .eq("wave_id", waveCandidate.wave_id)
    .single();

  if (slotError || !slot) throw new AppError(404, "Slot not found or not in this wave");

  // Optimistic lock: check capacity
  const { count, error: countError } = await supabaseAdmin
    .from("wave_slot_bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slotId)
    .is("cancelled_at", null);

  if (countError) throw new AppError(500, "Failed to check slot availability");

  const slotRow = slot as any;
  if ((count ?? 0) >= (slotRow.capacity as number)) {
    throw new AppError(409, "This slot is no longer available");
  }

  // Create booking
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("wave_slot_bookings")
    .insert({
      slot_id: slotId,
      wave_candidate_id: waveCandidate.id,
      booked_at: new Date().toISOString(),
      confirmation_sent_at: null,
    })
    .select("id")
    .single();

  if (bookingError) {
    if (bookingError.code === "23505") throw new AppError(409, "This slot is no longer available");
    throw new AppError(500, "Failed to confirm booking");
  }
  if (!booking) throw new AppError(500, "Failed to confirm booking");

  const bookingRow = booking as { id: string };

  // Update candidate: status BOOKED + booking_id
  await supabaseAdmin
    .from("wave_candidates")
    .update({ status: "BOOKED", booking_id: bookingRow.id })
    .eq("id", waveCandidate.id);

  // Send .ics confirmation to candidate (fire-and-forget)
  void (async () => {
    try {
      const { data: candApp } = await supabaseAdmin
        .from("wave_candidates")
        .select("application_id")
        .eq("id", waveCandidate.id)
        .single();
      if (!candApp) return;

      const { data: app } = await supabaseAdmin
        .from("applications")
        .select("candidate_id, roles!inner(role_dna(full_form_json), institutions!inner(name))")
        .eq("id", (candApp as any).application_id)
        .single();
      if (!app) return;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", (app as any).candidate_id)
        .maybeSingle();
      if (!profile?.email) return;

      const role = Array.isArray((app as any).roles) ? (app as any).roles[0] : (app as any).roles;
      const inst = Array.isArray(role?.institutions) ? role.institutions[0] : role?.institutions;
      const roleDna = Array.isArray(role?.role_dna) ? role.role_dna[0] : role?.role_dna;
      const roleTitle = ((roleDna as any)?.full_form_json?.title as string) ?? "Entretien";
      const institutionName = inst?.name ?? "Institution";
      const candidateName = profile.full_name ?? profile.email;

      const startDate = new Date(slotRow.starts_at as string);
      const endDate = new Date(slotRow.ends_at as string);
      const icsContent = generateICS({
        uid: bookingRow.id,
        title: `${roleTitle} — ${institutionName}`,
        start: startDate,
        end: endDate,
        location: (slotRow.meeting_link as string | null) ?? undefined,
        description: `Entretien ${roleTitle} chez ${institutionName}\nCandidat : ${candidateName}`,
        organizerEmail: env.RESEND_FROM_EMAIL,
        attendeeEmails: [profile.email],
      });
      const attachment: EmailAttachment = {
        filename: "entretien.ics",
        content: Buffer.from(icsContent).toString("base64"),
        contentType: "text/calendar; method=REQUEST",
      };
      const subject = `Confirmation — ${roleTitle} chez ${institutionName}`;
      const dateStr = startDate.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const safeName = escHtml(candidateName);
      const safeLink = slotRow.meeting_link ? escHtml(slotRow.meeting_link) : "";
      const html = `<p>Bonjour ${safeName},</p><p>Votre créneau est confirmé : <strong>${dateStr}</strong>${safeLink ? ` — <a href="${safeLink}">Rejoindre</a>` : ""}.</p><p>Le fichier .ics ci-joint vous permet d'ajouter cet événement à votre calendrier.</p>`;
      const text = `Bonjour ${candidateName},\n\nVotre créneau est confirmé : ${dateStr}${slotRow.meeting_link ? `\nLien : ${slotRow.meeting_link}` : ""}.\n\nImportez le fichier .ics pour l'ajouter à votre calendrier.`;
      await sendEmailDirect(profile.email, subject, html, text, [attachment]);
    } catch (err) {
      console.error("[ICS] Failed to send wave booking confirmation:", err);
    }
  })();

  return {
    success: true,
    bookingId: bookingRow.id,
    startsAt: slotRow.starts_at as string,
    endsAt: slotRow.ends_at as string,
    meetingProvider: slotRow.meeting_provider as string,
    meetingLink: slotRow.meeting_link as string | null,
  };
}

// ─── Wave Templates ───────────────────────────────────────────────────────────

export async function listWaveTemplates(institutionId: string) {
  const { data, error } = await supabaseAdmin
    .from("wave_templates")
    .select("*")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  if (error) throw new AppError(500, "Failed to list wave templates");
  return data ?? [];
}

export async function createWaveTemplate(institutionId: string, userId: string, input: CreateWaveTemplateInput) {
  const { data, error } = await supabaseAdmin
    .from("wave_templates")
    .insert({
      institution_id: institutionId,
      name: input.name,
      description: input.description ?? null,
      default_duration_minutes: input.defaultDurationMinutes ?? 60,
      default_slot_capacity: input.defaultSlotCapacity ?? 1,
      criteria_json: input.criteriaJson ?? null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) throw new AppError(500, "Failed to create wave template");
  return data;
}

// ─── Wave Analytics ───────────────────────────────────────────────────────────

export async function getWaveAnalytics(waveId: string, institutionId: string) {
  await assertWaveHRAccess(waveId, institutionId);

  const [
    { data: candidates, error: candError },
    { data: slots, error: slotError },
    { data: bookings, error: bookingError },
  ] = await Promise.all([
    supabaseAdmin.from("wave_candidates").select("status").eq("wave_id", waveId),
    supabaseAdmin.from("wave_slots").select("id, capacity").eq("wave_id", waveId),
    supabaseAdmin.from("wave_slot_bookings")
      .select("slot_id, cancelled_at")
      .in("slot_id", (await supabaseAdmin.from("wave_slots").select("id").eq("wave_id", waveId)).data?.map((s: any) => s.id as string) ?? []),
  ]);

  if (candError || slotError || bookingError) throw new AppError(500, "Failed to compute wave analytics");

  const candidatesByStatus: Record<string, number> = {};
  (candidates ?? []).forEach((c: any) => {
    candidatesByStatus[c.status as string] = (candidatesByStatus[c.status as string] ?? 0) + 1;
  });

  const totalSlotCapacity = (slots ?? []).reduce((acc: number, s: any) => acc + (s.capacity as number), 0);
  const activeBookings = (bookings ?? []).filter((b: any) => !b.cancelled_at).length;

  return {
    waveId,
    candidates: {
      total: (candidates ?? []).length,
      byStatus: candidatesByStatus,
    },
    slots: {
      total: (slots ?? []).length,
      totalCapacity: totalSlotCapacity,
      booked: activeBookings,
      available: Math.max(0, totalSlotCapacity - activeBookings),
      fillRate: totalSlotCapacity > 0 ? Math.round((activeBookings / totalSlotCapacity) * 100) : 0,
    },
  };
}
