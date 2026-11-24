"use server";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
const schema = z
  .object({
    name: z.string().min(2).max(120),
    description: z.string().max(500),
    priority: z.enum(["low", "normal", "high", "critical"]),
    response_minutes: z.coerce.number().int().positive(),
    resolution_minutes: z.coerce.number().int().positive(),
    warning_percent: z.coerce.number().int().min(1).max(99),
  })
  .refine((x) => x.response_minutes <= x.resolution_minutes, {
    message: "Response time cannot exceed resolution time",
  });
function values(fd: FormData, i: z.infer<typeof schema>) {
  return {
    ...i,
    description: i.description || null,
    business_hours_only: fd.get("business_hours_only") === "on",
    evidence_required: fd.get("evidence_required") === "on",
    approval_required: fd.get("approval_required") === "on",
    is_default: fd.get("is_default") === "on",
    active: fd.get("active") !== "off",
  };
}
export async function createSla(fd: FormData) {
  try {
    const i = schema.parse(Object.fromEntries(fd));
    const { admin, organizationId, actorId } = await requireOrganizationAdmin();
    const v = values(fd, i);
    if (v.is_default)
      await admin
        .from("sla_policies")
        .update({ is_default: false })
        .eq("organization_id", organizationId);
    const { data, error } = await admin
      .from("sla_policies")
      .insert({ ...v, organization_id: organizationId, created_by: actorId })
      .select("id")
      .single();
    if (error) throw error;
    await writeAudit(admin, {
      organizationId,
      actorId,
      action: "sla.created",
      entityType: "sla_policy",
      entityId: data.id,
      next: v,
    });
    revalidatePath("/admin/sla");
  } catch (error) {
    redirect(
      `/admin/sla?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create SLA")}`,
    );
  }
  redirect("/admin/sla?success=SLA%20policy%20created");
}
export async function updateSla(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const i = schema.parse(Object.fromEntries(fd));
  const { admin, organizationId, actorId } = await requireOrganizationAdmin();
  const { data: before } = await admin
    .from("sla_policies")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  const v = values(fd, i);
  if (v.is_default)
    await admin
      .from("sla_policies")
      .update({ is_default: false })
      .eq("organization_id", organizationId)
      .neq("id", id);
  const { error } = await admin
    .from("sla_policies")
    .update({ ...v, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw error;
  await writeAudit(admin, {
    organizationId,
    actorId,
    action: "sla.updated",
    entityType: "sla_policy",
    entityId: id,
    previous: before,
    next: v,
  });
  revalidatePath("/admin/sla");
  redirect("/admin/sla?success=SLA%20policy%20updated");
}
export async function deleteSla(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const { admin, organizationId, actorId } = await requireOrganizationAdmin();
  const { count } = await admin
    .from("tasks")
    .select("id", { head: true, count: "exact" })
    .eq("sla_policy_id", id);
  if (count) {
    await admin.from("sla_policies").update({ active: false }).eq("id", id);
  } else {
    await admin.from("sla_policies").delete().eq("id", id);
  }
  await writeAudit(admin, {
    organizationId,
    actorId,
    action: count ? "sla.deactivated" : "sla.deleted",
    entityType: "sla_policy",
    entityId: id,
  });
  revalidatePath("/admin/sla");
}
