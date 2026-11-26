import { updatePassword } from "./actions";
import { PasswordInput } from "@/components/password-input";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getRecoveryChallenge } from "@/lib/password-recovery";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const p = await searchParams;
  const [recovery, session] = await Promise.all([
    getRecoveryChallenge(),
    createClient(),
  ]);
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user && !recovery?.verified) redirect("/forgot-password");
  if (recovery && !recovery.verified) redirect("/forgot-password/verify");
  return (
    <main className="auth-page">
      <section className="auth-art">
        <h1 className="display-5 fw-bold">Choose a strong password</h1>
      </section>
      <section className="auth-form">
        <form action={updatePassword} className="auth-card">
          <h1 className="h3 fw-bold">Reset password</h1>
          <p className="text-secondary">
            Choose a new password with at least 12 characters.
          </p>
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
          <FormSubmitButton
            className="btn btn-primary btn-lg w-100"
            pendingLabel="Updating password…"
          >
            Update password
          </FormSubmitButton>
        </form>
      </section>
    </main>
  );
}
