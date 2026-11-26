import "server-only";
import nodemailer from "nodemailer";
import * as webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { individualTaskPdf } from "@/lib/reports";
import { formatIST, formatWorkStatus } from "@/lib/format";
import sharp from "sharp";

type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
};

export async function dispatchCommunication(input: {
  organizationId: string;
  userIds: string[];
  title: string;
  body: string;
  url: string;
  html?: string;
  attachments?: EmailAttachment[];
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
            html:
              input.html ??
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2 style="color:#162052">${input.title}</h2><p>${input.body}</p><p><a href="${new URL(input.url, process.env.APP_PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL).toString()}" style="background:#3156e8;color:white;padding:11px 18px;border-radius:8px;text-decoration:none">Open in Opsora</a></p></div>`,
            attachments: input.attachments?.map((attachment) => ({
              filename: attachment.filename,
              content: attachment.content.toString("base64"),
              content_type: attachment.contentType,
              content_id: attachment.cid,
            })),
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
          requireTLS: !config.smtp_secure,
          auth: {
            user: config.smtp_user,
            pass: decryptSecret(config.encrypted_smtp_password),
          },
          connectionTimeout: 15000,
          greetingTimeout: 15000,
          socketTimeout: 30000,
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
          html: input.html,
          attachments: input.attachments?.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            contentType: attachment.contentType,
            cid: attachment.cid,
          })),
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
              await admin.from("push_subscriptions").delete().eq("id", item.id);
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
  const [
    { data: task },
    { data: history },
    { data: evidence },
    { data: comments },
    { data: actor },
  ] = await Promise.all([
    admin
      .from("tasks")
      .select(
        "*,creator:profiles!tasks_created_by_fkey(full_name,employee_id,email),owner:profiles!tasks_primary_owner_id_fkey(full_name,employee_id,email),approver:profiles!tasks_approver_id_fkey(full_name,employee_id,email),department:departments!tasks_assigned_department_id_fkey(name)",
      )
      .eq("id", taskId)
      .single(),
    admin
      .from("task_status_history")
      .select(
        "previous_status,new_status,remarks,created_at,actor:profiles(full_name,employee_id)",
      )
      .eq("task_id", taskId)
      .order("created_at"),
    admin
      .from("task_attachments")
      .select(
        "file_name,mime_type,file_size,evidence_type,remarks,created_at,storage_path",
      )
      .eq("task_id", taskId)
      .order("created_at"),
    admin
      .from("task_comments")
      .select("body,created_at,author:profiles(full_name,employee_id)")
      .eq("task_id", taskId)
      .order("created_at"),
    admin
      .from("profiles")
      .select("full_name,employee_id")
      .eq("id", actorId)
      .maybeSingle(),
  ]);
  if (!task) return;
  const reportEvidence: Array<Record<string, unknown>> = [];
  const inlineAttachments: EmailAttachment[] = [];
  for (const [index, item] of (evidence ?? []).entries()) {
    const isPhoto = String(item.mime_type ?? "").startsWith("image/");
    if (!isPhoto || index >= 12) {
      reportEvidence.push(item);
      continue;
    }
    const { data: object } = await admin.storage
      .from("task-evidence")
      .download(item.storage_path);
    if (!object) {
      reportEvidence.push(item);
      continue;
    }
    try {
      const source = Buffer.from(await object.arrayBuffer());
      const converted = await sharp(source)
        .rotate()
        .resize({
          width: 1400,
          height: 1400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82 })
        .toBuffer();
      const cid = `task-photo-${index}@opsora`;
      reportEvidence.push({
        ...item,
        photoBytes: converted,
        photoFormat: "image/jpeg",
      });
      inlineAttachments.push({
        filename: `${String(item.file_name ?? `evidence-${index + 1}`).replace(/\.[^.]+$/, "")}.jpg`,
        content: converted,
        contentType: "image/jpeg",
        cid,
      });
    } catch {
      reportEvidence.push({
        ...item,
        photoError: "Photo could not be rendered.",
      });
    }
  }
  const report = await individualTaskPdf(
    task,
    history ?? [],
    reportEvidence,
    comments ?? [],
  );
  const baseUrl =
    process.env.APP_PRODUCTION_URL || process.env.NEXT_PUBLIC_APP_URL!;
  const taskUrl = new URL(`/tasks/${taskId}`, baseUrl).toString();
  const escape = (value: unknown) =>
    String(value ?? "—")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const latestRemark = [...(history ?? [])]
    .reverse()
    .find((event) => event.remarks)?.remarks;
  const actorName = actor?.full_name ?? "A company user";
  const ownerName = task.owner?.full_name ?? "the assigned user";
  const eventSummary =
    task.status === "assigned"
      ? `Task assigned by ${actorName} to ${ownerName}.`
      : task.status === "in_progress"
          ? `Work started or resumed by ${actorName}.`
          : task.status === "on_hold"
            ? `Task placed on hold by ${actorName}.`
            : task.status === "pending_verification"
              ? `Task completed by ${actorName} and submitted for verification.`
              : task.status === "closed"
                ? `Task approved and closed by ${actorName}.`
                : `Task updated to ${formatWorkStatus(task.status)} by ${actorName}.`;
  const notificationBody = `${eventSummary} ${body}`;
  const notificationTitle = `${task.reference} · ${formatWorkStatus(task.status)} · ${title}`;
  const detailRows = [
    ["Task", task.title],
    ["Reference", task.reference],
    ["Status", formatWorkStatus(task.status)],
    ["Priority", task.priority],
    ["Department", task.department?.name],
    ["Created by", task.creator?.full_name],
    ["Assigned to", task.owner?.full_name],
    [
      "Deadline",
      task.current_deadline ? formatIST(task.current_deadline) : "—",
    ],
  ];
  const photoHtml = inlineAttachments.length
    ? `<h2 style="font-size:18px;color:#16344c;margin:30px 0 12px">Evidence photos</h2><div>${inlineAttachments
        .map(
          (attachment) =>
            `<img src="cid:${attachment.cid}" alt="Evidence" style="display:inline-block;width:180px;max-width:45%;height:130px;object-fit:cover;border:1px solid #dce4eb;border-radius:10px;margin:0 10px 10px 0"/>`,
        )
        .join("")}</div>`
    : "";
  const emailHtml = `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Arial,sans-serif;color:#1d2c35"><div style="display:none;max-height:0;overflow:hidden">${escape(notificationBody)}</div><div style="max-width:680px;margin:0 auto;padding:24px 12px"><div style="background:#15344b;padding:22px 28px;color:#fff"><strong style="font-size:20px">Opsora</strong><span style="float:right;background:#3156e8;border-radius:999px;padding:7px 12px;font-size:12px">${escape(formatWorkStatus(task.status))}</span></div><div style="background:#fff;border:1px solid #dce4eb;border-top:0;border-radius:0 0 16px 16px;padding:30px"><div style="text-transform:uppercase;letter-spacing:2px;color:#678584;font-size:12px;font-weight:bold">Task workflow update</div><h1 style="font-size:28px;color:#16344c;margin:10px 0">${escape(notificationTitle)}</h1><p style="font-size:16px;line-height:1.6">${escape(notificationBody)}</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:24px 0">${detailRows.map(([label, value]) => `<tr><td style="width:34%;padding:10px;border-bottom:1px solid #e4eaef;color:#60717d;font-size:12px;text-transform:uppercase">${escape(label)}</td><td style="padding:10px;border-bottom:1px solid #e4eaef;font-weight:600">${escape(value)}</td></tr>`).join("")}</table><h2 style="font-size:18px;color:#16344c;margin:28px 0 10px">Latest discussion</h2><div style="border-left:4px solid #168b83;background:#f5faf9;padding:14px 16px;line-height:1.6">${escape(latestRemark ?? body)}</div><h2 style="font-size:18px;color:#16344c;margin:28px 0 10px">Workflow timeline</h2><table role="presentation" style="width:100%;border-collapse:collapse"><tr style="background:#15344b;color:#fff"><th style="padding:9px;text-align:left">Status</th><th style="padding:9px;text-align:left">User</th><th style="padding:9px;text-align:left">Time</th></tr>${(
    (history ?? []).filter(
      (event) => !["acknowledged", "accepted"].includes(event.new_status),
    )
  )
    .slice(-8)
    .map(
      (event) =>
        `<tr><td style="padding:9px;border:1px solid #dce4eb">${escape(formatWorkStatus(event.new_status))}</td><td style="padding:9px;border:1px solid #dce4eb">${escape((event.actor as unknown as { full_name?: string })?.full_name ?? "System")}</td><td style="padding:9px;border:1px solid #dce4eb">${escape(formatIST(event.created_at))}</td></tr>`,
    )
    .join(
      "",
    )}</table>${photoHtml}<div style="border:1px solid #dce4eb;background:#f8fafc;padding:16px;margin:24px 0"><strong>PDF report attached</strong><br/><span style="color:#60717d">The complete report includes task details, workflow history, discussions and evidence photos.</span></div><p style="text-align:center;margin:28px 0 8px"><a href="${taskUrl}" style="display:inline-block;background:#3156e8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:bold">Open task in Opsora</a></p><div style="border-top:1px solid #e4eaef;margin-top:28px;padding-top:16px;color:#778792;font-size:12px">Opsora · Automated workflow notification</div></div></div></body></html>`;
  await dispatchCommunication({
    organizationId: task.organization_id,
    userIds: [
      task.created_by,
      task.assigned_by,
      task.primary_owner_id,
      task.approver_id,
    ].filter((id): id is string => Boolean(id)),
    title: notificationTitle,
    body: notificationBody,
    url: `/tasks/${taskId}`,
    html: emailHtml,
    attachments: [
      ...inlineAttachments,
      {
        filename: `${task.reference}-report.pdf`,
        content: report,
        contentType: "application/pdf",
      },
    ],
  });
}
