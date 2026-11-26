import { requireOrganizationAdmin } from "@/lib/admin-context";
import {
  saveCommunicationSettings,
  sendTestCommunicationEmail,
} from "./actions";
import { PasswordInput } from "@/components/password-input";
import { FormSubmitButton } from "@/components/form-submit-button";
export default async function Configuration({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const message = await searchParams;
  const { admin, organizationId } = await requireOrganizationAdmin();
  const { data: c } = await admin
    .from("organization_communication_settings")
    .select(
      "email_provider,email_from_name,email_from_address,email_reply_to,smtp_host,smtp_port,smtp_secure,smtp_user,email_enabled,vapid_public_key,vapid_subject,web_push_enabled",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Communication configuration</h1>
      <p className="text-secondary">
        Configure organization email and Web Push without editing environment
        files.
      </p>
      {message.success && (
        <div className="alert alert-success">
          {message.success === "test-email"
            ? "Test email sent successfully."
            : "Configuration saved securely."}
        </div>
      )}
      {message.error && (
        <div className="alert alert-danger">{message.error}</div>
      )}
      <form action={saveCommunicationSettings}>
        <section className="panel p-4 mb-3">
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
            <div>
              <h2 className="h5 mb-1">Gmail email notifications</h2>
              <p className="text-secondary mb-0">
                Use a Gmail App Password. Your normal Gmail password will not
                work and is never requested.
              </p>
            </div>
            <span className="status">smtp.gmail.com · TLS · 587</span>
          </div>
          <div className="row g-3">
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
              <label className="form-label">Gmail address</label>
              <input
                name="gmail_address"
                type="email"
                className="form-control"
                placeholder="youraccount@gmail.com"
                defaultValue={c?.smtp_user ?? c?.email_from_address ?? ""}
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
              <label className="form-label">
                Gmail App Password{" "}
                {c && (
                  <small className="text-secondary">
                    (leave blank to retain)
                  </small>
                )}
              </label>
              <PasswordInput
                name="gmail_app_password"
                autoComplete="new-password"
                className="form-control"
                placeholder="16-character app password"
              />
              <div className="form-text">
                Create it in Google Account → Security → 2-Step Verification →
                App passwords.
              </div>
            </div>
            <div className="col-md-6 d-flex align-items-end pb-2">
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
        <FormSubmitButton pendingLabel="Saving configuration…">
          Save encrypted configuration
        </FormSubmitButton>
      </form>
      <form action={sendTestCommunicationEmail} className="panel p-4 mt-3">
        <h2 className="h5">Send a test email</h2>
        <p className="text-secondary">
          Save and enable Gmail first, then confirm delivery to any address.
        </p>
        <div className="row g-3 align-items-end">
          <div className="col-md-8">
            <label className="form-label">Test recipient</label>
            <input
              name="recipient"
              type="email"
              className="form-control"
              placeholder="recipient@example.com"
              required
            />
          </div>
          <div className="col-md-4">
            <FormSubmitButton
              className="btn btn-outline-primary w-100"
              pendingLabel="Sending test…"
            >
              Send test email
            </FormSubmitButton>
          </div>
        </div>
      </form>
    </main>
  );
}
