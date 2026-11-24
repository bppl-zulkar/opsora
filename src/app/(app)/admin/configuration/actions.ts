"use server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
const optionalEmail = z.union([z.literal(""), z.string().email()]);
const schema = z.object({
  email_provider: z.enum(["resend", "smtp"]),
  email_from_name: z.string().min(1).max(120),
  email_from_address: optionalEmail,
  email_reply_to: optionalEmail,
  smtp_host: z.string().max(255),
  smtp_port: z.coerce.number().int().min(1).max(65535),
  smtp_user: z.string().max(255),
  resend_api_key: z.string().max(1000),
  smtp_password: z.string().max(1000),
  vapid_public_key: z.string().max(2000),
  vapid_private_key: z.string().max(2000),
  vapid_subject: z.string().min(3).max(500),
});
export async function saveCommunicationSettings(fd: FormData) {
  try {
    const input = schema.parse(Object.fromEntries(fd));
    const s = await createClient();
    const {
      data: { user },
    } = await s.auth.getUser();
    if (!user) redirect("/login");
    const { data: p } = await s
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (!p?.organization_id) throw new Error("Organization is required");
    const { data: old } = await s
      .from("organization_communication_settings")
      .select(
        "encrypted_resend_api_key,encrypted_smtp_password,encrypted_vapid_private_key",
      )
      .eq("organization_id", p.organization_id)
      .maybeSingle();
    const emailEnabled = fd.get("email_enabled") === "on",
      pushEnabled = fd.get("web_push_enabled") === "on";
    const resend = input.resend_api_key
      ? encryptSecret(input.resend_api_key)
      : (old?.encrypted_resend_api_key ?? null);
    const smtp = input.smtp_password
      ? encryptSecret(input.smtp_password)
      : (old?.encrypted_smtp_password ?? null);
    const vapid = input.vapid_private_key
      ? encryptSecret(input.vapid_private_key)
      : (old?.encrypted_vapid_private_key ?? null);
    if (emailEnabled && !input.email_from_address)
      throw new Error("From address is required when email is enabled");
    if (emailEnabled && input.email_provider === "resend" && !resend)
      throw new Error("Resend API key is required");
    if (
      emailEnabled &&
      input.email_provider === "smtp" &&
      (!input.smtp_host || !input.smtp_user || !smtp)
    )
      throw new Error("Complete SMTP settings are required");
    if (pushEnabled && (!input.vapid_public_key || !vapid))
      throw new Error("Both VAPID keys are required");
    const { error } = await s
      .from("organization_communication_settings")
      .upsert(
        {
          organization_id: p.organization_id,
          email_provider: input.email_provider,
          encrypted_resend_api_key: resend,
          email_from_name: input.email_from_name,
          email_from_address: input.email_from_address || null,
          email_reply_to: input.email_reply_to || null,
          smtp_host: input.smtp_host || null,
          smtp_port: input.smtp_port,
          smtp_secure: fd.get("smtp_secure") === "on",
          smtp_user: input.smtp_user || null,
          encrypted_smtp_password: smtp,
          email_enabled: emailEnabled,
          vapid_public_key: input.vapid_public_key || null,
          encrypted_vapid_private_key: vapid,
          vapid_subject: input.vapid_subject,
          web_push_enabled: pushEnabled,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
    if (error) throw error;
  } catch (error) {
    redirect(
      `/admin/configuration?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save configuration")}`,
    );
  }
  redirect("/admin/configuration?success=1");
}
