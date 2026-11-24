import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";
import { formatIST } from "@/lib/format";

export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await s
    .from("profiles")
    .select(
      "*,department:departments!profiles_department_id_fkey(name),designation:designations!profiles_designation_id_fkey(name),manager:profiles!profiles_reporting_manager_id_fkey(full_name)",
    )
    .eq("id", user.id)
    .single();
  if (!profile)
    return (
      <main className="page">
        <div className="alert alert-danger">Profile is not configured.</div>
      </main>
    );
  const edit = query.edit === "1";
  return (
    <main className="page profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-lg">
          {profile.full_name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1>{profile.full_name}</h1>
          <p>
            {profile.designation?.name ?? "Company User"} ·{" "}
            {profile.department?.name ?? "No department"}
          </p>
        </div>
        {!edit && (
          <Link href="/profile?edit=1" className="btn btn-light ms-auto">
            <i className="ri-edit-line me-1" /> Edit profile
          </Link>
        )}
      </div>
      {query.success && (
        <div className="alert alert-success">{query.success}</div>
      )}
      {query.error && <div className="alert alert-danger">{query.error}</div>}
      {edit ? (
        <form action={updateProfile} className="panel p-4 profile-form">
          <h2 className="h5 mb-4">Edit personal information</h2>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Full name</label>
              <input
                className="form-control"
                name="full_name"
                defaultValue={profile.full_name}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Mobile number</label>
              <input
                className="form-control"
                name="mobile"
                defaultValue={profile.mobile ?? ""}
              />
            </div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-primary">Save profile</button>
              <Link href="/profile" className="btn btn-outline-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      ) : (
        <div className="profile-grid">
          <section className="panel p-4">
            <h2 className="h5">Account information</h2>
            <dl>
              <dt>Employee ID</dt>
              <dd>{profile.employee_id}</dd>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
              <dt>Mobile</dt>
              <dd>{profile.mobile ?? "—"}</dd>
              <dt>Account status</dt>
              <dd>
                <span className="status">{profile.account_status}</span>
              </dd>
            </dl>
          </section>
          <section className="panel p-4">
            <h2 className="h5">Organization</h2>
            <dl>
              <dt>Department</dt>
              <dd>{profile.department?.name ?? "—"}</dd>
              <dt>Designation</dt>
              <dd>{profile.designation?.name ?? "—"}</dd>
              <dt>Reporting manager</dt>
              <dd>{profile.manager?.full_name ?? "—"}</dd>
              <dt>Joined</dt>
              <dd>{profile.joined_on ? formatIST(profile.joined_on) : "—"}</dd>
            </dl>
          </section>
        </div>
      )}
    </main>
  );
}
