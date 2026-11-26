import Link from "next/link";
import { requestReset } from "./actions";
import { FormSubmitButton } from "@/components/form-submit-button";
export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const p = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-art">
        <h1 className="display-5 fw-bold">Secure account recovery</h1>
        <p className="lead opacity-75">
          Verify your employee ID and registered email before changing your
          password.
        </p>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <h1 className="h3 fw-bold">Forgot password</h1>
          <p className="text-secondary">
            We will send a six-digit OTP to your registered email address.
          </p>
          {p.error && (
            <div className="alert alert-danger">
              {p.error}
            </div>
          )}
          <form action={requestReset}>
            <div className="mb-3">
              <label className="form-label">Employee ID</label>
              <input
                name="employee_id"
                className="form-control form-control-lg"
                autoComplete="username"
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Registered email address</label>
              <input
                name="email"
                type="email"
                className="form-control form-control-lg"
                autoComplete="email"
                required
              />
            </div>
            <FormSubmitButton
              className="btn btn-primary btn-lg w-100"
              pendingLabel="Sending OTP…"
            >
              Send verification OTP
            </FormSubmitButton>
          </form>
          <Link className="d-block text-center mt-3" href="/login">
            Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
