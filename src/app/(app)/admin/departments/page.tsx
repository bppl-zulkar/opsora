import Link from "next/link";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { createDepartment, deleteDepartment } from "./actions";
export default async function Departments({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const message = await searchParams;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const [{ data: departments }, { data: people }] = await Promise.all([
    admin
      .from("departments")
      .select(
        "id,name,code,official_email,office_location,active,head:profiles!departments_head_fkey(full_name)",
      )
      .eq("organization_id", organizationId)
      .order("name"),
    admin
      .from("profiles")
      .select("id,full_name")
      .eq("organization_id", organizationId)
      .eq("account_status", "active")
      .order("full_name"),
  ]);
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Departments</h1>
      <p className="text-secondary">
        Maintain structure, ownership and service expectations.
      </p>
      {message.success && (
        <div className="alert alert-success">{message.success}</div>
      )}
      {message.error && (
        <div className="alert alert-danger">{message.error}</div>
      )}
      <details className="panel p-4 mb-3">
        <summary className="fw-semibold">Create department</summary>
        <form action={createDepartment} className="row g-3 mt-2">
          <div className="col-md-6">
            <label className="form-label">Department name</label>
            <input name="name" className="form-control" required />
          </div>
          <div className="col-md-3">
            <label className="form-label">Code</label>
            <input name="code" className="form-control" required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Parent department</label>
            <select name="parent_id" className="form-select">
              <option value="">None</option>
              {(departments ?? []).map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Department head</label>
            <select name="head_id" className="form-select">
              <option value="">None</option>
              {(people ?? []).map((x) => (
                <option value={x.id} key={x.id}>
                  {x.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Official email</label>
            <input
              name="official_email"
              type="email"
              className="form-control"
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Office location</label>
            <input name="office_location" className="form-control" />
          </div>
          <div className="col-12">
            <button className="btn btn-primary">Create department</button>
          </div>
        </form>
      </details>
      <div className="panel table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Department</th>
              <th>Head</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(departments ?? []).map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.name}</strong>
                  <small className="d-block text-secondary">
                    {d.code} · {d.office_location ?? "No location"}
                  </small>
                </td>
                <td>
                  {(d.head as unknown as { full_name?: string })?.full_name ??
                    "—"}
                </td>
                <td>{d.official_email ?? "—"}</td>
                <td>{d.active ? "Active" : "Inactive"}</td>
                <td>
                  <div className="d-flex gap-1">
                    <Link
                      href={`/admin/departments/${d.id}/edit`}
                      className="btn btn-sm btn-outline-primary"
                    >
                      Edit
                    </Link>
                    <form action={deleteDepartment}>
                      <input type="hidden" name="id" value={d.id} />
                      <button className="btn btn-sm btn-outline-danger">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
