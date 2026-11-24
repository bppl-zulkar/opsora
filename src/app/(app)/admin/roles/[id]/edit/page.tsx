import { notFound } from "next/navigation";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { updateRole } from "../../actions";
import { FormSubmitButton } from "@/components/form-submit-button";
export default async function EditRole({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const [{ data: role }, { data: permissions }, { data: assigned }] =
    await Promise.all([
      admin
        .from("roles")
        .select("*")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single(),
      admin.from("permissions").select("id,key,description").order("key"),
      admin.from("role_permissions").select("permission_id").eq("role_id", id),
    ]);
  if (!role) notFound();
  const selected = new Set((assigned ?? []).map((x) => x.permission_id));
  const groups = Object.groupBy(permissions ?? [], (p) => p.key.split(".")[0]);
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Permission matrix</h1>
      <p className="text-secondary">
        Changes take effect immediately for every user holding this role.
      </p>
      <form action={updateRole}>
        <input type="hidden" name="id" value={id} />
        <section className="panel p-4 mb-3">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Role name</label>
              <input
                name="name"
                className="form-control"
                defaultValue={role.name}
                readOnly={Boolean(role.system_key)}
                required
              />
            </div>
            <div className="col-md-8">
              <label className="form-label">Description</label>
              <input
                name="description"
                className="form-control"
                defaultValue={role.description ?? ""}
              />
            </div>
          </div>
        </section>
        <div className="row g-3">
          {Object.entries(groups).map(([group, items]) => (
            <div className="col-lg-6" key={group}>
              <section className="panel p-4 h-100">
                <h2 className="h6 text-uppercase">{group}</h2>
                {items?.map((p) => (
                  <label className="permission-row" key={p.id}>
                    <input
                      type="checkbox"
                      name="permission_ids"
                      value={p.id}
                      defaultChecked={selected.has(p.id)}
                      className="form-check-input"
                    />
                    <span>
                      <strong>{p.description}</strong>
                      <small className="d-block text-secondary">{p.key}</small>
                    </span>
                  </label>
                ))}
              </section>
            </div>
          ))}
        </div>
        <FormSubmitButton
          className="btn btn-primary mt-3"
          pendingLabel="Saving permissions…"
        >
          Save permission matrix
        </FormSubmitButton>
      </form>
    </main>
  );
}
