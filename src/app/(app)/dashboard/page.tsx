import Link from "next/link";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { formatIST, formatWorkStatus } from "@/lib/format";
export default async function Dashboard() {
  const { client: s, userId, isAdmin } = await getTaskAccess();
  const { data: p } = await s
    .from("profiles")
    .select("full_name,organization_id")
    .eq("id", userId)
    .single();
  let taskQuery = s
    .from("tasks")
    .select(
      "id,reference,title,status,priority,current_deadline,progress_percentage",
    )
    .order("created_at", { ascending: false })
    .limit(8);
  if (!isAdmin) taskQuery = taskQuery.or(ownTaskFilter(userId));
  const { data } = await taskQuery;
  const tasks = data ?? [];
  const open = tasks.filter(
      (t) => !["closed", "cancelled"].includes(t.status),
    ).length,
    overdue = tasks.filter(
      (t) =>
        new Date(t.current_deadline) < new Date() &&
        !["closed", "completed", "cancelled"].includes(t.status),
    ).length;
  return (
    <main className="page">
      <div className="dashboard-hero d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">
            Good day, {p?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-secondary mb-0">
            Here is today’s operational picture.
          </p>
        </div>
        <Link className="btn btn-primary" href="/tasks/new">
          <i className="ri-add-line me-1" />
          Create task
        </Link>
      </div>
      <div className="row g-3 mb-4">
        {[
          ["Open tasks", open, "ri-list-check-3"],
          [
            "Due today",
            tasks.filter(
              (t) =>
                new Date(t.current_deadline).toDateString() ===
                new Date().toDateString(),
            ).length,
            "ri-calendar-event-line",
          ],
          ["Overdue", overdue, "ri-alarm-warning-line"],
          [
            "Completed",
            tasks.filter(
              (t) => t.status === "completed" || t.status === "closed",
            ).length,
            "ri-checkbox-circle-line",
          ],
        ].map((x) => (
          <div className="col-sm-6 col-xl-3" key={x[0] as string}>
            <div className="kpi-card">
              <div className="d-flex justify-content-between">
                <span className="kpi-label">{x[0]}</span>
                <i className={`${x[2]} fs-4 text-primary`} />
              </div>
              <div className="kpi-number">{x[1]}</div>
              <small className="text-secondary">Live from your workspace</small>
            </div>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="p-3 border-bottom d-flex justify-content-between">
          <strong>Recent tasks</strong>
          <Link href="/tasks">View all</Link>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Deadline</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/tasks/${t.id}`}>{t.reference}</Link>
                  </td>
                  <td>{t.title}</td>
                  <td>
                    <span className="status">{formatWorkStatus(t.status)}</span>
                  </td>
                  <td>
                    <span
                      className={
                        t.priority === "high" || t.priority === "critical"
                          ? "status priority-high"
                          : "status"
                      }
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td>{formatIST(t.current_deadline)}</td>
                  <td style={{ minWidth: 130 }}>
                    <div className="progress" style={{ height: 6 }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${t.progress_percentage}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!tasks.length && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-5">
                    No tasks yet. Create the first operational task.
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
