import { changePassword } from "./actions";
import { PasswordInput } from "@/components/password-input";
export default function ChangePassword() {
  return (
    <main className="page">
      <div className="panel p-4 mx-auto" style={{ maxWidth: 560 }}>
        <h1 className="h3 fw-bold">Change password</h1>
        <p className="text-secondary">
          A new password is required before continuing.
        </p>
        <form action={changePassword}>
          <label className="form-label">New password</label>
          <PasswordInput
            name="password"
            minLength={12}
            autoComplete="new-password"
            className="form-control mb-3"
            required
          />
          <label className="form-label">Confirm password</label>
          <PasswordInput
            name="confirm"
            minLength={12}
            autoComplete="new-password"
            className="form-control mb-3"
            required
          />
          <button className="btn btn-primary">Save password</button>
        </form>
      </div>
    </main>
  );
}
