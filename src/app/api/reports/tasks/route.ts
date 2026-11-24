import { taskCsv, taskExcel, taskPdf } from "@/lib/reports";
import { NextResponse } from "next/server";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
export const runtime = "nodejs";
const allowedDates = new Set([
  "created_at",
  "current_deadline",
  "completion_submitted_at",
  "closed_at",
]);
export async function GET(request: Request) {
  const url = new URL(request.url),
    format = url.searchParams.get("format") ?? "pdf";
  const requestedDate = url.searchParams.get("date_field") ?? "created_at",
    dateField = allowedDates.has(requestedDate) ? requestedDate : "created_at";
  const { client: s, userId, isAdmin } = await getTaskAccess();
  let query = s
    .from("tasks")
    .select(
      "id,reference,title,description,status,priority,progress_percentage,created_at,current_deadline,acknowledged_at,started_at,completion_submitted_at,closed_at,creator:profiles!tasks_created_by_fkey(full_name,employee_id),owner:profiles!tasks_primary_owner_id_fkey(full_name,employee_id),department:departments!tasks_assigned_department_id_fkey(name)",
    )
    .is("deleted_at", null)
    .order(dateField, { ascending: false })
    .limit(10000);
  if (!isAdmin) query = query.or(ownTaskFilter(userId));
  const filter = (key: string, column: string) => {
    const value = url.searchParams.get(key);
    if (value) query = query.eq(column, value);
  };
  const from = url.searchParams.get("from"),
    to = url.searchParams.get("to");
  if (from) query = query.gte(dateField, `${from}T00:00:00+05:30`);
  if (to) query = query.lte(dateField, `${to}T23:59:59+05:30`);
  filter("created_by", "created_by");
  filter("assigned_to", "primary_owner_id");
  filter("department", "assigned_department_id");
  filter("status", "status");
  filter("priority", "priority");
  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = data ?? [],
    stamp = new Date().toISOString().slice(0, 10);
  let body: Buffer, mime: string, ext: string;
  if (format === "xlsx") {
    body = await taskExcel(rows, "Filtered task report");
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  } else if (format === "csv") {
    body = taskCsv(rows);
    mime = "text/csv; charset=utf-8";
    ext = "csv";
  } else {
    body = await taskPdf(rows, "Filtered task report");
    mime = "application/pdf";
    ext = "pdf";
  }
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="opsora-tasks-${stamp}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
