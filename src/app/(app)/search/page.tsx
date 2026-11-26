import Link from "next/link";
import { getTaskAccess, ownTaskFilter } from "@/lib/task-access";
import { formatIST, formatWorkStatus } from "@/lib/format";
import { ReportDownloadButton } from "@/components/report-download-button";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQuery = "" } = await searchParams;
  const query = rawQuery.trim().slice(0, 100);
  const safeQuery = query.replace(/[,%()]/g, " ").replace(/\s+/g, " ");
  const { client, userId, isAdmin } = await getTaskAccess();

  let tasks: {
    id: string;
    reference: string;
    title: string;
    status: string;
    priority: string;
    current_deadline: string;
  }[] = [];
  let users: {
    id: string;
    full_name: string;
    employee_id: string;
    email: string;
    account_status: string;
  }[] = [];

  if (safeQuery.length >= 2) {
    let taskQuery = client
      .from("tasks")
      .select("id,reference,title,status,priority,current_deadline")
      .is("deleted_at", null)
      .or(`title.ilike.%${safeQuery}%,reference.ilike.%${safeQuery}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!isAdmin) taskQuery = taskQuery.or(ownTaskFilter(userId));

    const [taskResult, userResult] = await Promise.all([
      taskQuery,
      client
        .from("profiles")
        .select("id,full_name,employee_id,email,account_status")
        .is("deleted_at", null)
        .or(
          `full_name.ilike.%${safeQuery}%,employee_id.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`,
        )
        .order("full_name")
        .limit(20),
    ]);
    tasks = taskResult.data ?? [];
    users = userResult.data ?? [];
  }

  const totalResults = tasks.length + users.length;

  return (
    <main className="page global-search-page">
      <div className="page-heading">
        <div>
          <span className="dashboard-card-kicker">Workspace search</span>
          <h1 className="h3 fw-bold">Search results</h1>
          <p className="text-secondary">
            {query.length >= 2
              ? `${totalResults} result${totalResults === 1 ? "" : "s"} for “${query}”`
              : "Enter at least two characters to search your authorized workspace."}
          </p>
        </div>
      </div>

      <form action="/search" method="get" className="panel search-page-form">
        <i className="ri-search-line" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          minLength={2}
          maxLength={100}
          placeholder="Search tasks, company users and reports"
          aria-label="Search workspace"
          required
          autoFocus
        />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {query.length >= 2 && (
        <div className="search-results-grid">
          <section className="panel search-result-section">
            <header>
              <span className="search-result-icon"><i className="ri-task-line" /></span>
              <div><h2>Tasks</h2><small>{tasks.length} matches</small></div>
            </header>
            <div className="search-result-list">
              {tasks.map((task) => (
                <Link href={`/tasks/${task.id}`} className="search-result-item" key={task.id}>
                  <div>
                    <span>{task.reference}</span>
                    <strong>{task.title}</strong>
                    <small>{formatIST(task.current_deadline)}</small>
                  </div>
                  <span className="status">{formatWorkStatus(task.status)}</span>
                </Link>
              ))}
              {!tasks.length && <div className="search-empty">No matching tasks.</div>}
            </div>
          </section>

          <section className="panel search-result-section">
            <header>
              <span className="search-result-icon"><i className="ri-team-line" /></span>
              <div><h2>Company users</h2><small>{users.length} matches</small></div>
            </header>
            <div className="search-result-list">
              {users.map((user) => (
                <Link
                  href={
                    isAdmin
                      ? `/admin/users/${user.id}/edit`
                      : user.id === userId
                        ? "/profile"
                        : `/search?q=${encodeURIComponent(user.full_name)}`
                  }
                  className="search-result-item"
                  key={user.id}
                  aria-label={
                    isAdmin || user.id === userId
                      ? `Open ${user.full_name}`
                      : `${user.full_name} company user result`
                  }
                >
                  <div>
                    <strong>{user.full_name}</strong>
                    <span>{user.employee_id}</span>
                    <small>{user.email}</small>
                  </div>
                  <span className={`status user-status-${user.account_status}`}>{user.account_status}</span>
                </Link>
              ))}
              {!users.length && <div className="search-empty">No matching company users.</div>}
            </div>
          </section>

          <section className="panel search-result-section search-report-section">
            <header>
              <span className="search-result-icon"><i className="ri-file-chart-line" /></span>
              <div><h2>Reports</h2><small>{tasks.length} available</small></div>
            </header>
            <div className="search-result-list">
              {tasks.map((task) => (
                <div className="search-result-item" key={task.id}>
                  <div><span>{task.reference}</span><strong>{task.title}</strong></div>
                  <div className="search-report-actions">
                    <ReportDownloadButton href={`/api/reports/tasks/${task.id}?format=pdf`} className="btn btn-sm btn-outline-primary">PDF</ReportDownloadButton>
                    <ReportDownloadButton href={`/api/reports/tasks/${task.id}?format=xlsx`} className="btn btn-sm btn-outline-secondary">Excel</ReportDownloadButton>
                  </div>
                </div>
              ))}
              {!tasks.length && <div className="search-empty">No matching reports.</div>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
