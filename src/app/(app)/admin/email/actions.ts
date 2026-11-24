"use server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import nodemailer from "nodemailer";

const schema = z.object({
  host: z.string().min(3).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().min(1).max(255),
  password: z.string().max(1000),
  from_name: z.string().min(1).max(120),
  from_address: z.string().email(),
  reply_to: z.union([z.literal(""), z.string().email()]),
});

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) throw new Error("An organization is required");
  return { supabase, user, organizationId: profile.organization_id };
}

export async function saveEmailSettings(formData: FormData) {
  try {
    const input = schema.parse(Object.fromEntries(formData));
    const { supabase, user, organizationId } = await context();
    const { data: current } = await supabase
      .from("organization_email_settings")
      .select("encrypted_password")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!input.password && !current?.encrypted_password)
      throw new Error("SMTP password is required");
    const encryptedPassword = input.password
      ? encryptSecret(input.password)
      : current!.encrypted_password;
    const { error } = await supabase.from("organization_email_settings").upsert(
      {
        organization_id: organizationId,
        provider: "smtp",
        host: input.host,
        port: input.port,
        secure: formData.get("secure") === "on",
        username: input.username,
        encrypted_password: encryptedPassword,
        from_name: input.from_name,
        from_address: input.from_address,
        reply_to: input.reply_to || null,
        enabled: formData.get("enabled") === "on",
        created_by: user.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
    if (error) throw error;
  } catch (error) {
    redirect(
      `/admin/email?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save settings")}`,
    );
  }
  redirect("/admin/email?success=Email%20configuration%20saved");
}

export async function sendTestEmail(formData: FormData) {
  const recipient = z.string().email().parse(formData.get("recipient"));
  const { supabase, organizationId } = await context();
  const { data: settings, error } = await supabase
    .from("organization_email_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .single();
  if (error || !settings)
    redirect("/admin/email?error=Save%20the%20email%20configuration%20first");
  try {
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.username,
        pass: decryptSecret(settings.encrypted_password),
      },
      connectionTimeout: 10000,
    });
    await transport.sendMail({
      from: { name: settings.from_name, address: settings.from_address },
      replyTo: settings.reply_to || undefined,
      to: recipient,
      subject: "Opsora email configuration test",
      text: "Your Opsora email configuration is working.",
      html: "<h2>Opsora</h2><p>Your organization email configuration is working.</p><p>Assign. Execute. Verify. Track.</p>",
    });
    await supabase
      .from("organization_email_settings")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_succeeded: true,
        last_test_message: `Delivered to ${recipient}`,
      })
      .eq("organization_id", organizationId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SMTP delivery failed";
    await supabase
      .from("organization_email_settings")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_succeeded: false,
        last_test_message: message.slice(0, 500),
      })
      .eq("organization_id", organizationId);
    redirect(`/admin/email?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/email?success=Test%20email%20sent");
}
