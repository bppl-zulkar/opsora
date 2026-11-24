import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createOrganization } from "./actions";
import { FormSubmitButton } from "@/components/form-submit-button";
export default async function Organizations({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const messages = await searchParams;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await s
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();
  if (!p?.is_platform_admin) redirect("/unauthorized");
  const { data: organizations } = await s
    .from("organizations")
    .select("id,name,slug,task_prefix,active,created_at")
    .order("created_at", { ascending: false });
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Organizations</h1>
      <p className="text-secondary">
        Platform workspace for tenant provisioning.
      </p>
      {messages.success && (
        <div className="alert alert-success">Organization created.</div>
      )}
      {messages.error && (
        <div className="alert alert-danger">{messages.error}</div>
      )}
      <form action={createOrganization} className="panel p-4 mb-3">
        <div className="row g-3">
          <div className="col-md-5">
            <label className="form-label">Company name</label>
            <input name="name" className="form-control" required />
          </div>
          <div className="col-md-4">
            <label className="form-label">URL slug</label>
            <input
              name="slug"
              pattern="[a-z0-9-]+"
              className="form-control"
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Task prefix</label>
            <input
              name="task_prefix"
              pattern="[A-Z0-9]{2,10}"
              className="form-control"
              defaultValue="COPS"
              required
            />
          </div>
          <div className="col-12">
            <FormSubmitButton pendingLabel="Creating organization…">
              Create organization
            </FormSubmitButton>
          </div>
        </div>
      </form>
      <div className="panel table-responsive">
        <table className="table mb-0">
          <thead>
            <tr>
              <th>Company</th>
              <th>Slug</th>
              <th>Task prefix</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(organizations ?? []).map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.slug}</td>
                <td>{o.task_prefix}</td>
                <td>{o.active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
