import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function writeAudit(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    previous?: unknown;
    next?: unknown;
    reason?: string;
  },
) {
  const { error } = await admin.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    previous_value: input.previous ?? null,
    new_value: input.next ?? null,
    reason: input.reason ?? null,
  });
  if (error) throw error;
}
