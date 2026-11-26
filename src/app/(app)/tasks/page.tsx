import Link from "next/link";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { formatIST, formatWorkStatus } from "@/lib/format";
import { endOfDay, startOfDay } from "date-fns";
import { redirect } from "next/navigation";
import { ResponsiveTaskStatus } from "@/components/responsive-task-status";
type Filters = {
  view?: string;
  q?: string;
  status?: string;
  priority?: string;
  success?: string;
  error?: string;
  page?: string;
};
const PAGE_SIZE = 20;
const taskViews = [
  ["all", "All tasks"],
  ["open", "Open"],
  ["my", "My tasks"],
  ["assigned-by-me", "Assigned by me"],
  ["wip", "Work in progress"],
  ["on-hold", "On hold"],
  ["overdue", "Overdue"],
  ["due-today", "Due today"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
  ["closed", "Closed"],
] as const;
const labels: Record<string, string> = {
  all: "All tasks",
  open: "Open tasks",
  my: "My tasks",
  "assigned-by-me": "Assigned by me",
  department: "Department tasks",
  company: "Company tasks",
  unassigned: "Unassigned tasks",
  overdue: "Overdue tasks",
  "due-today": "Due today",
  upcoming: "Upcoming tasks",
  completed: "Completed tasks",
  closed: "Closed tasks",
  watching: "Watching",
  approvals: "Pending approvals",
  extensions: "Extension requests",
};

function taskListHref(filters: Filters, updates: Partial<Filters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...updates };
  for (const [key, value] of Object.entries(next)) {
    if (value && !(key === "view" && value === "all") && key !== "success" && key !== "error") {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
}
export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const filters = await searchParams,
    view = filters.view ?? "all";
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const rangeFrom = (requestedPage - 1) * PAGE_SIZE;
  const { client: s, userId, isAdmin } = await getTaskAccess();
  const { data: profile } = await s
    .from("profiles")
    .select("department_id")
    .eq("id", userId)
    .single();
  let query = s
    .from("tasks")
    .select(
      "id,reference,title,status,priority,current_deadline,created_at,owner:profiles!tasks_primary_owner_id_fkey(full_name)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (!isAdmin) query = query.or(ownTaskFilter(userId));
  if (view === "open")
    query = query.not("status", "in", "(completed,closed,cancelled)");
  else if (view === "my") query = query.eq("primary_owner_id", userId);
  else if (view === "assigned-by-me") query = query.eq("created_by", userId);
  else if (view === "department" && profile?.department_id)
    query = query.eq("assigned_department_id", profile.department_id);
  else if (view === "unassigned") query = query.is("primary_owner_id", null);
  else if (view === "overdue")
    query = query
      .lt("current_deadline", new Date().toISOString())
      .not("status", "in", "(closed,completed,cancelled)");
  else if (view === "due-today")
    query = query
      .gte("current_deadline", startOfDay(new Date()).toISOString())
      .lte("current_deadline", endOfDay(new Date()).toISOString());
  else if (view === "upcoming")
    query = query
      .gt("current_deadline", endOfDay(new Date()).toISOString())
      .not("status", "in", "(closed,cancelled)");
  else if (view === "wip")
    query = query.in("status", [
      "acknowledged",
      "accepted",
      "in_progress",
      "rework_required",
      "reopened",
    ]);
  else if (view === "on-hold") query = query.eq("status", "on_hold");
  else if (view === "completed") query = query.eq("status", "completed");
  else if (view === "closed") query = query.eq("status", "closed");
  else if (view === "approvals")
    query = query
      .eq("approver_id", userId)
      .eq("status", "pending_verification");
  if (filters.q)
    query = query.or(
      `title.ilike.%${filters.q}%,reference.ilike.%${filters.q}%`,
    );
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  query = query.range(rangeFrom, rangeFrom + PAGE_SIZE - 1);
  const { data, count } = await query;
  const tasks = data ?? [];
  const totalTasks = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE));
  if (requestedPage > totalPages) {
    redirect(taskListHref(filters, { page: String(totalPages) }));
  }
  const currentPage = Math.min(requestedPage, totalPages);
  const firstResult = totalTasks ? rangeFrom + 1 : 0;
  const lastResult = Math.min(rangeFrom + tasks.length, totalTasks);
  return (
    <main className="page">
      {filters.success && (
        <div className="alert alert-success">{filters.success}</div>
      )}
      {filters.error && (
        <div className="alert alert-danger">{filters.error}</div>
      )}
      <div className="page-heading">
        <div>
          <h1 className="h3 fw-bold">{labels[view] ?? "All tasks"}</h1>
          <p className="text-secondary">
            Live authorized assignments and complete lifecycle status.
          </p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary align-self-start">
          <i className="ri-add-line me-1" /> Create task
        </Link>
      </div>
      <ResponsiveTaskStatus
        value={view}
        options={taskViews.map(([value, label]) => ({
          value,
          label,
          href: taskListHref(filters, { view: value, page: undefined }),
        }))}
      />
      <div className="task-view-tabs mb-3">
        {taskViews.map(([key, label]) => (
          <Link
            className={`btn btn-sm ${view === key ? "btn-primary" : "btn-outline-secondary"}`}
            href={taskListHref(filters, { view: key, page: undefined })}
            key={key}
          >
            {label}
          </Link>
        ))}
      </div>
      <form className="panel p-3 mb-3">
        <input type="hidden" name="view" value={view} />
        <div className="row g-2">
          <div className="col-md-6">
            <input
              name="q"
              className="form-control"
              placeholder="Search by title or reference"
              defaultValue={filters.q}
            />
          </div>
          <div className="col-md-2">
            <select
              name="status"
              className="form-select"
              defaultValue={filters.status ?? ""}
            >
              <option value="">All statuses</option>
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
            <select
              name="priority"
              className="form-select"
              defaultValue={filters.priority ?? ""}
            >
              <option value="">All priorities</option>
              {["low", "normal", "high", "critical"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <button className="btn btn-outline-primary w-100">
              Apply filters
            </button>
          </div>
        </div>
      </form>
      <div className="task-results-summary">
        <span>
          Showing <strong>{firstResult}–{lastResult}</strong> of <strong>{totalTasks}</strong> tasks
        </span>
        <span>Page {currentPage} of {totalPages}</span>
      </div>
      <div className="panel table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td data-label="Reference">
                  <Link href={`/tasks/${t.id}`}>{t.reference}</Link>
                </td>
                <td data-label="Title">{t.title}</td>
                <td data-label="Owner">
                  {(t.owner as unknown as { full_name?: string })?.full_name ??
                    "Unassigned"}
                </td>
                <td data-label="Status">
                  <span className="status">{formatWorkStatus(t.status)}</span>
                </td>
                <td data-label="Priority">
                  <span className={`priority-pill priority-${t.priority}`}>
                    {t.priority}
                  </span>
                </td>
                <td data-label="Deadline">{formatIST(t.current_deadline)}</td>
              </tr>
            ))}
            {!tasks.length && (
              <tr>
                <td colSpan={6} className="text-center text-secondary py-5">
                  No tasks match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <nav className="task-pagination" aria-label="Task list pagination">
          <Link
            className={`btn btn-outline-secondary${currentPage <= 1 ? " disabled" : ""}`}
            href={taskListHref(filters, { page: String(Math.max(1, currentPage - 1)) })}
            aria-disabled={currentPage <= 1}
            tabIndex={currentPage <= 1 ? -1 : undefined}
          >
            <i className="ri-arrow-left-s-line" aria-hidden="true" /> Previous
          </Link>
          <div className="task-page-numbers">
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter(
                (page) =>
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - currentPage) <= 1,
              )
              .map((page, index, visiblePages) => (
                <span key={page} className="d-contents">
                  {index > 0 && page - visiblePages[index - 1] > 1 && (
                    <span className="task-page-ellipsis" aria-hidden="true">…</span>
                  )}
                  <Link
                    className={`btn ${page === currentPage ? "btn-primary" : "btn-outline-secondary"}`}
                    href={taskListHref(filters, { page: String(page) })}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </Link>
                </span>
              ))}
          </div>
          <Link
            className={`btn btn-outline-secondary${currentPage >= totalPages ? " disabled" : ""}`}
            href={taskListHref(filters, { page: String(Math.min(totalPages, currentPage + 1)) })}
            aria-disabled={currentPage >= totalPages}
            tabIndex={currentPage >= totalPages ? -1 : undefined}
          >
            Next <i className="ri-arrow-right-s-line" aria-hidden="true" />
          </Link>
        </nav>
      )}
    </main>
  );
}
