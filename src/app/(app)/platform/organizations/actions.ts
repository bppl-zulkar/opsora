"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { z } from "zod";
const schema = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  task_prefix: z.string().regex(/^[A-Z0-9]{2,10}$/),
});
export async function createOrganization(fd: FormData) {
  try {
    const input = schema.parse(Object.fromEntries(fd));
    const s = await createClient();
    const {
      data: { user },
    } = await s.auth.getUser();
    if (!user) redirect("/login");
    const { data: p } = await s
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();
    if (!p?.is_platform_admin)
      throw new Error("Platform administrator access required");
    const admin = createAdminClient();
    const { data: org, error } = await admin
      .from("organizations")
      .insert(input)
      .select("id")
      .single();
    if (error) throw error;
    const { error: setupError } = await admin
      .from("organization_settings")
      .insert({ organization_id: org.id });
    if (setupError) throw setupError;
    await admin
      .from("organization_branding")
      .insert({ organization_id: org.id });
    await admin
      .from("organization_counters")
      .insert({ organization_id: org.id });
  } catch (error) {
    redirect(
      `/platform/organizations?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create organization")}`,
    );
  }
  redirect("/platform/organizations?success=1");
}
