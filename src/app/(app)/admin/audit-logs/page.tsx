import { requireOrganizationAdmin } from "@/lib/admin-context";
import { formatIST } from "@/lib/format";
export default async function AuditLogs({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const filters = await searchParams;
  const { admin, organizationId } = await requireOrganizationAdmin();
  let query = admin
    .from("audit_logs")
    .select(
      "id,action,entity_type,entity_id,reason,previous_value,new_value,correlation_id,created_at,actor:profiles(full_name,employee_id)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(250);
  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.entity) query = query.eq("entity_type", filters.entity);
  if (filters.from)
    query = query.gte("created_at", `${filters.from}T00:00:00+05:30`);
  if (filters.to)
    query = query.lte("created_at", `${filters.to}T23:59:59+05:30`);
  const { data: logs } = await query;
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Audit logs</h1>
      <p className="text-secondary">
        Append-only accountability records for security and administrative
        review.
      </p>
      <form className="panel p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <input
              name="action"
              className="form-control"
              placeholder="Action contains…"
              defaultValue={filters.action}
            />
          </div>
          <div className="col-md-3">
            <input
              name="entity"
              className="form-control"
              placeholder="Entity type"
              defaultValue={filters.entity}
            />
          </div>
          <div className="col-md-2">
            <input
              name="from"
              type="date"
              className="form-control"
              defaultValue={filters.from}
            />
          </div>
          <div className="col-md-2">
            <input
              name="to"
              type="date"
              className="form-control"
              defaultValue={filters.to}
            />
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary w-100">Apply filters</button>
          </div>
        </div>
      </form>
      <div className="panel table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Change</th>
              <th>Correlation</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => {
              const actor = log.actor as unknown as {
                full_name?: string;
                employee_id?: string;
              };
              return (
                <tr key={log.id}>
                  <td data-label="Timestamp" className="text-nowrap">{formatIST(log.created_at)}</td>
                  <td data-label="Actor">
                    {actor?.full_name ?? "System"}
                    <small className="d-block text-secondary">
                      {actor?.employee_id}
                    </small>
                  </td>
                  <td data-label="Action">
                    <span className="status">{log.action}</span>
                  </td>
                  <td data-label="Entity">
                    {log.entity_type}
                    <small className="d-block text-secondary">
                      {log.entity_id}
                    </small>
                  </td>
                  <td data-label="Change">
                    <details>
                      <summary>View change</summary>
                      <pre className="audit-json">
                        {JSON.stringify(
                          {
                            before: log.previous_value,
                            after: log.new_value,
                            reason: log.reason,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                  <td data-label="Correlation">
                    <code>{String(log.correlation_id).slice(0, 8)}</code>
                  </td>
                </tr>
              );
            })}
            {!logs?.length && (
              <tr>
                <td colSpan={6} className="text-center text-secondary py-5">
                  No audit records match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
