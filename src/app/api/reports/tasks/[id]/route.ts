import { individualTaskExcel, individualTaskPdf } from "@/lib/reports";
import { NextResponse } from "next/server";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import sharp from "sharp";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    format = new URL(request.url).searchParams.get("format") ?? "pdf";
  const { client: s, userId, isAdmin } = await getTaskAccess();
  let taskQuery = s
    .from("tasks")
    .select(
      "*,creator:profiles!tasks_created_by_fkey(full_name,employee_id),owner:profiles!tasks_primary_owner_id_fkey(full_name,employee_id),approver:profiles!tasks_approver_id_fkey(full_name,employee_id),department:departments!tasks_assigned_department_id_fkey(name)",
    )
    .eq("id", id);
  if (!isAdmin) taskQuery = taskQuery.or(ownTaskFilter(userId));
  const [
    { data: task, error },
    { data: history },
    { data: attachments, error: attachmentsError },
    { data: comments },
  ] = await Promise.all([
    taskQuery.single(),
    s
      .from("task_status_history")
      .select(
        "previous_status,new_status,remarks,created_at,actor:profiles(full_name,employee_id)",
      )
      .eq("task_id", id)
      .order("created_at"),
    s
      .from("task_attachments")
      .select(
        "file_name,mime_type,file_size,evidence_type,remarks,created_at,storage_path",
      )
      .eq("task_id", id)
      .order("created_at"),
    s
      .from("task_comments")
      .select("body,created_at,author:profiles(full_name,employee_id)")
      .eq("task_id", id)
      .order("created_at"),
  ]);
  if (error || !task)
    return new NextResponse("Task not found or access denied", { status: 404 });
  if (attachmentsError)
    return new NextResponse("Unable to load task evidence metadata", {
      status: 500,
    });
  const reportAttachments = [];
  for (const attachment of attachments ?? []) {
    const mimeType = String(attachment.mime_type ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const photoCandidate =
      mimeType.startsWith("image/") ||
      /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg|heic|heif)$/i.test(
        String(attachment.file_name ?? ""),
      );
    if (format === "xlsx" || !photoCandidate) {
      reportAttachments.push(attachment);
      continue;
    }

    if (!attachment.storage_path) {
      reportAttachments.push({
        ...attachment,
        photoError: "Photo storage path is unavailable.",
      });
      continue;
    }
    try {
      const { data, error: downloadError } = await s.storage
        .from("task-evidence")
        .download(attachment.storage_path);
      if (downloadError || !data) {
        reportAttachments.push({
          ...attachment,
          photoError:
            "Unable to retrieve photo from private task evidence storage.",
        });
      } else {
        const input = new Uint8Array(await data.arrayBuffer());
        try {
          const pipeline = sharp(input, { failOn: "error" }).rotate().resize({
            width: 2400,
            height: 2400,
            fit: "inside",
            withoutEnlargement: true,
          });
          const metadata = await pipeline.metadata();
          const photoFormat = metadata.hasAlpha ? "image/png" : "image/jpeg";
          const photoBytes = metadata.hasAlpha
            ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
            : await pipeline.jpeg({ quality: 88 }).toBuffer();
          reportAttachments.push({
            ...attachment,
            photoBytes,
            photoFormat,
          });
        } catch {
          reportAttachments.push({
            ...attachment,
            photoError:
              "Image conversion failed. This photo could not be decoded into a PDF-compatible JPEG or PNG.",
          });
        }
      }
    } catch {
      reportAttachments.push({
        ...attachment,
        photoError:
          "Unable to retrieve photo from private task evidence storage.",
      });
    }
  }
  const reportArgs = [
    task,
    history ?? [],
    reportAttachments,
    comments ?? [],
  ] as const;
  const body =
    format === "xlsx"
      ? await individualTaskExcel(...reportArgs)
      : await individualTaskPdf(...reportArgs);
  const ext = format === "xlsx" ? "xlsx" : "pdf",
    mime =
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${task.reference}-report.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
