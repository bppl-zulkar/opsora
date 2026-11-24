"use server";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
const schema = z.object({
  name: z.string().min(2).max(160),
  code: z
    .string()
    .min(2)
    .max(30)
    .transform((x) => x.toUpperCase()),
  parent_id: z.union([z.literal(""), z.string().uuid()]),
  head_id: z.union([z.literal(""), z.string().uuid()]),
  official_email: z.union([z.literal(""), z.string().email()]),
  office_location: z.string().max(200),
});
export async function createDepartment(fd: FormData) {
  try {
    const i = schema.parse(Object.fromEntries(fd));
    const { admin, organizationId } = await requireOrganizationAdmin();
    const { error } = await admin.from("departments").insert({
      organization_id: organizationId,
      name: i.name,
      code: i.code,
      parent_id: i.parent_id || null,
      head_id: i.head_id || null,
      official_email: i.official_email || null,
      office_location: i.office_location || null,
      active: true,
    });
    if (error) throw error;
    revalidatePath("/admin/departments");
  } catch (error) {
    redirect(
      `/admin/departments?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create department")}`,
    );
  }
  redirect("/admin/departments?success=Department%20created");
}
export async function updateDepartment(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const i = schema.parse(Object.fromEntries(fd));
  const { admin, organizationId } = await requireOrganizationAdmin();
  if (i.parent_id === id)
    throw new Error("A department cannot be its own parent");
  const { error } = await admin
    .from("departments")
    .update({
      name: i.name,
      code: i.code,
      parent_id: i.parent_id || null,
      head_id: i.head_id || null,
      official_email: i.official_email || null,
      office_location: i.office_location || null,
      active: fd.get("active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw error;
  revalidatePath("/admin/departments");
  redirect("/admin/departments?success=Department%20updated");
}
export async function deleteDepartment(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const { admin, organizationId } = await requireOrganizationAdmin();
  const [employees, tasks, children] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("department_id", id),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("assigned_department_id", id),
    admin
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("parent_id", id),
  ]);
  if ([employees, tasks, children].some((x) => (x.count ?? 0) > 0)) {
    await admin
      .from("departments")
      .update({ active: false })
      .eq("id", id)
      .eq("organization_id", organizationId);
  } else {
    const { error } = await admin
      .from("departments")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
  }
  revalidatePath("/admin/departments");
}
