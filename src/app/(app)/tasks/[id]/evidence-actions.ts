"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const requestSchema = z.object({
  taskId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024),
  remarks: z.string().trim().min(3).max(500),
});

async function authorizedTask(taskId: string) {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const { data: task } = await session
    .from("tasks")
    .select("id,organization_id,created_by,primary_owner_id")
    .eq("id", taskId)
    .single();
  if (!task || ![task.created_by, task.primary_owner_id].includes(user.id))
    throw new Error("You are not allowed to upload evidence for this task");
  return { user, task, admin: createAdminClient() };
}

export async function createEvidenceUpload(
  input: z.infer<typeof requestSchema>,
) {
  const value = requestSchema.parse(input);
  const { task, admin } = await authorizedTask(value.taskId);
  const extension =
    value.fileName
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "")
      .slice(0, 10) || "bin";
  const path = `${task.organization_id}/${task.id}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await admin.storage
    .from("task-evidence")
    .createSignedUploadUrl(path);
  if (error) throw new Error(error.message);
  return { path, token: data.token, values: value };
}

export async function finalizeEvidenceUpload(
  input: z.infer<typeof requestSchema> & { path: string; checksum: string },
) {
  const value = requestSchema
    .extend({
      path: z.string().min(1),
      checksum: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .parse(input);
  const { user, task, admin } = await authorizedTask(value.taskId);
  const requiredPrefix = `${task.organization_id}/${task.id}/`;
  if (!value.path.startsWith(requiredPrefix))
    throw new Error("Invalid evidence path");
  const { error } = await admin.from("task_attachments").insert({
    organization_id: task.organization_id,
    task_id: task.id,
    uploaded_by: user.id,
    storage_path: value.path,
    file_name: value.fileName,
    mime_type: value.mimeType,
    file_size: value.fileSize,
    evidence_type: "supporting",
    checksum: value.checksum,
    remarks: value.remarks,
    capture_time: new Date().toISOString(),
  });
  if (error) {
    await admin.storage.from("task-evidence").remove([value.path]);
    throw new Error(error.message);
  }
  return { saved: true };
}
