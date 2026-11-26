import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyResetOtp } from "../actions";
import { getRecoveryChallenge } from "@/lib/password-recovery";
import { FormSubmitButton } from "@/components/form-submit-button";

export default async function VerifyResetOtp({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const [params, challenge] = await Promise.all([
    searchParams,
    getRecoveryChallenge(),
  ]);
  if (!challenge) redirect("/forgot-password");
  if (challenge.verified) redirect("/reset-password");
  const maskedEmail = challenge.email.replace(
    /^(.{1,2}).*(@.*)$/,
    "$1••••$2",
  );
  return (
    <main className="auth-page">
      <section className="auth-art">
        <h1 className="display-5 fw-bold">Check your email</h1>
        <p className="lead opacity-75">
          Your one-time password is valid for 10 minutes and can be attempted
          up to five times.
        </p>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <h1 className="h3 fw-bold">Enter verification OTP</h1>
          <p className="text-secondary">
            A six-digit code was sent to {maskedEmail} for employee ID{" "}
            <strong>{challenge.employeeId}</strong>.
          </p>
          {params.sent && (
            <div className="alert alert-success">OTP sent successfully.</div>
          )}
          {params.error && (
            <div className="alert alert-danger">{params.error}</div>
          )}
          <form action={verifyResetOtp}>
            <label className="form-label">Six-digit OTP</label>
            <input
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
              className="form-control form-control-lg text-center mb-3"
              style={{ letterSpacing: "0.45rem", fontWeight: 700 }}
              autoFocus
              required
            />
            <FormSubmitButton
              className="btn btn-primary btn-lg w-100"
              pendingLabel="Verifying OTP…"
            >
              Verify OTP
            </FormSubmitButton>
          </form>
          <Link className="d-block text-center mt-3" href="/forgot-password">
            Request a new OTP
          </Link>
        </div>
      </section>
    </main>
  );
}
