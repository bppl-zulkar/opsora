"use server";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const userSchema = z.object({
  full_name: z.string().min(2).max(160),
  employee_id: z.string().min(1).max(50),
  email: z.string().email(),
  mobile: z.string().max(30),
  department_id: z.union([z.literal(""), z.string().uuid()]),
  designation_id: z.union([z.literal(""), z.string().uuid()]),
  reporting_manager_id: z.union([z.literal(""), z.string().uuid()]),
  joining_date: z.union([z.literal(""), z.string().date()]),
  account_status: z.enum(["invited", "active", "inactive", "suspended"]),
  password: z.string().min(12).max(128),
});
const editSchema = userSchema.omit({ password: true }).extend({
  id: z.string().uuid(),
  password: z.union([z.literal(""), z.string().min(12).max(128)]),
});

async function assignRoles(
  admin: Awaited<ReturnType<typeof requireOrganizationAdmin>>["admin"],
  organizationId: string,
  userId: string,
  roleIds: string[],
) {
  await admin
    .from("user_roles")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (roleIds.length) {
    const { error } = await admin.from("user_roles").insert(
      roleIds.map((role_id) => ({
        organization_id: organizationId,
        user_id: userId,
        role_id,
      })),
    );
    if (error) throw error;
  }
}

export async function createEmployee(fd: FormData) {
  try {
    const input = userSchema.parse(Object.fromEntries(fd));
    const { admin, organizationId } = await requireOrganizationAdmin();
    const existing = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .or(`email.eq.${input.email},employee_id.eq.${input.employee_id}`)
      .maybeSingle();
    if (existing.data)
      throw new Error("Email or Company User ID already exists");
    const auth = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (auth.error) throw auth.error;
    const userId = auth.data.user.id;
    const { error } = await admin.from("profiles").insert({
      id: userId,
      organization_id: organizationId,
      employee_id: input.employee_id,
      full_name: input.full_name,
      email: input.email,
      mobile: input.mobile || null,
      department_id: input.department_id || null,
      designation_id: input.designation_id || null,
      reporting_manager_id: input.reporting_manager_id || null,
      joined_on: input.joining_date || null,
      account_status: input.account_status,
      force_password_change: false,
    });
    if (error) {
      await admin.auth.admin.deleteUser(userId);
      throw error;
    }
    await admin.from("organization_memberships").insert({
      organization_id: organizationId,
      user_id: userId,
      active: input.account_status === "active",
    });
    await assignRoles(
      admin,
      organizationId,
      userId,
      fd.getAll("role_ids").map(String).filter(Boolean),
    );
    revalidatePath("/admin/users");
  } catch (error) {
    redirect(
      `/admin/users?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create company user")}`,
    );
  }
  redirect("/admin/users?success=Company%20user%20created");
}

export async function updateEmployee(fd: FormData) {
  const input = editSchema.parse(Object.fromEntries(fd));
  const { admin, organizationId } = await requireOrganizationAdmin();
  const current = await admin
    .from("profiles")
    .select("id")
    .eq("id", input.id)
    .eq("organization_id", organizationId)
    .single();
  if (current.error) throw new Error("Company user not found");
  const authUpdate: Parameters<typeof admin.auth.admin.updateUserById>[1] = {
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  };
  if (input.password) authUpdate.password = input.password;
  const auth = await admin.auth.admin.updateUserById(input.id, authUpdate);
  if (auth.error) throw auth.error;
  const { error } = await admin
    .from("profiles")
    .update({
      employee_id: input.employee_id,
      full_name: input.full_name,
      email: input.email,
      mobile: input.mobile || null,
      department_id: input.department_id || null,
      designation_id: input.designation_id || null,
      reporting_manager_id: input.reporting_manager_id || null,
      joined_on: input.joining_date || null,
      account_status: input.account_status,
      force_password_change: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId);
  if (error) throw error;
  await admin
    .from("organization_memberships")
    .update({ active: input.account_status === "active" })
    .eq("organization_id", organizationId)
    .eq("user_id", input.id);
  await assignRoles(
    admin,
    organizationId,
    input.id,
    fd.getAll("role_ids").map(String).filter(Boolean),
  );
  revalidatePath("/admin/users");
  redirect("/admin/users?success=Company%20user%20updated");
}

export async function deactivateEmployee(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const { admin, organizationId, actorId } = await requireOrganizationAdmin();
  if (id === actorId) throw new Error("You cannot deactivate your own account");
  await admin
    .from("profiles")
    .update({
      account_status: "inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);
  await admin
    .from("organization_memberships")
    .update({ active: false })
    .eq("organization_id", organizationId)
    .eq("user_id", id);
  await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  revalidatePath("/admin/users");
}

export async function deleteEmployee(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const { admin, organizationId, actorId } = await requireOrganizationAdmin();
  if (id === actorId) throw new Error("You cannot delete your own account");
  const counts = await Promise.all([
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("created_by", id),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("primary_owner_id", id),
    admin
      .from("task_comments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("author_id", id),
  ]);
  if (counts.some((x) => (x.count ?? 0) > 0)) {
    await admin
      .from("profiles")
      .update({ account_status: "inactive" })
      .eq("id", id)
      .eq("organization_id", organizationId);
    await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  } else {
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error) throw removed.error;
  }
  revalidatePath("/admin/users");
}
