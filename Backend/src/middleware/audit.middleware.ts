import { supabaseAdmin } from "@/config/supabase";

/**
 * writeAuditLog — Writes an immutable audit log entry for critical business actions.
 *
 * Used by Decision Engine, Offer Core, and Onboarding Tasks Engine to maintain
 * a complete audit trail of all mutations.
 *
 * @param applicationId - The application being acted upon
 * @param eventType - Descriptive event type (e.g., DECISION_MADE, OFFER_CREATED)
 * @param actorId - The user performing the action
 * @param payload - Additional context stored as JSON
 */
export async function writeAuditLog(
  applicationId: string,
  eventType: string,
  actorId: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabaseAdmin.from("application_audit_logs").insert({
    application_id: applicationId,
    event_type: eventType,
    payload_json: payload,
    actor_id: actorId,
  });

  if (error) {
    // Non-blocking: log the error but don't fail the request
    console.error(`[AUDIT] Failed to write audit log: ${error.message}`, {
      applicationId,
      eventType,
      actorId,
    });
  }
}

/**
 * getAuditLogs — Retrieves audit logs for a specific application.
 *
 * @param applicationId - The application to get logs for
 * @param limit - Maximum number of logs to return (default: 50)
 */
export async function getAuditLogs(
  applicationId: string,
  limit = 50
): Promise<Array<{
  id: string;
  event_type: string;
  payload_json: Record<string, unknown>;
  actor_id: string;
  created_at: string;
}>> {
  const { data, error } = await supabaseAdmin
    .from("application_audit_logs")
    .select("id, event_type, payload_json, actor_id, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[AUDIT] Failed to read audit logs: ${error.message}`);
    return [];
  }

  return data ?? [];
}
