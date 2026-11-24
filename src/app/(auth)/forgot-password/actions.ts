"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
export async function requestReset(fd: FormData) {
  const email = z.string().email().parse(fd.get("email"));
  const s = await createClient();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await s.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?next=/reset-password`,
  });
  if (error) redirect("/forgot-password?error=1");
  redirect("/forgot-password?sent=1");
}
