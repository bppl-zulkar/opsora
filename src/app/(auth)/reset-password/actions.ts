"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
export async function updatePassword(fd: FormData) {
  const password = z.string().min(12).max(128).parse(fd.get("password"));
  if (password !== fd.get("confirm"))
    redirect("/reset-password?error=Passwords%20do%20not%20match");
  const s = await createClient();
  const { error } = await s.auth.updateUser({ password });
  if (error)
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  const {
    data: { user },
  } = await s.auth.getUser();
  if (user)
    await s
      .from("profiles")
      .update({ force_password_change: false })
      .eq("id", user.id);
  redirect("/dashboard");
}
