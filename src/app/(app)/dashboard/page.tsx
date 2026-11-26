import Link from "next/link";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { formatIST, formatWorkStatus } from "@/lib/format";
import type { CSSProperties } from "react";
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
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (!isAdmin) taskQuery = taskQuery.or(ownTaskFilter(userId));
  const { data } = await taskQuery;
  const tasks = data ?? [];
  const recentTasks = tasks.slice(0, 8);
  const open = tasks.filter(
      (t) => !["completed", "closed", "cancelled"].includes(t.status),
    ).length,
    overdue = tasks.filter(
      (t) =>
        new Date(t.current_deadline) < new Date() &&
        !["closed", "completed", "cancelled"].includes(t.status),
    ).length,
    completed = tasks.filter((t) => t.status === "completed").length,
    finished = tasks.filter((t) =>
      ["completed", "closed"].includes(t.status),
    ).length,
    dueToday = tasks.filter(
      (t) =>
        new Date(t.current_deadline).toDateString() ===
          new Date().toDateString() &&
        !["closed", "cancelled"].includes(t.status),
    ).length,
    completionRate = tasks.length
      ? Math.round((finished / tasks.length) * 100)
      : 0;
  const workflow = [
    ["Assigned", tasks.filter((t) => t.status === "assigned").length],
    [
      "Work in Progress",
      tasks.filter((t) =>
        ["acknowledged", "accepted", "in_progress"].includes(t.status),
      ).length,
    ],
    ["On hold", tasks.filter((t) => t.status === "on_hold").length],
    ["Completed", finished],
  ] as const;
  return (
    <main className="page dashboard-page">
      <section className="dashboard-welcome mb-4">
        <div className="dashboard-welcome-copy">
          <span className="dashboard-eyebrow">Your operations overview</span>
          <h1>
            Good day, {p?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p>
            Stay focused on what needs attention and move work forward with
            confidence.
          </p>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-light" href="/tasks/new">
              <i className="ri-add-line me-1" /> Create task
            </Link>
            <Link className="btn btn-dashboard-ghost" href="/calendar">
              <i className="ri-calendar-line me-1" /> Open calendar
            </Link>
          </div>
        </div>
        <div className="dashboard-score" aria-label={`${completionRate}% completion rate`}>
          <div
            className="dashboard-score-ring"
            style={{ "--score": `${completionRate * 3.6}deg` } as CSSProperties}
          >
            <span>{completionRate}%</span>
          </div>
          <div>
            <strong>Completion rate</strong>
            <small>{finished} tasks completed</small>
          </div>
        </div>
      </section>
      <div className="row g-3 mb-4 dashboard-kpis">
        {[
          ["Open tasks", open, "ri-list-check-3", "/tasks?view=open"],
          ["Due today", dueToday, "ri-calendar-event-line", "/tasks?view=due-today"],
          ["Overdue", overdue, "ri-alarm-warning-line", "/tasks?view=overdue"],
          ["Completed", completed, "ri-checkbox-circle-line", "/tasks?view=completed"],
        ].map((x) => (
          <div className="col-sm-6 col-xl-3" key={x[0] as string}>
            <Link
              href={x[3] as string}
              className="kpi-card dashboard-kpi-card dashboard-kpi-link"
              aria-label={`View ${x[0]}`}
            >
              <div className="dashboard-kpi-icon">
                <i className={`${x[2]}`} />
              </div>
              <div>
                <span className="kpi-label">{x[0]}</span>
                <div className="kpi-number">{x[1]}</div>
                <small className="text-secondary">Live workspace data</small>
              </div>
              <i className="ri-arrow-right-line dashboard-kpi-arrow" aria-hidden="true" />
            </Link>
          </div>
        ))}
      </div>
      <div className="dashboard-content-grid mb-4">
        <section className="panel dashboard-workflow-card p-4">
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div>
              <span className="dashboard-card-kicker">Workflow health</span>
              <h2 className="h5 mb-0">Tasks by current stage</h2>
            </div>
            <Link href="/board" className="btn btn-sm btn-outline-primary">
              View board
            </Link>
          </div>
          <div className="workflow-bars">
            {workflow.map(([label, value], index) => (
              <div className="workflow-bar-row" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
                <div className="workflow-track">
                  <span
                    className={`workflow-fill workflow-fill-${index + 1}`}
                    style={{
                      width: `${tasks.length ? Math.max(4, (value / tasks.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel dashboard-focus-card p-4">
          <span className="dashboard-card-kicker">Today’s focus</span>
          <h2 className="h5">What needs attention</h2>
          <div className="focus-stat">
            <span><i className="ri-alarm-warning-line" /> Overdue</span>
            <strong>{overdue}</strong>
          </div>
          <div className="focus-stat">
            <span><i className="ri-calendar-event-line" /> Due today</span>
            <strong>{dueToday}</strong>
          </div>
          <div className="focus-stat">
            <span><i className="ri-loader-4-line" /> In progress</span>
            <strong>{workflow[1][1]}</strong>
          </div>
          <Link href="/tasks" className="btn btn-primary w-100 mt-3">
            Review all tasks
          </Link>
        </section>
      </div>
      <section className="panel dashboard-recent-card">
        <div className="p-3 border-bottom d-flex justify-content-between">
          <div>
            <span className="dashboard-card-kicker">Latest activity</span>
            <strong className="d-block">Recent tasks</strong>
          </div>
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
              {recentTasks.map((t) => (
              <tr key={t.id}>
                  <td data-label="Reference">
                    <Link href={`/tasks/${t.id}`}>{t.reference}</Link>
                  </td>
                  <td data-label="Task">{t.title}</td>
                  <td data-label="Status">
                    <span className="status">{formatWorkStatus(t.status)}</span>
                  </td>
                  <td data-label="Priority">
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
                  <td data-label="Deadline">{formatIST(t.current_deadline)}</td>
                  <td data-label="Progress" style={{ minWidth: 130 }}>
                    <div className="progress" style={{ height: 6 }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${t.progress_percentage}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {!recentTasks.length && (
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
