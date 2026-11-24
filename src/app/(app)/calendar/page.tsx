import Link from "next/link";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { formatIST, formatWorkStatus } from "@/lib/format";
type Search = { month?: string; status?: string; assignee?: string };
export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const filters = await searchParams;
  const parsed = filters.month
    ? parse(filters.month, "yyyy-MM", new Date())
    : new Date();
  const month = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const previous = format(subMonths(month, 1), "yyyy-MM"),
    next = format(addMonths(month, 1), "yyyy-MM"),
    current = format(month, "yyyy-MM");
  const { client: s, userId, isAdmin } = await getTaskAccess();
  let query = s
    .from("tasks")
    .select(
      "id,reference,title,status,priority,current_deadline,primary_owner_id,owner:profiles!tasks_primary_owner_id_fkey(full_name)",
    )
    .gte("current_deadline", gridStart.toISOString())
    .lte("current_deadline", gridEnd.toISOString())
    .is("deleted_at", null)
    .order("current_deadline");
  if (!isAdmin) query = query.or(ownTaskFilter(userId));
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.assignee) query = query.eq("primary_owner_id", filters.assignee);
  const [{ data: tasks }, { data: people }] = await Promise.all([
    query,
    s
      .from("profiles")
      .select("id,full_name")
      .eq("account_status", "active")
      .order("full_name"),
  ]);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const byDay = new Map<string, NonNullable<typeof tasks>>();
  for (const task of tasks ?? []) {
    const key = format(new Date(task.current_deadline), "yyyy-MM-dd");
    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }
  const params = (value: string) => {
    const q = new URLSearchParams();
    q.set("month", value);
    if (filters.status) q.set("status", filters.status);
    if (filters.assignee) q.set("assignee", filters.assignee);
    return `/calendar?${q}`;
  };
  return (
    <main className="page">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold">Task calendar</h1>
          <p className="text-secondary mb-0">
            Deadlines and scheduled work from your authorized task workspace.
          </p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary">
          <i className="ri-add-line me-1" />
          Create task
        </Link>
      </div>
      <section className="panel p-3 mb-3">
        <div className="calendar-toolbar">
          <div className="btn-group">
            <Link
              className="btn btn-outline-secondary"
              href={params(previous)}
              aria-label="Previous month"
            >
              <i className="ri-arrow-left-s-line" />
            </Link>
            <Link className="btn btn-outline-secondary" href="/calendar">
              Today
            </Link>
            <Link
              className="btn btn-outline-secondary"
              href={params(next)}
              aria-label="Next month"
            >
              <i className="ri-arrow-right-s-line" />
            </Link>
          </div>
          <h2 className="h4 mb-0">{format(month, "MMMM yyyy")}</h2>
          <form className="d-flex flex-wrap gap-2">
            <input type="hidden" name="month" value={current} />
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
                "scheduled",
                "in_progress",
                "on_hold",
                "blocked",
                "pending_information",
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
            <select
              name="assignee"
              className="form-select"
              defaultValue={filters.assignee ?? ""}
            >
              <option value="">All company users</option>
              {(people ?? []).map((p) => (
                <option value={p.id} key={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <button className="btn btn-outline-primary">Filter</button>
          </form>
        </div>
      </section>
      <section className="calendar-grid panel">
        <div className="calendar-weekdays">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => (
            <div key={x}>{x}</div>
          ))}
        </div>
        <div className="calendar-days">
          {days.map((day) => {
            const dayTasks = byDay.get(format(day, "yyyy-MM-dd")) ?? [];
            return (
              <div
                className={`calendar-day ${!isSameMonth(day, month) ? "outside" : ""} ${isToday(day) ? "today" : ""}`}
                key={day.toISOString()}
              >
                <div className="calendar-date">{format(day, "d")}</div>
                <div className="calendar-events">
                  {dayTasks.slice(0, 4).map((task) => {
                    const overdue =
                      new Date(task.current_deadline) < new Date() &&
                      !["closed", "completed", "cancelled"].includes(
                        task.status,
                      );
                    return (
                      <Link
                        href={`/tasks/${task.id}`}
                        className={`calendar-event priority-${task.priority} ${overdue ? "overdue" : ""}`}
                        key={task.id}
                        title={`${task.reference} · ${task.title}`}
                      >
                        <span>
                          {format(new Date(task.current_deadline), "h:mm a")}
                        </span>
                        <strong>{task.title}</strong>
                      </Link>
                    );
                  })}
                  {dayTasks.length > 4 && (
                    <span className="calendar-more">
                      +{dayTasks.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="calendar-agenda panel mt-3">
        <div className="p-3 border-bottom">
          <h2 className="h5 mb-0">Monthly agenda</h2>
        </div>
        {(tasks ?? []).map((task) => (
          <Link
            href={`/tasks/${task.id}`}
            className="agenda-item"
            key={task.id}
          >
            <div className="agenda-date">
              <strong>{format(new Date(task.current_deadline), "dd")}</strong>
              <span>{format(new Date(task.current_deadline), "MMM")}</span>
            </div>
            <div className="flex-grow-1">
              <strong>{task.title}</strong>
              <small className="d-block text-secondary">
                {task.reference} ·{" "}
                {(task.owner as unknown as { full_name?: string })?.full_name ??
                  "Unassigned"}{" "}
                · {formatIST(task.current_deadline)}
              </small>
            </div>
            <span className="status">{formatWorkStatus(task.status)}</span>
          </Link>
        ))}
        {!tasks?.length && (
          <div className="p-5 text-center text-secondary">
            No tasks match this month and filter.
          </div>
        )}
      </section>
    </main>
  );
}
