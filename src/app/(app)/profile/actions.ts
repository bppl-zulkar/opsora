"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().min(2).max(160),
  mobile: z.string().max(30),
  bio: z.string().max(500),
  location: z.string().max(120),
  timezone: z.enum(["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"]),
  language: z.enum(["English", "Hindi", "Kannada", "Tamil", "Telugu"]),
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
    in_app: fd.get("notify_in_app") === "on",
    email: fd.get("notify_email") === "on",
    push: fd.get("notify_push") === "on",
    profile: {
      bio: input.bio,
      location: input.location,
      timezone: input.timezone,
      language: input.language,
    },
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

const passwordSchema = z.object({
  password: z.string().min(12).max(128),
  confirm: z.string().min(12).max(128),
});

export async function changeOwnPassword(fd: FormData) {
  const input = passwordSchema.parse(Object.fromEntries(fd));
  if (input.password !== input.confirm) {
    redirect("/profile?error=Passwords%20do%20not%20match#security");
  }
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await client.auth.updateUser({ password: input.password });
  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}#security`);
  }
  await client
    .from("profiles")
    .update({
      force_password_change: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  redirect("/profile?success=Password%20updated%20successfully#security");
}
