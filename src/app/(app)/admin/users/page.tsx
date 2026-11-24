import Link from "next/link";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { createEmployee, deactivateEmployee, deleteEmployee } from "./actions";
import { PasswordInput } from "@/components/password-input";
export default async function Users({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const message = await searchParams;
  const { admin, organizationId, actorId } = await requireOrganizationAdmin();
  const [
    { data: users },
    { data: departments },
    { data: designations },
    { data: roles },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id,employee_id,full_name,email,mobile,account_status,department:departments!profiles_department_id_fkey(name),designation:designations!profiles_designation_id_fkey(name)",
      )
      .eq("organization_id", organizationId)
      .order("full_name"),
    admin
      .from("departments")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name"),
    admin
      .from("designations")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name"),
    admin
      .from("roles")
      .select("id,name")
      .eq("organization_id", organizationId)
      .order("name"),
  ]);
  return (
    <main className="page">
      <div className="mb-4">
        <h1 className="h3 fw-bold">Company users and admins</h1>
        <p className="text-secondary">
          Create individual accounts and maintain organization profiles.
        </p>
      </div>
      {message.success && (
        <div className="alert alert-success">{message.success}</div>
      )}
      {message.error && (
        <div className="alert alert-danger">{message.error}</div>
      )}
      <details className="panel p-4 mb-3">
        <summary className="fw-semibold">Create company user</summary>
        <form action={createEmployee} className="row g-3 mt-2">
          <div className="col-md-4">
            <label className="form-label">Full name</label>
            <input name="full_name" className="form-control" required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Company User ID</label>
            <input name="employee_id" className="form-control" required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Email</label>
            <input
              name="email"
              type="email"
              className="form-control"
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Temporary password</label>
            <PasswordInput
              name="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Mobile</label>
            <input name="mobile" className="form-control" />
          </div>
          <div className="col-md-4">
            <label className="form-label">Joining date</label>
            <input name="joining_date" type="date" className="form-control" />
          </div>
          <div className="col-md-4">
            <label className="form-label">Department</label>
            <select name="department_id" className="form-select">
              <option value="">None</option>
              {(departments ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Designation</label>
            <select name="designation_id" className="form-select">
              <option value="">None</option>
              {(designations ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Reporting manager</label>
            <select name="reporting_manager_id" className="form-select">
              <option value="">None</option>
              {(users ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Account status</label>
            <select
              name="account_status"
              className="form-select"
              defaultValue="active"
            >
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Roles</label>
            <select name="role_ids" className="form-select" multiple>
              {(roles ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <button className="btn btn-primary">Create company user</button>
          </div>
        </form>
      </details>
      <div className="panel table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Company user</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.full_name}</strong>
                  <small className="d-block text-secondary">
                    {u.employee_id} · {u.email}
                  </small>
                </td>
                <td>
                  {(u.department as unknown as { name?: string })?.name ?? "—"}
                </td>
                <td>
                  {(u.designation as unknown as { name?: string })?.name ?? "—"}
                </td>
                <td>
                  <span className="status">{u.account_status}</span>
                </td>
                <td>
                  <div className="d-flex gap-1">
                    <Link
                      className="btn btn-sm btn-outline-primary"
                      href={`/admin/users/${u.id}/edit`}
                    >
                      Edit
                    </Link>
                    {u.id !== actorId && (
                      <>
                        <form action={deactivateEmployee}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="btn btn-sm btn-outline-warning">
                            Deactivate
                          </button>
                        </form>
                        <form action={deleteEmployee}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="btn btn-sm btn-outline-danger">
                            Delete
                          </button>
                        </form>
                      </>
                    )}
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
