import { createTask } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { FormSubmitButton } from "@/components/form-submit-button";
export default async function NewTask() {
  const s = await createClient();
  const { data } = await s
    .from("profiles")
    .select("id,full_name,employee_id")
    .eq("account_status", "active")
    .order("full_name");
  const people = data ?? [];
  const { data: slaPolicies } = await s
    .from("sla_policies")
    .select(
      "id,name,priority,resolution_minutes,evidence_required,approval_required",
    )
    .eq("active", true)
    .order("name");
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Create task</h1>
      <p className="text-secondary">
        Assign clear work with ownership, evidence and verification rules.
      </p>
      <form action={createTask} className="panel p-4">
        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label">Task title</label>
            <input
              name="title"
              className="form-control"
              maxLength={180}
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Priority</label>
            <select name="priority" className="form-select">
              <option>normal</option>
              <option>high</option>
              <option>critical</option>
              <option>low</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Detailed instructions</label>
            <textarea
              name="description"
              className="form-control"
              rows={5}
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Primary assignee</label>
            <select name="assignee_id" className="form-select" required>
              <option value="">Select company user</option>
              {people.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.full_name} · {p.employee_id}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Timeline</label>
            <select name="hours" className="form-select" defaultValue="24">
              <option value="1">1 hour</option>
              <option value="4">4 hours</option>
              <option value="8">8 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
              <option value="168">7 days</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">SLA policy</label>
            <select name="sla_policy_id" className="form-select">
              <option value="">Use selected timeline</option>
              {(slaPolicies ?? []).map((policy) => (
                <option value={policy.id} key={policy.id}>
                  {policy.name} · {policy.resolution_minutes} minutes
                </option>
              ))}
            </select>
            <small className="text-secondary">
              An SLA overrides the manual timeline and required controls.
            </small>
          </div>
          <div className="col-md-3">
            <label className="form-label">Confidentiality</label>
            <select name="confidentiality" className="form-select">
              <option>internal</option>
              <option>confidential</option>
              <option>restricted</option>
            </select>
          </div>
          <div className="col-md-6 form-check ms-2">
            <input
              name="evidence_required"
              className="form-check-input"
              type="checkbox"
              defaultChecked
            />
            <label className="form-check-label">
              Completion evidence required
            </label>
          </div>
          <div className="col-12">
            <FormSubmitButton pendingLabel="Assigning task…">
              Assign task
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </main>
  );
}
