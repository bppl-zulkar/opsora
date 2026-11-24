import { notFound } from "next/navigation";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { updateSla } from "../../actions";
export default async function EditSla({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const { data: p } = await admin
    .from("sla_policies")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!p) notFound();
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Edit SLA policy</h1>
      <form action={updateSla} className="panel p-4 row g-3">
        <input type="hidden" name="id" value={id} />
        <div className="col-md-4">
          <label className="form-label">Policy name</label>
          <input
            name="name"
            className="form-control"
            defaultValue={p.name}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Priority</label>
          <select
            name="priority"
            className="form-select"
            defaultValue={p.priority}
          >
            <option>low</option>
            <option>normal</option>
            <option>high</option>
            <option>critical</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Warning at %</label>
          <input
            name="warning_percent"
            type="number"
            min="1"
            max="99"
            className="form-control"
            defaultValue={p.warning_percent}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Response minutes</label>
          <input
            name="response_minutes"
            type="number"
            min="1"
            className="form-control"
            defaultValue={p.response_minutes}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Resolution minutes</label>
          <input
            name="resolution_minutes"
            type="number"
            min="1"
            className="form-control"
            defaultValue={p.resolution_minutes}
          />
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea
            name="description"
            className="form-control"
            rows={3}
            defaultValue={p.description ?? ""}
          />
        </div>
        {[
          ["business_hours_only", "Use business hours", p.business_hours_only],
          ["evidence_required", "Require evidence", p.evidence_required],
          ["approval_required", "Require approval", p.approval_required],
          ["is_default", "Default policy", p.is_default],
          ["active", "Active", p.active],
        ].map(([n, l, v]) => (
          <div className="col-sm" key={String(n)}>
            <label className="form-check">
              <input
                name={String(n)}
                type="checkbox"
                className="form-check-input"
                defaultChecked={Boolean(v)}
              />
              <span className="form-check-label">{String(l)}</span>
            </label>
          </div>
        ))}
        <div className="col-12">
          <button className="btn btn-primary">Save SLA policy</button>
        </div>
      </form>
    </main>
  );
}
