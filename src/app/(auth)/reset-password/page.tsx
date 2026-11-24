import { updatePassword } from "./actions";
import { PasswordInput } from "@/components/password-input";
export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const p = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-art">
        <h1 className="display-5 fw-bold">Choose a strong password</h1>
      </section>
      <section className="auth-form">
        <form action={updatePassword} className="auth-card">
          <h1 className="h3 fw-bold">Reset password</h1>
          {p.error && <div className="alert alert-danger">{p.error}</div>}
          <label className="form-label">New password</label>
          <PasswordInput
            name="password"
            minLength={12}
            autoComplete="new-password"
            className="form-control form-control-lg mb-3"
            required
          />
          <label className="form-label">Confirm password</label>
          <PasswordInput
            name="confirm"
            minLength={12}
            autoComplete="new-password"
            className="form-control form-control-lg mb-3"
            required
          />
          <button className="btn btn-primary btn-lg w-100">
            Update password
          </button>
        </form>
      </section>
    </main>
  );
}
