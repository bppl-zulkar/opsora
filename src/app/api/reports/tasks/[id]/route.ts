import { individualTaskExcel, individualTaskPdf } from "@/lib/reports";
import { NextResponse } from "next/server";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
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
      "*,creator:profiles!tasks_created_by_fkey(full_name,employee_id),owner:profiles!tasks_primary_owner_id_fkey(full_name,employee_id),department:departments!tasks_assigned_department_id_fkey(name)",
    )
    .eq("id", id);
  if (!isAdmin) taskQuery = taskQuery.or(ownTaskFilter(userId));
  const [
    { data: task, error },
    { data: history },
    { data: attachments },
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
      .select("file_name,mime_type,file_size,evidence_type,remarks,created_at")
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
  const reportArgs = [
    task,
    history ?? [],
    attachments ?? [],
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
