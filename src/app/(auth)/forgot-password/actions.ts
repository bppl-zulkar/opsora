"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import {
  clearRecoveryChallenge,
  createRecoveryChallenge,
  getRecoveryChallenge,
  recoveryCodeMatches,
  setRecoveryChallenge,
} from "@/lib/password-recovery";
import nodemailer from "nodemailer";
import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

const requestSchema = z.object({
  employee_id: z.string().trim().min(1).max(50),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
});

export async function requestReset(fd: FormData) {
  try {
    const input = requestSchema.parse(Object.fromEntries(fd));
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id,organization_id,employee_id,full_name,email")
      .ilike("employee_id", input.employee_id)
      .ilike("email", input.email)
      .eq("account_status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (!profile)
      throw new Error("Email and employee ID do not match an active account");
    const currentChallenge = await getRecoveryChallenge();
    if (
      currentChallenge &&
      currentChallenge.userId === profile.id &&
      currentChallenge.expiresAt > Date.now() + 9 * 60 * 1000
    )
      throw new Error("Please wait one minute before requesting another OTP");

    const { data: settings } = await admin
      .from("organization_communication_settings")
      .select(
        "email_enabled,email_from_name,email_from_address,email_reply_to,smtp_host,smtp_port,smtp_secure,smtp_user,encrypted_smtp_password",
      )
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (
      !settings?.email_enabled ||
      !settings.email_from_address ||
      !settings.smtp_host ||
      !settings.smtp_user ||
      !settings.encrypted_smtp_password
    )
      throw new Error("Password recovery email is not configured");

    const code = String(randomInt(100000, 1000000));
    const safeName = profile.full_name
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
    const transport = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      requireTLS: !settings.smtp_secure,
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
      to: profile.email,
      subject: "Your Opsora password reset OTP",
      text: `Hello ${profile.full_name}, your Opsora password reset OTP is ${code}. It expires in 10 minutes. Do not share this code.`,
      html: `<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#1d2c35"><div style="background:#15344b;color:#fff;padding:20px 24px"><strong style="font-size:20px">Opsora</strong></div><div style="border:1px solid #dce4eb;border-top:0;padding:28px"><h1 style="font-size:24px;color:#15344b">Password reset verification</h1><p>Hello ${safeName},</p><p>Enter this one-time password to continue:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#f1f5f9;padding:18px;margin:22px 0">${code}</div><p>This OTP expires in 10 minutes. Do not share it with anyone.</p><p style="color:#64748b;font-size:13px">If you did not request this reset, you can ignore this email.</p></div></div>`,
    });
    await setRecoveryChallenge(
      createRecoveryChallenge({
        userId: profile.id,
        organizationId: profile.organization_id,
        email: profile.email,
        employeeId: profile.employee_id,
        code,
      }),
    );
  } catch (error) {
    await clearRecoveryChallenge();
    redirect(
      `/forgot-password?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to send OTP")}`,
    );
  }
  redirect("/forgot-password/verify?sent=1");
}

export async function verifyResetOtp(fd: FormData) {
  const parsed = z.string().regex(/^\d{6}$/).safeParse(fd.get("otp"));
  if (!parsed.success)
    redirect("/forgot-password/verify?error=Enter%20a%20valid%20six-digit%20OTP");
  const code = parsed.data;
  const challenge = await getRecoveryChallenge();
  if (!challenge)
    redirect(
      "/forgot-password?error=The%20OTP%20expired.%20Request%20a%20new%20one",
    );
  if (challenge.verified) redirect("/reset-password");
  if (challenge.attempts >= 5) {
    await clearRecoveryChallenge();
    redirect("/forgot-password?error=Too%20many%20incorrect%20attempts");
  }
  if (!recoveryCodeMatches(challenge, code)) {
    const next = { ...challenge, attempts: challenge.attempts + 1 };
    if (next.attempts >= 5) await clearRecoveryChallenge();
    else await setRecoveryChallenge(next);
    redirect(
      `/forgot-password/verify?error=${encodeURIComponent(next.attempts >= 5 ? "Too many incorrect attempts. Request a new OTP" : `Incorrect OTP. ${5 - next.attempts} attempts remaining`)}`,
    );
  }
  await setRecoveryChallenge({
    ...challenge,
    verified: true,
    codeHash: "",
    salt: "",
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  redirect("/reset-password");
}
