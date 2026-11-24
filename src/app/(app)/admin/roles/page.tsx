import Link from "next/link";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { createRole, deleteRole } from "./actions";
export default async function Roles({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const m = await searchParams;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const { data: roles } = await admin
    .from("roles")
    .select(
      "id,name,description,system_key,user_roles(count),role_permissions(count)",
    )
    .eq("organization_id", organizationId)
    .order("name");
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Roles and permissions</h1>
      <p className="text-secondary">
        Grant only the access needed for each operational responsibility.
      </p>
      {m.success && <div className="alert alert-success">{m.success}</div>}
      {m.error && <div className="alert alert-danger">{m.error}</div>}
      <form action={createRole} className="panel p-4 row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Role name</label>
          <input name="name" className="form-control" required />
        </div>
        <div className="col-md-6">
          <label className="form-label">Description</label>
          <input name="description" className="form-control" />
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button className="btn btn-primary w-100">Create role</button>
        </div>
      </form>
      <div className="panel table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th>Role</th>
              <th>Users</th>
              <th>Permissions</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(roles ?? []).map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <small className="d-block text-secondary">
                    {r.description || "No description"}
                  </small>
                </td>
                <td>{r.user_roles?.[0]?.count ?? 0}</td>
                <td>{r.role_permissions?.[0]?.count ?? 0}</td>
                <td>{r.system_key ? "System" : "Custom"}</td>
                <td>
                  <div className="d-flex gap-1">
                    <Link
                      href={`/admin/roles/${r.id}/edit`}
                      className="btn btn-sm btn-outline-primary"
                    >
                      Permission matrix
                    </Link>
                    {!r.system_key && (
                      <form action={deleteRole}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn btn-sm btn-outline-danger">
                          Delete
                        </button>
                      </form>
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
