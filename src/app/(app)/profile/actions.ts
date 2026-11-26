"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().min(2).max(160),
  mobile: z.string().max(30),
  background_theme: z.enum([
    "none",
    "aurora",
    "wave",
    "mist",
    "mesh",
    "dawn",
    "midnight",
  ]),
});
export async function updateProfile(fd: FormData) {
  const input = schema.parse(Object.fromEntries(fd));
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();
  if (currentError) throw new Error("Profile is unavailable");
  const preferences = {
    ...((current.notification_preferences ?? {}) as Record<string, unknown>),
    background_theme: input.background_theme,
  };
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: input.full_name,
      mobile: input.mobile || null,
      notification_preferences: preferences,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error)
    redirect(`/profile?edit=1&error=${encodeURIComponent(error.message)}`);
  await s.auth.updateUser({ data: { full_name: input.full_name } });
  revalidatePath("/", "layout");
  redirect("/profile?success=Profile%20updated");
}
