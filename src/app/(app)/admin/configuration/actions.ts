"use server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { redirect } from "next/navigation";
import { z } from "zod";
import nodemailer from "nodemailer";
const optionalEmail = z.union([z.literal(""), z.string().email()]);
const schema = z.object({
  email_from_name: z.string().min(1).max(120),
  gmail_address: optionalEmail,
  email_reply_to: optionalEmail,
  gmail_app_password: z.string().max(1000),
  vapid_public_key: z.string().max(2000),
  vapid_private_key: z.string().max(2000),
  vapid_subject: z.string().min(3).max(500),
});
export async function saveCommunicationSettings(fd: FormData) {
  try {
    const input = schema.parse(Object.fromEntries(fd));
    const { session: s, organizationId, actorId } =
      await requireOrganizationAdmin();
    const { data: old } = await s
      .from("organization_communication_settings")
      .select(
        "encrypted_smtp_password,encrypted_vapid_private_key",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();
    const emailEnabled = fd.get("email_enabled") === "on",
      pushEnabled = fd.get("web_push_enabled") === "on";
    const smtp = input.gmail_app_password
      ? encryptSecret(input.gmail_app_password.replaceAll(" ", ""))
      : (old?.encrypted_smtp_password ?? null);
    const vapid = input.vapid_private_key
      ? encryptSecret(input.vapid_private_key)
      : (old?.encrypted_vapid_private_key ?? null);
    if (emailEnabled && (!input.gmail_address || !smtp))
      throw new Error("Gmail address and Gmail App Password are required");
    if (pushEnabled && (!input.vapid_public_key || !vapid))
      throw new Error("Both VAPID keys are required");
    const { error } = await s
      .from("organization_communication_settings")
      .upsert(
        {
          organization_id: organizationId,
          email_provider: "smtp",
          email_from_name: input.email_from_name,
          email_from_address: input.gmail_address || null,
          email_reply_to: input.email_reply_to || null,
          smtp_host: "smtp.gmail.com",
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: input.gmail_address || null,
          encrypted_smtp_password: smtp,
          email_enabled: emailEnabled,
          vapid_public_key: input.vapid_public_key || null,
          encrypted_vapid_private_key: vapid,
          vapid_subject: input.vapid_subject,
          web_push_enabled: pushEnabled,
          updated_by: actorId,
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

export async function sendTestCommunicationEmail(fd: FormData) {
  const recipient = z.string().email().parse(fd.get("recipient"));
  try {
    const { admin, organizationId } = await requireOrganizationAdmin();
    const { data: settings, error } = await admin
      .from("organization_communication_settings")
      .select(
        "email_enabled,email_from_name,email_from_address,email_reply_to,smtp_host,smtp_port,smtp_secure,smtp_user,encrypted_smtp_password",
      )
      .eq("organization_id", organizationId)
      .single();
    if (error || !settings)
      throw new Error("Save the Gmail configuration first");
    if (!settings.email_enabled)
      throw new Error("Enable email and save the configuration first");
    if (
      !settings.smtp_host ||
      !settings.smtp_user ||
      !settings.email_from_address ||
      !settings.encrypted_smtp_password
    )
      throw new Error("Gmail configuration is incomplete");
    const transport = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      requireTLS: true,
      auth: {
        user: settings.smtp_user,
        pass: decryptSecret(settings.encrypted_smtp_password),
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
    await transport.sendMail({
      from: {
        name: settings.email_from_name,
        address: settings.email_from_address,
      },
      replyTo: settings.email_reply_to || undefined,
      to: recipient,
      subject: "Opsora Gmail configuration test",
      text: "Your Opsora Gmail SMTP configuration is working.",
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2 style="color:#15344b">Opsora</h2><p>Your Gmail SMTP configuration is working.</p></div>',
    });
  } catch (error) {
    redirect(
      `/admin/configuration?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to send test email")}`,
    );
  }
  redirect("/admin/configuration?success=test-email");
}
