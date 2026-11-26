import { login } from "./actions";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { createAdminClient } from "@/lib/supabase/admin";
import { FormSubmitButton } from "@/components/form-submit-button";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const p = await searchParams;
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id,name")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  let loginLogo: string | undefined;
  if (org) {
    const { data: b } = await admin
      .from("organization_branding")
      .select("assets")
      .eq("organization_id", org.id)
      .maybeSingle();
    const assets = (b?.assets ?? {}) as Record<string, string>;
    const path = assets.main_logo;
    if (path) {
      const { data } = await admin.storage
        .from("branding-assets")
        .createSignedUrl(path, 3600);
      loginLogo = data?.signedUrl;
    }
  }
  return (
    <main className="auth-page login-page">
      <section className="auth-art">
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />
        <div className="auth-art-copy">
          <span className="auth-eyebrow">Operations, beautifully organized</span>
          <h1>
            Clear work. Calm teams. Better outcomes.
          </h1>
          <p>
            Assign, execute, verify and report from one focused workspace built
            for everyday accountability.
          </p>
          <div className="auth-feature-row">
            <span><i className="ri-check-line" /> Live task visibility</span>
            <span><i className="ri-check-line" /> Evidence-led completion</span>
          </div>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <div className="login-brand mb-5">
            <Logo src={loginLogo} name={org?.name ?? "Company"} />
          </div>
          <span className="auth-kicker">Welcome to your workspace</span>
          <h2 className="fw-bold mt-2">Sign in to Opsora</h2>
          <p className="text-secondary mb-4">
            Sign in to your organization workspace.
          </p>
          {p.error && <div className="alert alert-danger">{p.error}</div>}
          {p.success && (
            <div className="alert alert-success">{p.success}</div>
          )}
          <form action={login}>
            <div className="mb-3">
              <label className="form-label">Email or employee ID</label>
              <input
                className="form-control form-control-lg"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder="name@company.com or employee ID"
                required
              />
            </div>
            <div className="mb-3">
              <div className="d-flex justify-content-between">
                <label className="form-label">Password</label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
              <PasswordInput
                className="form-control form-control-lg"
                name="password"
                autoComplete="current-password"
                required
              />
            </div>
            <FormSubmitButton
              className="btn btn-primary btn-lg w-100"
              pendingLabel="Signing in…"
            >
              Sign in securely
            </FormSubmitButton>
          </form>
          <p className="text-secondary small text-center mt-4">
            Access is invitation-only. Contact your company administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
