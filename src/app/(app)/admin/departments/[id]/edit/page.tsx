import { notFound } from "next/navigation";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { updateDepartment } from "../../actions";
export default async function EditDepartment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const [{ data: d }, { data: departments }, { data: people }] =
    await Promise.all([
      admin
        .from("departments")
        .select("*")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single(),
      admin
        .from("departments")
        .select("id,name")
        .eq("organization_id", organizationId)
        .neq("id", id)
        .eq("active", true),
      admin
        .from("profiles")
        .select("id,full_name")
        .eq("organization_id", organizationId)
        .eq("account_status", "active"),
    ]);
  if (!d) notFound();
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Edit department</h1>
      <form action={updateDepartment} className="panel p-4 row g-3">
        <input type="hidden" name="id" value={id} />
        <div className="col-md-6">
          <label className="form-label">Department name</label>
          <input
            name="name"
            className="form-control"
            defaultValue={d.name}
            required
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Code</label>
          <input
            name="code"
            className="form-control"
            defaultValue={d.code}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Parent department</label>
          <select
            name="parent_id"
            className="form-select"
            defaultValue={d.parent_id ?? ""}
          >
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
          <select
            name="head_id"
            className="form-select"
            defaultValue={d.head_id ?? ""}
          >
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
            defaultValue={d.official_email ?? ""}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Office location</label>
          <input
            name="office_location"
            className="form-control"
            defaultValue={d.office_location ?? ""}
          />
        </div>
        <div className="col-md-4 d-flex align-items-end pb-2">
          <div className="form-check">
            <input
              name="active"
              type="checkbox"
              className="form-check-input"
              defaultChecked={d.active}
            />
            <label className="form-check-label">Active</label>
          </div>
        </div>
        <div className="col-12">
          <button className="btn btn-primary">Save department</button>
        </div>
      </form>
    </main>
  );
}
