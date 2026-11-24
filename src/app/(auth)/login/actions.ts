"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
export async function login(formData: FormData) {
  const supabase = await createClient();
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  let email = identifier;
  if (!identifier.includes("@")) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("email")
      .ilike("employee_id", identifier)
      .eq("account_status", "active")
      .limit(2);
    if (profiles?.length !== 1)
      redirect(
        `/login?error=${encodeURIComponent("Invalid employee ID or password")}`,
      );
    email = profiles[0].email;
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error)
    redirect(
      `/login?error=${encodeURIComponent("Invalid email, employee ID or password")}`,
    );
  const { data: profile } = await supabase
    .from("profiles")
    .select("force_password_change,account_status")
    .eq("id", data.user.id)
    .single();
  if (profile?.account_status !== "active") {
    await supabase.auth.signOut();
    redirect("/login?error=Account%20is%20not%20active");
  }
  redirect(profile?.force_password_change ? "/change-password" : "/dashboard");
}
