"use server";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
const roleInput = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500),
});
export async function createRole(fd: FormData) {
  try {
    const input = roleInput.parse(Object.fromEntries(fd));
    const { admin, organizationId, actorId } = await requireOrganizationAdmin();
    const { data, error } = await admin
      .from("roles")
      .insert({
        organization_id: organizationId,
        name: input.name,
        description: input.description || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    await writeAudit(admin, {
      organizationId,
      actorId,
      action: "role.created",
      entityType: "role",
      entityId: data.id,
      next: input,
    });
    revalidatePath("/admin/roles");
  } catch (error) {
    redirect(
      `/admin/roles?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create role")}`,
    );
  }
  redirect("/admin/roles?success=Role%20created");
}
export async function updateRole(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const input = roleInput.parse(Object.fromEntries(fd));
  const permissions = fd.getAll("permission_ids").map(String).filter(Boolean);
  const { admin, organizationId, actorId } = await requireOrganizationAdmin();
  const { data: before, error: findError } = await admin
    .from("roles")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (findError) throw findError;
  const { error } = await admin
    .from("roles")
    .update({ name: input.name, description: input.description || null })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw error;
  await admin.from("role_permissions").delete().eq("role_id", id);
  if (permissions.length) {
    const saved = await admin
      .from("role_permissions")
      .insert(
        permissions.map((permission_id) => ({ role_id: id, permission_id })),
      );
    if (saved.error) throw saved.error;
  }
  await writeAudit(admin, {
    organizationId,
    actorId,
    action: "role.updated",
    entityType: "role",
    entityId: id,
    previous: before,
    next: { ...input, permission_ids: permissions },
  });
  revalidatePath("/admin/roles");
  redirect("/admin/roles?success=Role%20updated");
}
export async function deleteRole(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const { admin, organizationId, actorId } = await requireOrganizationAdmin();
  const { data: role, error: findError } = await admin
    .from("roles")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (findError) throw findError;
  if (role.system_key) throw new Error("System roles cannot be deleted");
  const { count } = await admin
    .from("user_roles")
    .select("user_id", { head: true, count: "exact" })
    .eq("role_id", id);
  if (count) throw new Error("Remove this role from users before deleting it");
  const { error } = await admin.from("roles").delete().eq("id", id);
  if (error) throw error;
  await writeAudit(admin, {
    organizationId,
    actorId,
    action: "role.deleted",
    entityType: "role",
    entityId: id,
    previous: role,
  });
  revalidatePath("/admin/roles");
}
