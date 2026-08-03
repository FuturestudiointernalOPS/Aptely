import { Response } from "express";
import { AuthenticatedRequest } from "@/middleware/auth.middleware";
import { asyncHandler } from "@/utils/helpers";
import { AppError } from "@/middleware/error.middleware";
import { supabaseAdmin } from "@/config/supabase";
import type { SendMessageInput } from "./messages.schema";

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

function extractRoleDnaTitle(roles: unknown): string {
  const rolesAssoc = Array.isArray(roles) ? (roles as Record<string, unknown>[])[0] : (roles as Record<string, unknown> | null);
  const roleDnaRaw = rolesAssoc?.["role_dna"];
  const dna = Array.isArray(roleDnaRaw) ? (roleDnaRaw as Record<string, unknown>[])[0] : (roleDnaRaw as Record<string, unknown> | undefined);
  const title = (dna?.["full_form_json"] as Record<string, unknown> | undefined)?.["title"];
  return (typeof title === "string" && title.length > 0) ? title : "Untitled Role";
}

function calcUnreadCount(messages: Array<{ sender_id: string; read_at: string | null }>, viewerId: string): number {
  return messages.filter((m) => m.sender_id !== viewerId && !m.read_at).length;
}

function getLastMessage(messages: Array<{ content: string; sent_at: string }>): { content: string; sent_at: string } | null {
  if (messages.length === 0) return null;
  return [...messages].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0] ?? null;
}

// ─── Helper: verify user is a participant of an application ──────────────────
// Returns the participant role so callers can decide visibility filtering.

type ParticipantRole = "candidate" | "institution_member";

async function assertParticipant(applicationId: string, userId: string): Promise<ParticipantRole> {
  const { data: app, error } = await supabaseAdmin
    .from("applications")
    .select(`
      candidate_id,
      roles ( institution_id )
    `)
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !app) throw new AppError(404, "Application not found");

  // Is candidate?
  if (app.candidate_id === userId) return "candidate";

  // Is institution member?
  const rolesAssoc = app.roles as unknown as { institution_id: string } | Array<{ institution_id: string }> | null;
  const institutionId = Array.isArray(rolesAssoc) ? rolesAssoc[0]?.institution_id : rolesAssoc?.institution_id;

  if (institutionId) {
    const { data: member } = await supabaseAdmin
      .from("institution_members")
      .select("id, status")
      .eq("institution_id", institutionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (member && ["OWNER", "ADMIN", "ACTIVE"].includes(String(member.status))) return "institution_member";
  }

  throw new AppError(403, "Access denied");
}

// ─── GET /messages — list all threads for current user ───────────────────────

export const listThreads = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    // Applications where user is candidate
    const { data: candidateApps } = await supabaseAdmin
      .from("applications")
      .select("id")
      .eq("candidate_id", userId);

    // Applications where user is institution member
    const { data: memberships } = await supabaseAdmin
      .from("institution_members")
      .select("institution_id")
      .eq("user_id", userId);

    const institutionIds = (memberships ?? []).map((m) => m.institution_id);
    let institutionAppIds: string[] = [];
    if (institutionIds.length > 0) {
      const { data: instApps } = await supabaseAdmin
        .from("applications")
        .select("id, roles!inner(institution_id)")
        .in("roles.institution_id", institutionIds);
      institutionAppIds = (instApps ?? []).map((a) => a.id);
    }

    const appIds = [
      ...new Set([
        ...(candidateApps ?? []).map((a) => a.id),
        ...institutionAppIds,
      ]),
    ];

    if (appIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }

    const { data: threads, error } = await supabaseAdmin
      .from("message_threads")
      .select(`
        id, application_id, created_at, last_message_at,
        applications (
          status, candidate_id,
          roles ( role_dna ( full_form_json ), institutions ( name ) )
        ),
        messages ( id, sender_id, content, sent_at, read_at )
      `)
      .in("application_id", appIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) throw new AppError(500, "Failed to fetch threads");

    const shaped = (threads ?? []).map((t) => {
      const msgs = (t.messages as unknown as Array<{ id: string; sender_id: string; content: string; sent_at: string; read_at: string | null }>) ?? [];
      const lastMsg = getLastMessage(msgs);
      const unread = calcUnreadCount(msgs, userId);

      const appAssoc = t.applications as unknown as {
        status: string;
        candidate_id: string;
        roles?: unknown;
      } | null;
      const roleTitle = extractRoleDnaTitle(appAssoc?.roles);
      const rolesAssoc = Array.isArray(appAssoc?.roles) ? (appAssoc?.roles as Record<string, unknown>[])[0] : (appAssoc?.roles as Record<string, unknown> | undefined);

      return {
        id: t.id,
        application_id: t.application_id,
        last_message_at: t.last_message_at,
        unread_count: unread,
        last_message: lastMsg,
        role_title: roleTitle,
        institution_name: (rolesAssoc?.["institutions"] as Record<string, unknown> | undefined)?.["name"] as string ?? null,
        application_status: appAssoc?.status ?? null,
      };
    });

    res.status(200).json({ data: shaped });
  }
);

// ─── GET /messages/:applicationId — get messages in thread ───────────────────

export const getMessages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const applicationId = req.params["applicationId"] as string;

    const role = await assertParticipant(applicationId, userId);

    const { data: thread } = await supabaseAdmin
      .from("message_threads")
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (!thread) {
      res.status(200).json({ data: [] });
      return;
    }

    // Optional visibility filter via query param. Candidates locked to external regardless.
    const queryVisibility = (req.query["visibility"] as string | undefined)?.toLowerCase();
    const allowedVisibilities: Array<"internal" | "external"> =
      role === "candidate"
        ? ["external"]
        : queryVisibility === "internal"
          ? ["internal"]
          : queryVisibility === "external"
            ? ["external"]
            : ["internal", "external"];

    const { data: msgs, error } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, content, visibility, sent_at, read_at, profiles(full_name)")
      .eq("thread_id", thread.id)
      .in("visibility", allowedVisibilities)
      .order("sent_at", { ascending: true });

    if (error) throw new AppError(500, "Failed to fetch messages");

    res.status(200).json({ data: msgs ?? [] });
  }
);

// ─── POST /messages/:applicationId — send a message ──────────────────────────

export const sendMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const applicationId = req.params["applicationId"] as string;
    const { content, visibility: requestedVisibility } = req.body as SendMessageInput;

    const role = await assertParticipant(applicationId, userId);

    // Candidates can only send external messages. Default to external if not specified.
    const visibility: "internal" | "external" =
      role === "candidate"
        ? "external"
        : requestedVisibility === "internal"
          ? "internal"
          : "external";

    // Get or create thread
    let threadId: string;
    const { data: existing } = await supabaseAdmin
      .from("message_threads")
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (existing) {
      threadId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin
        .from("message_threads")
        .insert({ application_id: applicationId })
        .select("id")
        .single();
      if (createErr || !created) throw new AppError(500, "Failed to create thread");
      threadId = created.id;
    }

    const { data: msg, error } = await supabaseAdmin
      .from("messages")
      .insert({ thread_id: threadId, sender_id: userId, content, visibility })
      .select("id, sender_id, content, visibility, sent_at, read_at, profiles(full_name)")
      .single();

    if (error || !msg) throw new AppError(500, "Failed to send message");

    res.status(201).json({ data: msg });
  }
);

// ─── PATCH /messages/:applicationId/read — mark messages as read ─────────────

export const markRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const applicationId = req.params["applicationId"] as string;

    await assertParticipant(applicationId, userId);

    const { data: thread } = await supabaseAdmin
      .from("message_threads")
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (!thread) {
      res.status(200).json({ data: { updated: 0 } });
      return;
    }

    const { count } = await supabaseAdmin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", thread.id)
      .neq("sender_id", userId)
      .is("read_at", null);

    res.status(200).json({ data: { updated: count ?? 0 } });
  }
);
