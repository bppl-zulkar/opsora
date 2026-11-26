import Link from "next/link";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { format } from "date-fns";
const columns = [
  { key: "assigned", label: "Assigned", statuses: ["assigned"] },
  {
    key: "wip",
    label: "Work in Progress",
    statuses: [
      "acknowledged",
      "accepted",
      "in_progress",
      "rework_required",
      "reopened",
    ],
  },
  { key: "on_hold", label: "On hold", statuses: ["on_hold"] },
  {
    key: "completed",
    label: "Completed",
    statuses: ["pending_verification", "completed", "closed"],
  },
];
export default async function Board() {
  const { client: s, userId, isAdmin } = await getTaskAccess();
  let query = s
    .from("tasks")
    .select(
      "id,reference,title,status,priority,current_deadline,owner:profiles!tasks_primary_owner_id_fkey(full_name)",
    )
    .is("deleted_at", null)
    .order("current_deadline")
    .limit(300);
  if (!isAdmin) query = query.or(ownTaskFilter(userId));
  const { data: tasks } = await query;
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1 className="h3 fw-bold">Task board</h1>
          <p className="text-secondary">
            Lifecycle workload grouped by current status.
          </p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary align-self-start">
          <i className="ri-add-line me-1" /> Create task
        </Link>
      </div>
      <div className="kanban-board">
        {columns.map((column) => {
          const items = (tasks ?? []).filter((t) =>
            column.statuses.includes(t.status),
          );
          return (
            <section className="kanban-column" key={column.key}>
              <header>
                <strong>{column.label}</strong>
                <span>{items.length}</span>
              </header>
              <div>
                {items.map((t) => (
                  <Link
                    href={`/tasks/${t.id}`}
                    className="kanban-card"
                    key={t.id}
                  >
                    <small>{t.reference}</small>
                    <strong>{t.title}</strong>
                    <span>
                      {(t.owner as unknown as { full_name?: string })
                        ?.full_name ?? "Unassigned"}
                    </span>
                    <footer>
                      <span className={`priority-${t.priority}`}>
                        {t.priority}
                      </span>
                      <time>
                        {format(new Date(t.current_deadline), "dd MMM")}
                      </time>
                    </footer>
                  </Link>
                ))}
                {!items.length && <div className="kanban-empty">No tasks</div>}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
