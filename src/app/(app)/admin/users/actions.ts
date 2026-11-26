"use server";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { writeAudit } from "@/lib/audit";
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

export async function activateEmployee(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const { admin, organizationId } = await requireOrganizationAdmin();
  const { data: profile, error } = await admin
    .from("profiles")
    .update({ account_status: "active", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error || !profile) throw new Error("Company user not found");
  await admin
    .from("organization_memberships")
    .update({ active: true })
    .eq("organization_id", organizationId)
    .eq("user_id", id);
  const auth = await admin.auth.admin.updateUserById(id, {
    ban_duration: "none",
  });
  if (auth.error) throw auth.error;
  revalidatePath("/admin/users");
}

export async function deleteEmployee(fd: FormData) {
  try {
    const id = z.string().uuid().parse(fd.get("id"));
    const { admin, organizationId, actorId } =
      await requireOrganizationAdmin();
    if (id === actorId) throw new Error("You cannot delete your own account");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,full_name,email,employee_id,account_status,deleted_at")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();
    if (profileError || !profile) throw new Error("Company user not found");

    const deletedAt = new Date().toISOString();
    const tombstone = id.replaceAll("-", "");

    // Keep the profile row so historical tasks, discussions and audit records
    // retain their author, while removing it from every active relationship.
    const cleanupResults = await Promise.all([
      admin
        .from("profiles")
        .update({ reporting_manager_id: null })
        .eq("organization_id", organizationId)
        .eq("reporting_manager_id", id),
      admin
        .from("departments")
        .update({ head_id: null })
        .eq("organization_id", organizationId)
        .eq("head_id", id),
      admin
        .from("departments")
        .update({ reporting_manager_id: null })
        .eq("organization_id", organizationId)
        .eq("reporting_manager_id", id),
      admin
        .from("departments")
        .update({ coordinator_id: null })
        .eq("organization_id", organizationId)
        .eq("coordinator_id", id),
      admin
        .from("organization_memberships")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", id),
      admin
        .from("user_roles")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", id),
      admin
        .from("user_permission_overrides")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", id),
    ]);
    const cleanupError = cleanupResults.find((result) => result.error)?.error;
    if (cleanupError) throw cleanupError;

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        account_status: "inactive",
        deleted_at: deletedAt,
        email: `deleted+${tombstone}@invalid.opsora.local`,
        employee_id: `DELETED-${tombstone}`,
        mobile: null,
        department_id: null,
        designation_id: null,
        reporting_manager_id: null,
        notification_preferences: { in_app: false, email: false, push: false },
        updated_at: deletedAt,
      })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (updateError) throw updateError;

    // Supabase soft deletion revokes authentication without cascading away the
    // profile row required by immutable operational history.
    const removed = await admin.auth.admin.deleteUser(id, true);
    if (removed.error) throw removed.error;

    await writeAudit(admin, {
      organizationId,
      actorId,
      action: "company_user.deleted",
      entityType: "profile",
      entityId: id,
      previous: profile,
      next: { account_status: "inactive", deleted_at: deletedAt },
      reason: "Deleted by an organization administrator",
    });
    revalidatePath("/admin/users");
  } catch (error) {
    redirect(
      `/admin/users?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to delete company user")}`,
    );
  }
  redirect("/admin/users?success=Company%20user%20deleted");
}

const bulkActionSchema = z.enum(["activate", "deactivate", "delete"]);

export async function bulkEmployeeAction(fd: FormData) {
  let successMessage = "Company users updated";
  try {
    const action = bulkActionSchema.parse(fd.get("bulk_action"));
    const ids = [
      ...new Set(
        fd
          .getAll("user_ids")
          .map(String)
          .map((id) => z.string().uuid().parse(id)),
      ),
    ].slice(0, 250);
    if (!ids.length) throw new Error("Select at least one company user");

    const { admin, organizationId, actorId } =
      await requireOrganizationAdmin();
    if (ids.includes(actorId))
      throw new Error("Your own account cannot be changed in a bulk action");

    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id,full_name,email,employee_id,account_status,deleted_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("id", ids);
    if (profileError) throw profileError;
    if ((profiles ?? []).length !== ids.length)
      throw new Error("One or more selected company users were not found");

    for (const profile of profiles ?? []) {
      if (action === "delete") {
        // Inline the existing action's protected workflow without following its
        // redirect; bulk deletion must finish every selected account first.
        const deletedAt = new Date().toISOString();
        const tombstone = profile.id.replaceAll("-", "");
        const cleanupResults = await Promise.all([
          admin.from("profiles").update({ reporting_manager_id: null }).eq("organization_id", organizationId).eq("reporting_manager_id", profile.id),
          admin.from("departments").update({ head_id: null }).eq("organization_id", organizationId).eq("head_id", profile.id),
          admin.from("departments").update({ reporting_manager_id: null }).eq("organization_id", organizationId).eq("reporting_manager_id", profile.id),
          admin.from("departments").update({ coordinator_id: null }).eq("organization_id", organizationId).eq("coordinator_id", profile.id),
          admin.from("organization_memberships").delete().eq("organization_id", organizationId).eq("user_id", profile.id),
          admin.from("user_roles").delete().eq("organization_id", organizationId).eq("user_id", profile.id),
          admin.from("user_permission_overrides").delete().eq("organization_id", organizationId).eq("user_id", profile.id),
        ]);
        const cleanupError = cleanupResults.find((result) => result.error)?.error;
        if (cleanupError) throw cleanupError;
        const { error: updateError } = await admin
          .from("profiles")
          .update({
            account_status: "inactive",
            deleted_at: deletedAt,
            email: `deleted+${tombstone}@invalid.opsora.local`,
            employee_id: `DELETED-${tombstone}`,
            mobile: null,
            department_id: null,
            designation_id: null,
            reporting_manager_id: null,
            notification_preferences: { in_app: false, email: false, push: false },
            updated_at: deletedAt,
          })
          .eq("id", profile.id)
          .eq("organization_id", organizationId);
        if (updateError) throw updateError;
        const removed = await admin.auth.admin.deleteUser(profile.id, true);
        if (removed.error) throw removed.error;
        await writeAudit(admin, {
          organizationId,
          actorId,
          action: "company_user.deleted",
          entityType: "profile",
          entityId: profile.id,
          previous: profile,
          next: { account_status: "inactive", deleted_at: deletedAt },
          reason: "Bulk deleted by an organization administrator",
        });
        continue;
      }

      const active = action === "activate";
      const { error: updateError } = await admin
        .from("profiles")
        .update({
          account_status: active ? "active" : "inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .eq("organization_id", organizationId);
      if (updateError) throw updateError;
      const { error: membershipError } = await admin
        .from("organization_memberships")
        .update({ active })
        .eq("organization_id", organizationId)
        .eq("user_id", profile.id);
      if (membershipError) throw membershipError;
      const auth = await admin.auth.admin.updateUserById(profile.id, {
        ban_duration: active ? "none" : "876000h",
      });
      if (auth.error) throw auth.error;
      await writeAudit(admin, {
        organizationId,
        actorId,
        action: `company_user.${action}d`,
        entityType: "profile",
        entityId: profile.id,
        previous: { account_status: profile.account_status },
        next: { account_status: active ? "active" : "inactive" },
        reason: `Bulk ${action} by an organization administrator`,
      });
    }
    revalidatePath("/admin/users");
    const label = action === "delete" ? "deleted" : `${action}d`;
    successMessage = `${ids.length} company user${ids.length === 1 ? "" : "s"} ${label}`;
  } catch (error) {
    redirect(
      `/admin/users?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to update selected company users")}`,
    );
  }
  redirect(`/admin/users?success=${encodeURIComponent(successMessage)}`);
}
