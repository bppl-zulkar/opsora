"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import {
  clearRecoveryChallenge,
  getRecoveryChallenge,
} from "@/lib/password-recovery";
import { redirect } from "next/navigation";
import { z } from "zod";
export async function updatePassword(fd: FormData) {
  const password = z.string().min(12).max(128).parse(fd.get("password"));
  if (password !== fd.get("confirm"))
    redirect("/reset-password?error=Passwords%20do%20not%20match");
  const recovery = await getRecoveryChallenge();
  if (recovery?.verified) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", recovery.userId)
      .eq("organization_id", recovery.organizationId)
      .ilike("email", recovery.email)
      .eq("account_status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (!profile) {
      await clearRecoveryChallenge();
      redirect("/forgot-password?error=Account%20is%20no%20longer%20active");
    }
    const updated = await admin.auth.admin.updateUserById(recovery.userId, {
      password,
    });
    if (updated.error)
      redirect(`/reset-password?error=${encodeURIComponent(updated.error.message)}`);
    await admin
      .from("profiles")
      .update({
        force_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recovery.userId);
    await writeAudit(admin, {
      organizationId: recovery.organizationId,
      actorId: recovery.userId,
      action: "account.password_reset",
      entityType: "profile",
      entityId: recovery.userId,
      reason: "Password reset completed after email OTP verification",
    }).catch(console.error);
    await clearRecoveryChallenge();
    const session = await createClient();
    await session.auth.signOut();
    redirect("/login?success=Password%20updated.%20You%20can%20now%20sign%20in");
  }
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
