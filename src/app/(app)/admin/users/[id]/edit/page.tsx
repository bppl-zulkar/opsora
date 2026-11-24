import { notFound } from "next/navigation";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { PasswordInput } from "@/components/password-input";
import { updateEmployee } from "../../actions";
export default async function EditUser({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const [
    { data: u },
    { data: departments },
    { data: designations },
    { data: managers },
    { data: roles },
    { data: assigned },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single(),
    admin
      .from("departments")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("active", true),
    admin
      .from("designations")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("active", true),
    admin
      .from("profiles")
      .select("id,full_name")
      .eq("organization_id", organizationId)
      .eq("account_status", "active")
      .neq("id", id),
    admin.from("roles").select("id,name").eq("organization_id", organizationId),
    admin
      .from("user_roles")
      .select("role_id")
      .eq("organization_id", organizationId)
      .eq("user_id", id),
  ]);
  if (!u) notFound();
  const selected = new Set((assigned ?? []).map((x) => x.role_id));
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Edit company user</h1>
      <form action={updateEmployee} className="panel p-4 row g-3">
        <input type="hidden" name="id" value={id} />
        <div className="col-md-4">
          <label className="form-label">Full name</label>
          <input
            name="full_name"
            className="form-control"
            defaultValue={u.full_name}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Company User ID</label>
          <input
            name="employee_id"
            className="form-control"
            defaultValue={u.employee_id ?? ""}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Email</label>
          <input
            name="email"
            type="email"
            className="form-control"
            defaultValue={u.email}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">
            New password <small className="text-secondary">(optional)</small>
          </label>
          <PasswordInput
            name="password"
            minLength={12}
            autoComplete="new-password"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Mobile</label>
          <input
            name="mobile"
            className="form-control"
            defaultValue={u.mobile ?? ""}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Joining date</label>
          <input
            name="joining_date"
            type="date"
            className="form-control"
            defaultValue={u.joined_on ?? ""}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Department</label>
          <select
            name="department_id"
            className="form-select"
            defaultValue={u.department_id ?? ""}
          >
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
          <select
            name="designation_id"
            className="form-select"
            defaultValue={u.designation_id ?? ""}
          >
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
          <select
            name="reporting_manager_id"
            className="form-select"
            defaultValue={u.reporting_manager_id ?? ""}
          >
            <option value="">None</option>
            {(managers ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Status</label>
          <select
            name="account_status"
            className="form-select"
            defaultValue={u.account_status}
          >
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Roles</label>
          <select
            name="role_ids"
            className="form-select"
            multiple
            defaultValue={[...selected]}
          >
            {(roles ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <button className="btn btn-primary">Save company user</button>
        </div>
      </form>
    </main>
  );
}
