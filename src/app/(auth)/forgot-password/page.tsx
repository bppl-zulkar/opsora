import Link from "next/link";
import { requestReset } from "./actions";
export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const p = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-art">
        <h1 className="display-5 fw-bold">Secure account recovery</h1>
        <p className="lead opacity-75">
          Reset links are time-limited and delivered only to registered company
          users.
        </p>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <h1 className="h3 fw-bold">Forgot password</h1>
          <p className="text-secondary">Enter your company email address.</p>
          {p.sent && (
            <div className="alert alert-success">
              If the account exists, a reset link has been sent.
            </div>
          )}
          {p.error && (
            <div className="alert alert-danger">
              Unable to request a reset. Please try again.
            </div>
          )}
          <form action={requestReset}>
            <label className="form-label">Email address</label>
            <input
              name="email"
              type="email"
              className="form-control form-control-lg mb-3"
              required
            />
            <button className="btn btn-primary btn-lg w-100">
              Send reset link
            </button>
          </form>
          <Link className="d-block text-center mt-3" href="/login">
            Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
