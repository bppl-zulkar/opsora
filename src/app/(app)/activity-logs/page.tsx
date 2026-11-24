import Link from "next/link";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { formatIST, formatWorkStatus } from "@/lib/format";
export default async function ActivityLogs() {
  const { client: s, userId, isAdmin } = await getTaskAccess();
  let visibleQuery = s
    .from("tasks")
    .select("id")
    .is("deleted_at", null)
    .limit(1000);
  if (!isAdmin) visibleQuery = visibleQuery.or(ownTaskFilter(userId));
  const { data: visibleTasks } = await visibleQuery;
  const visibleIds = (visibleTasks ?? []).map((task) => task.id);
  const { data: logs } = visibleIds.length
    ? await s
        .from("task_status_history")
        .select(
          "id,previous_status,new_status,remarks,created_at,task:tasks(id,reference,title),actor:profiles(full_name,employee_id)",
        )
        .in("task_id", visibleIds)
        .order("created_at", { ascending: false })
        .limit(250)
    : { data: [] };
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Activity timeline</h1>
      <p className="text-secondary">
        Recent task lifecycle events with accountable company users and server
        timestamps.
      </p>
      <div className="panel">
        <div className="activity-feed">
          {(logs ?? []).map((log) => {
            const task = log.task as unknown as {
              id?: string;
              reference?: string;
              title?: string;
            };
            const actor = log.actor as unknown as {
              full_name?: string;
              employee_id?: string;
            };
            return (
              <div className="activity-entry" key={log.id}>
                <div className="activity-icon">
                  <i className="ri-history-line" />
                </div>
                <div>
                  <strong>{actor?.full_name ?? "System"}</strong> changed{" "}
                  <Link href={`/tasks/${task?.id}`}>{task?.reference}</Link>{" "}
                  from{" "}
                  <span>
                    {log.previous_status
                      ? formatWorkStatus(log.previous_status)
                      : "created"}
                  </span>{" "}
                  to{" "}
                  <span className="status">
                    {formatWorkStatus(log.new_status)}
                  </span>
                  <small className="d-block text-secondary">
                    {task?.title} · {actor?.employee_id} ·{" "}
                    {formatIST(log.created_at)}
                  </small>
                  {log.remarks && <p className="mb-0 mt-1">{log.remarks}</p>}
                </div>
              </div>
            );
          })}
          {!logs?.length && (
            <div className="p-5 text-center text-secondary">
              No task activity recorded.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
