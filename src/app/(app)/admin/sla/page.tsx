import Link from "next/link";
import { requireOrganizationAdmin } from "@/lib/admin-context";
import { createSla, deleteSla } from "./actions";
export default async function Sla({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const m = await searchParams;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const { data: policies, error } = await admin
    .from("sla_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("priority");
  if (error)
    return (
      <main className="page">
        <div className="alert alert-warning">
          Apply migration 202611240007_governance_workflows.sql to enable SLA
          policies.
        </div>
      </main>
    );
  return (
    <main className="page">
      <h1 className="h3 fw-bold">SLA policies</h1>
      <p className="text-secondary">
        Define measurable response and completion expectations by priority.
      </p>
      {m.success && <div className="alert alert-success">{m.success}</div>}
      {m.error && <div className="alert alert-danger">{m.error}</div>}
      <details className="panel p-4 mb-3">
        <summary className="fw-semibold">Create SLA policy</summary>
        <form action={createSla} className="row g-3 mt-2">
          <div className="col-md-4">
            <label className="form-label">Policy name</label>
            <input name="name" className="form-control" required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Priority</label>
            <select name="priority" className="form-select">
              <option>normal</option>
              <option>low</option>
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
              defaultValue="75"
              className="form-control"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Response minutes</label>
            <input
              name="response_minutes"
              type="number"
              min="1"
              defaultValue="30"
              className="form-control"
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Resolution minutes</label>
            <input
              name="resolution_minutes"
              type="number"
              min="1"
              defaultValue="480"
              className="form-control"
            />
          </div>
          <div className="col-12">
            <label className="form-label">Description</label>
            <textarea name="description" className="form-control" rows={2} />
          </div>
          {[
            ["business_hours_only", "Use business hours"],
            ["evidence_required", "Require evidence"],
            ["approval_required", "Require approval"],
            ["is_default", "Default policy"],
          ].map(([n, l]) => (
            <div className="col-sm-3" key={n}>
              <label className="form-check">
                <input
                  name={n}
                  type="checkbox"
                  className="form-check-input"
                  defaultChecked={n !== "is_default"}
                />
                <span className="form-check-label">{l}</span>
              </label>
            </div>
          ))}
          <input type="hidden" name="active" value="on" />
          <div className="col-12">
            <button className="btn btn-primary">Create policy</button>
          </div>
        </form>
      </details>
      <div className="row g-3">
        {(policies ?? []).map((p) => (
          <div className="col-md-6 col-xl-4" key={p.id}>
            <section className="panel p-4 h-100">
              <div className="d-flex justify-content-between">
                <span
                  className={`status ${p.priority === "critical" || p.priority === "high" ? "priority-high" : ""}`}
                >
                  {p.priority}
                </span>
                {p.is_default && <span className="status">Default</span>}
              </div>
              <h2 className="h5 mt-3">{p.name}</h2>
              <p className="text-secondary">
                {p.description || "No description"}
              </p>
              <dl className="row small">
                <dt className="col-6">Response</dt>
                <dd className="col-6">{p.response_minutes} min</dd>
                <dt className="col-6">Resolution</dt>
                <dd className="col-6">{p.resolution_minutes} min</dd>
                <dt className="col-6">Warning</dt>
                <dd className="col-6">{p.warning_percent}%</dd>
              </dl>
              <div className="d-flex gap-2">
                <Link
                  href={`/admin/sla/${p.id}/edit`}
                  className="btn btn-sm btn-outline-primary"
                >
                  Edit
                </Link>
                <form action={deleteSla}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn-sm btn-outline-danger">
                    {p.active ? "Delete" : "Remove"}
                  </button>
                </form>
              </div>
            </section>
          </div>
        ))}
      </div>
    </main>
  );
}
