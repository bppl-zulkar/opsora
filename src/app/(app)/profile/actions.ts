"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().min(2).max(160),
  mobile: z.string().max(30),
});
export async function updateProfile(fd: FormData) {
  const input = schema.parse(Object.fromEntries(fd));
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await s
    .from("profiles")
    .update({
      full_name: input.full_name,
      mobile: input.mobile || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error)
    redirect(`/profile?edit=1&error=${encodeURIComponent(error.message)}`);
  await s.auth.updateUser({ data: { full_name: input.full_name } });
  revalidatePath("/profile");
  redirect("/profile?success=Profile%20updated");
}
