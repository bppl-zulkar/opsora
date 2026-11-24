"use server";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const schema = z.object({
  company_name: z.string().min(2).max(160),
  website: z.union([z.literal(""), z.string().url()]),
  primary_color: color,
  secondary_color: color,
  sidebar_color: color,
  theme: z.enum(["light", "dark", "system"]),
  assets: z.string(),
});
export async function createBrandingUpload(fileName: string) {
  const { admin, organizationId } = await requireOrganizationAdmin();
  const extension =
    fileName
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "") || "bin";
  const path = `${organizationId}/branding/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await admin.storage
    .from("branding-assets")
    .createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token };
}
export async function saveBranding(fd: FormData) {
  try {
    const input = schema.parse(Object.fromEntries(fd));
    const assets = z
      .record(z.string(), z.string())
      .parse(JSON.parse(input.assets));
    const { admin, organizationId } = await requireOrganizationAdmin();
    const org = await admin
      .from("organizations")
      .update({
        name: input.company_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);
    if (org.error) throw org.error;
    const settings = await admin
      .from("organization_settings")
      .upsert(
        { organization_id: organizationId, website: input.website || null },
        { onConflict: "organization_id" },
      );
    if (settings.error) throw settings.error;
    const branding = await admin.from("organization_branding").upsert(
      {
        organization_id: organizationId,
        primary_color: input.primary_color,
        secondary_color: input.secondary_color,
        sidebar_color: input.sidebar_color,
        theme: input.theme,
        assets,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
    if (branding.error) throw branding.error;
    revalidatePath("/", "layout");
  } catch (error) {
    redirect(
      `/admin/branding?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save branding")}`,
    );
  }
  redirect("/admin/branding?success=Branding%20saved");
}
