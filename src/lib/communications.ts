import "server-only";
import nodemailer from "nodemailer";
import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";

export async function dispatchCommunication(input: {
  organizationId: string;
  userIds: string[];
  title: string;
  body: string;
  url: string;
}) {
  const admin = createAdminClient();
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (!userIds.length) return;
  const [{ data: config }, { data: people }, { data: subscriptions }] =
    await Promise.all([
      admin
        .from("organization_communication_settings")
        .select("*")
        .eq("organization_id", input.organizationId)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id,email,full_name,notification_preferences")
        .in("id", userIds)
        .eq("account_status", "active"),
      admin
        .from("push_subscriptions")
        .select("id,user_id,subscription")
        .in("user_id", userIds),
    ]);
  if (!config) return;
  if (config.email_enabled) {
    const recipients = (people ?? [])
      .filter((person) => person.notification_preferences?.email !== false)
      .map((person) => person.email);
    if (recipients.length && config.email_from_address) {
      if (
        config.email_provider === "resend" &&
        config.encrypted_resend_api_key
      ) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${decryptSecret(config.encrypted_resend_api_key)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${config.email_from_name} <${config.email_from_address}>`,
            to: recipients,
            reply_to: config.email_reply_to || undefined,
            subject: input.title,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2 style="color:#162052">${input.title}</h2><p>${input.body}</p><p><a href="${new URL(input.url, process.env.APP_PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL).toString()}" style="background:#3156e8;color:white;padding:11px 18px;border-radius:8px;text-decoration:none">Open in Opsora</a></p></div>`,
          }),
        });
      } else if (
        config.email_provider === "smtp" &&
        config.encrypted_smtp_password
      ) {
        const transport = nodemailer.createTransport({
          host: config.smtp_host,
          port: config.smtp_port,
          secure: config.smtp_secure,
          auth: {
            user: config.smtp_user,
            pass: decryptSecret(config.encrypted_smtp_password),
          },
        });
        await transport.sendMail({
          from: {
            name: config.email_from_name,
            address: config.email_from_address,
          },
          replyTo: config.email_reply_to || undefined,
          bcc: recipients,
          subject: input.title,
          text: `${input.body}\n\n${new URL(input.url, process.env.APP_PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL).toString()}`,
        });
      }
    }
  }
  if (
    config.web_push_enabled &&
    config.vapid_public_key &&
    config.encrypted_vapid_private_key
  ) {
    webpush.setVapidDetails(
      config.vapid_subject,
      config.vapid_public_key,
      decryptSecret(config.encrypted_vapid_private_key),
    );
    const allowed = new Set(
      (people ?? [])
        .filter((person) => person.notification_preferences?.push !== false)
        .map((person) => person.id),
    );
    const embedded = (people ?? []).flatMap((person) => {
      const devices = Array.isArray(
        person.notification_preferences?.push_subscriptions,
      )
        ? person.notification_preferences.push_subscriptions
        : [];
      return devices
        .filter((device: { subscription?: unknown }) => device.subscription)
        .map((device: { subscription: webpush.PushSubscription }) => ({
          id: null,
          user_id: person.id,
          subscription: device.subscription,
        }));
    });
    await Promise.allSettled(
      [...(subscriptions ?? []), ...embedded]
        .filter((item) => allowed.has(item.user_id))
        .map(async (item) => {
          try {
            await webpush.sendNotification(
              item.subscription,
              JSON.stringify({
                title: input.title,
                body: input.body,
                url: input.url,
              }),
            );
          } catch (error) {
            if (
              item.id &&
              ((error as { statusCode?: number }).statusCode === 404 ||
                (error as { statusCode?: number }).statusCode === 410)
            )
              await admin
                .from("push_subscriptions")
                .delete()
                .eq("id", item.id);
          }
        }),
    );
  }
}

export async function dispatchTaskEvent(
  taskId: string,
  actorId: string,
  title: string,
  body: string,
) {
  const admin = createAdminClient();
  const { data: task } = await admin
    .from("tasks")
    .select(
      "organization_id,created_by,assigned_by,primary_owner_id,approver_id",
    )
    .eq("id", taskId)
    .single();
  if (!task) return;
  await dispatchCommunication({
    organizationId: task.organization_id,
    userIds: [
      task.created_by,
      task.assigned_by,
      task.primary_owner_id,
      task.approver_id,
    ].filter((id): id is string => Boolean(id) && id !== actorId),
    title,
    body,
    url: `/tasks/${taskId}`,
  });
}
