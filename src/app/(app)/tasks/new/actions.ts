"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { dispatchTaskEvent } from "@/lib/communications";
const input = z.object({
  title: z.string().min(3).max(180),
  description: z.string().min(3).max(10000),
  priority: z.enum(["low", "normal", "high", "critical"]),
  assignee_id: z.string().uuid(),
  hours: z.coerce.number().int().min(1).max(2160),
  confidentiality: z.enum(["internal", "confidential", "restricted"]),
  sla_policy_id: z.union([z.literal(""), z.string().uuid()]),
});
export async function createTask(fd: FormData) {
  const parsed = input.safeParse(Object.fromEntries(fd));
  if (!parsed.success) throw new Error("Invalid task details");
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await s
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!p) throw new Error("Profile not configured");
  let durationMinutes = parsed.data.hours * 60;
  let sla: null | {
    id: string;
    resolution_minutes: number;
    evidence_required: boolean;
    approval_required: boolean;
  } = null;
  if (parsed.data.sla_policy_id) {
    const result = await s
      .from("sla_policies")
      .select("id,resolution_minutes,evidence_required,approval_required")
      .eq("id", parsed.data.sla_policy_id)
      .eq("active", true)
      .single();
    if (result.error) throw new Error("Selected SLA policy is unavailable");
    sla = result.data;
    durationMinutes = sla.resolution_minutes;
  }
  const deadline = new Date(Date.now() + durationMinutes * 60000).toISOString();
  const { data, error } = await s
    .from("tasks")
    .insert({
      organization_id: p.organization_id,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      confidentiality: parsed.data.confidentiality,
      created_by: user.id,
      assigned_by: user.id,
      primary_owner_id: parsed.data.assignee_id,
      original_deadline: deadline,
      current_deadline: deadline,
      evidence_required:
        sla?.evidence_required ?? fd.get("evidence_required") === "on",
      approval_required: sla?.approval_required ?? true,
      sla_policy_id: sla?.id ?? null,
      sla_due_at: sla ? deadline : null,
      status: "assigned",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await dispatchTaskEvent(
    data.id,
    user.id,
    "New task assigned",
    `${parsed.data.title} has been assigned to you.`,
  ).catch(console.error);
  redirect(`/tasks/${data.id}`);
}
