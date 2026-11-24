import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { saveCommunicationSettings } from "./actions";
import { PasswordInput } from "@/components/password-input";
export default async function Configuration({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const message = await searchParams;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await s
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!p?.organization_id)
    return (
      <main className="page">
        <div className="alert alert-warning">
          Assign the platform administrator to an organization or sign in as a
          Company Admin to configure organization communication.
        </div>
      </main>
    );
  const { data: c } = await s
    .from("organization_communication_settings")
    .select(
      "email_provider,email_from_name,email_from_address,email_reply_to,smtp_host,smtp_port,smtp_secure,smtp_user,email_enabled,vapid_public_key,vapid_subject,web_push_enabled",
    )
    .eq("organization_id", p.organization_id)
    .maybeSingle();
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Communication configuration</h1>
      <p className="text-secondary">
        Configure organization email and Web Push without editing environment
        files.
      </p>
      {message.success && (
        <div className="alert alert-success">Configuration saved securely.</div>
      )}
      {message.error && (
        <div className="alert alert-danger">{message.error}</div>
      )}
      <form action={saveCommunicationSettings}>
        <section className="panel p-4 mb-3">
          <h2 className="h5">Email provider</h2>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Provider</label>
              <select
                name="email_provider"
                className="form-select"
                defaultValue={c?.email_provider ?? "resend"}
              >
                <option value="resend">Resend</option>
                <option value="smtp">SMTP</option>
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label">
                Resend API key{" "}
                {c && (
                  <small className="text-secondary">
                    (leave blank to retain)
                  </small>
                )}
              </label>
              <PasswordInput
                name="resend_api_key"
                autoComplete="new-password"
                className="form-control"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">From name</label>
              <input
                name="email_from_name"
                className="form-control"
                defaultValue={c?.email_from_name ?? "Opsora"}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">From address</label>
              <input
                name="email_from_address"
                type="email"
                className="form-control"
                defaultValue={c?.email_from_address ?? ""}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Reply-to</label>
              <input
                name="email_reply_to"
                type="email"
                className="form-control"
                defaultValue={c?.email_reply_to ?? ""}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">SMTP host</label>
              <input
                name="smtp_host"
                className="form-control"
                defaultValue={c?.smtp_host ?? ""}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Port</label>
              <input
                name="smtp_port"
                type="number"
                className="form-control"
                defaultValue={c?.smtp_port ?? 587}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">SMTP user</label>
              <input
                name="smtp_user"
                className="form-control"
                defaultValue={c?.smtp_user ?? ""}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">
                SMTP password{" "}
                {c && (
                  <small className="text-secondary">
                    (leave blank to retain)
                  </small>
                )}
              </label>
              <PasswordInput
                name="smtp_password"
                autoComplete="new-password"
                className="form-control"
              />
            </div>
            <div className="col-md-3 d-flex align-items-end pb-2">
              <div className="form-check">
                <input
                  name="smtp_secure"
                  type="checkbox"
                  className="form-check-input"
                  defaultChecked={c?.smtp_secure ?? false}
                />
                <label className="form-check-label">Implicit TLS</label>
              </div>
            </div>
            <div className="col-md-3 d-flex align-items-end pb-2">
              <div className="form-check">
                <input
                  name="email_enabled"
                  type="checkbox"
                  className="form-check-input"
                  defaultChecked={c?.email_enabled ?? false}
                />
                <label className="form-check-label">Enable email</label>
              </div>
            </div>
          </div>
        </section>
        <section className="panel p-4 mb-3">
          <h2 className="h5">Web Push / VAPID</h2>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">VAPID public key</label>
              <textarea
                name="vapid_public_key"
                className="form-control"
                rows={2}
                defaultValue={c?.vapid_public_key ?? ""}
              />
            </div>
            <div className="col-md-7">
              <label className="form-label">
                VAPID private key{" "}
                {c && (
                  <small className="text-secondary">
                    (leave blank to retain)
                  </small>
                )}
              </label>
              <PasswordInput
                name="vapid_private_key"
                autoComplete="new-password"
                className="form-control"
              />
            </div>
            <div className="col-md-5">
              <label className="form-label">VAPID subject</label>
              <input
                name="vapid_subject"
                className="form-control"
                defaultValue={c?.vapid_subject ?? "mailto:admin@example.com"}
              />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input
                  name="web_push_enabled"
                  type="checkbox"
                  className="form-check-input"
                  defaultChecked={c?.web_push_enabled ?? false}
                />
                <label className="form-check-label">Enable Web Push</label>
              </div>
            </div>
          </div>
        </section>
        <button className="btn btn-primary">
          Save encrypted configuration
        </button>
      </form>
    </main>
  );
}
