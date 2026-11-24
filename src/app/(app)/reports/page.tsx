import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { formatIST, formatWorkStatus } from "@/lib/format";
import Link from "next/link";
type Filters = {
  from?: string;
  to?: string;
  date_field?: string;
  created_by?: string;
  assigned_to?: string;
  department?: string;
  status?: string;
  priority?: string;
};
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const f = await searchParams,
    access = await getTaskAccess(),
    s = access.client;
  const [{ data: people }, { data: departments }] = await Promise.all([
    s
      .from("profiles")
      .select("id,full_name,employee_id")
      .eq("account_status", "active")
      .order("full_name"),
    s.from("departments").select("id,name").eq("active", true).order("name"),
  ]);
  let query = s
    .from("tasks")
    .select(
      "id,reference,title,status,priority,current_deadline,created_at,creator:profiles!tasks_created_by_fkey(full_name),owner:profiles!tasks_primary_owner_id_fkey(full_name)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!access.isAdmin) query = query.or(ownTaskFilter(access.userId));
  const dateField = [
    "created_at",
    "current_deadline",
    "completion_submitted_at",
    "closed_at",
  ].includes(f.date_field ?? "")
    ? f.date_field!
    : "created_at";
  if (f.from) query = query.gte(dateField, `${f.from}T00:00:00+05:30`);
  if (f.to) query = query.lte(dateField, `${f.to}T23:59:59+05:30`);
  if (f.created_by) query = query.eq("created_by", f.created_by);
  if (f.assigned_to) query = query.eq("primary_owner_id", f.assigned_to);
  if (f.department) query = query.eq("assigned_department_id", f.department);
  if (f.status) query = query.eq("status", f.status);
  if (f.priority) query = query.eq("priority", f.priority);
  const { data: tasks, count } = await query;
  const exportParams = new URLSearchParams(
    Object.entries(f).filter(([, v]) => Boolean(v)) as [string, string][],
  );
  const link = (format: string) => {
    const q = new URLSearchParams(exportParams);
    q.set("format", format);
    return `/api/reports/tasks?${q}`;
  };
  return (
    <main className="page">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold">Reports</h1>
          <p className="text-secondary mb-0">
            Filter authorized operational records and export the complete
            result.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <a href={link("pdf")} className="btn btn-primary">
            <i className="ri-file-pdf-2-line me-1" />
            Download PDF
          </a>
          <a href={link("xlsx")} className="btn btn-outline-primary">
            <i className="ri-file-excel-2-line me-1" />
            Download Excel
          </a>
          <a href={link("csv")} className="btn btn-outline-secondary">
            CSV
          </a>
        </div>
      </div>
      <form className="panel p-4 mb-3">
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label">Date based on</label>
            <select
              name="date_field"
              className="form-select"
              defaultValue={dateField}
            >
              <option value="created_at">Created date</option>
              <option value="current_deadline">Deadline</option>
              <option value="completion_submitted_at">
                Completion submission
              </option>
              <option value="closed_at">Closure date</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">From date</label>
            <input
              name="from"
              type="date"
              className="form-control"
              defaultValue={f.from}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">To date</label>
            <input
              name="to"
              type="date"
              className="form-control"
              defaultValue={f.to}
            />
          </div>
          <div className="col-md-5">
            <label className="form-label">Created by company user</label>
            <select
              name="created_by"
              className="form-select"
              defaultValue={f.created_by ?? ""}
            >
              <option value="">All creators</option>
              {(people ?? []).map((p) => (
                <option value={p.id} key={p.id}>
                  {p.full_name} · {p.employee_id}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-5">
            <label className="form-label">Assigned to company user</label>
            <select
              name="assigned_to"
              className="form-select"
              defaultValue={f.assigned_to ?? ""}
            >
              <option value="">All assignees</option>
              {(people ?? []).map((p) => (
                <option value={p.id} key={p.id}>
                  {p.full_name} · {p.employee_id}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Department</label>
            <select
              name="department"
              className="form-select"
              defaultValue={f.department ?? ""}
            >
              <option value="">All departments</option>
              {(departments ?? []).map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Status</label>
            <select
              name="status"
              className="form-select"
              defaultValue={f.status ?? ""}
            >
              <option value="">All</option>
              {[
                "assigned",
                "acknowledged",
                "accepted",
                "in_progress",
                "pending_verification",
                "rework_required",
                "completed",
                "closed",
                "cancelled",
              ].map((x) => (
                <option value={x} key={x}>
                  {x.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Priority</label>
            <select
              name="priority"
              className="form-select"
              defaultValue={f.priority ?? ""}
            >
              <option value="">All</option>
              {["low", "normal", "high", "critical"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="col-12 d-flex gap-2">
            <button className="btn btn-primary">View report</button>
            <Link href="/reports" className="btn btn-outline-secondary">
              Clear filters
            </Link>
          </div>
        </div>
      </form>
      <section className="panel">
        <div className="p-3 border-bottom d-flex justify-content-between">
          <strong>Report results</strong>
          <span className="status">{count ?? 0} records</span>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Task</th>
                <th>Created by</th>
                <th>Assigned to</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Deadline</th>
                <th>Individual report</th>
              </tr>
            </thead>
            <tbody>
              {(tasks ?? []).map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/tasks/${t.id}`}>{t.reference}</Link>
                  </td>
                  <td>{t.title}</td>
                  <td>
                    {(t.creator as unknown as { full_name?: string })
                      ?.full_name ?? "—"}
                  </td>
                  <td>
                    {(t.owner as unknown as { full_name?: string })
                      ?.full_name ?? "—"}
                  </td>
                  <td>
                    <span className="status">{formatWorkStatus(t.status)}</span>
                  </td>
                  <td>{t.priority}</td>
                  <td>{formatIST(t.current_deadline)}</td>
                  <td>
                    <div className="d-flex gap-1">
                      <a
                        className="btn btn-sm btn-outline-primary"
                        href={`/api/reports/tasks/${t.id}?format=pdf`}
                      >
                        PDF
                      </a>
                      <a
                        className="btn btn-sm btn-outline-secondary"
                        href={`/api/reports/tasks/${t.id}?format=xlsx`}
                      >
                        Excel
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {!tasks?.length && (
                <tr>
                  <td colSpan={8} className="text-center text-secondary py-5">
                    No authorized records match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
