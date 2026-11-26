import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { changeOwnPassword, updateProfile } from "./actions";
import { formatIST } from "@/lib/format";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PasswordInput } from "@/components/password-input";

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
  const [{ data: organization }, { data: roleRows }] = await Promise.all([
    s.from("organizations").select("name").eq("id", profile.organization_id).maybeSingle(),
    s.from("user_roles").select("roles(name)").eq("user_id", user.id),
  ]);
  const edit = query.edit === "1";
  const preferences = (profile.notification_preferences ?? {}) as Record<
    string,
    unknown
  >;
  const selectedBackground = String(
    preferences.background_theme ?? "aurora",
  );
  const personal = (preferences.profile ?? {}) as Record<string, unknown>;
  const bio = String(personal.bio ?? "");
  const location = String(personal.location ?? "");
  const timezone = String(personal.timezone ?? "Asia/Kolkata");
  const language = String(personal.language ?? "English");
  const roles = (roleRows ?? [])
    .map((row) => (row.roles as unknown as { name?: string } | null)?.name)
    .filter(Boolean) as string[];
  const backgrounds = [
    ["none", "None"],
    ["aurora", "Aurora"],
    ["wave", "Wave"],
    ["mist", "Mist"],
    ["mesh", "Mesh"],
    ["dawn", "Dawn"],
    ["midnight", "Midnight"],
  ];
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
          <div className="profile-hero-actions">
            <Link href="/profile?edit=1" className="btn btn-light">
              <i className="ri-edit-line me-1" /> Edit profile
            </Link>
            <a href="#security" className="btn btn-profile-ghost">
              <i className="ri-lock-password-line me-1" /> Password
            </a>
          </div>
        )}
      </div>
      {query.success && (
        <div className="alert alert-success">{query.success}</div>
      )}
      {query.error && <div className="alert alert-danger">{query.error}</div>}
      {edit ? (
        <form action={updateProfile} className="profile-edit-layout">
          <section className="panel p-4 profile-form">
          <div className="profile-section-heading">
            <span className="profile-section-icon"><i className="ri-user-3-line" /></span>
            <div><h2>Personal information</h2><p>Update the details people use to identify and contact you.</p></div>
          </div>
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
            <div className="col-md-6">
              <label className="form-label">Location</label>
              <input className="form-control" name="location" maxLength={120} defaultValue={location} placeholder="City or office location" />
            </div>
            <div className="col-12">
              <label className="form-label">About me</label>
              <textarea className="form-control" name="bio" rows={4} maxLength={500} defaultValue={bio} placeholder="A short professional introduction" />
              <small className="form-text text-secondary">Up to 500 characters.</small>
            </div>
          </div>
          </section>

          <section className="panel p-4 profile-form">
            <div className="profile-section-heading">
              <span className="profile-section-icon"><i className="ri-global-line" /></span>
              <div><h2>Regional preferences</h2><p>Choose how dates and language context should be presented.</p></div>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Timezone</label>
                <select className="form-select" name="timezone" defaultValue={timezone}>
                  {["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Preferred language</label>
                <select className="form-select" name="language" defaultValue={language}>
                  {["English", "Hindi", "Kannada", "Tamil", "Telugu"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="panel p-4 profile-form">
            <div className="profile-section-heading">
              <span className="profile-section-icon"><i className="ri-notification-3-line" /></span>
              <div><h2>Notifications</h2><p>Control how Opsora sends updates to your account.</p></div>
            </div>
            <div className="profile-notification-grid">
              {[
                ["notify_in_app", "In-app notifications", "Updates inside your Opsora workspace", preferences.in_app !== false],
                ["notify_email", "Email notifications", "Task and workflow updates by email", preferences.email !== false],
                ["notify_push", "Push notifications", "Device alerts when your browser supports them", preferences.push !== false],
              ].map(([name, label, description, checked]) => (
                <label className="profile-notification-option" key={String(name)}>
                  <span><strong>{String(label)}</strong><small>{String(description)}</small></span>
                  <input className="form-check-input" type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} />
                </label>
              ))}
            </div>
          </section>

          <section className="panel p-4 profile-form">
            <div className="col-12">
              <div className="profile-background-setting">
                <div className="mb-3">
                  <h2 className="h5 mb-1">Background image</h2>
                  <p className="text-secondary mb-0">
                    Choose a lightweight abstract background for your own
                    workspace. It does not change other users’ screens.
                  </p>
                </div>
                <div className="background-picker" role="radiogroup">
                  {backgrounds.map(([value, label]) => (
                    <label className="background-option" key={value}>
                      <input
                        type="radio"
                        name="background_theme"
                        value={value}
                        defaultChecked={selectedBackground === value}
                      />
                      <span
                        className={`background-swatch workspace-bg-${value}`}
                        aria-hidden="true"
                      >
                        {value === "none" && <i className="ri-close-line" />}
                      </span>
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="profile-save-bar">
              <FormSubmitButton pendingLabel="Saving profile…">
                Save profile
              </FormSubmitButton>
              <Link href="/profile" className="btn btn-outline-secondary">
                Cancel
              </Link>
          </div>
        </form>
      ) : (
        <>
        {bio && <section className="panel profile-about-card"><span>About</span><p>{bio}</p></section>}
        <div className="profile-grid profile-details-grid">
          <section className="panel p-4">
            <div className="profile-section-heading compact"><span className="profile-section-icon"><i className="ri-user-settings-line" /></span><div><h2>Account information</h2><p>Your personal and account details.</p></div></div>
            <dl>
              <dt>Employee ID</dt>
              <dd>{profile.employee_id}</dd>
              <dt>Email</dt>
              <dd>{profile.email}</dd>
              <dt>Mobile</dt>
              <dd>{profile.mobile ?? "—"}</dd>
              <dt>Location</dt>
              <dd>{location || "—"}</dd>
              <dt>Account status</dt>
              <dd>
                <span className="status">{profile.account_status}</span>
              </dd>
            </dl>
          </section>
          <section className="panel p-4">
            <div className="profile-section-heading compact"><span className="profile-section-icon"><i className="ri-building-line" /></span><div><h2>Organization</h2><p>Company-controlled employment information.</p></div></div>
            <dl>
              <dt>Company</dt>
              <dd>{organization?.name ?? "—"}</dd>
              <dt>Department</dt>
              <dd>{profile.department?.name ?? "—"}</dd>
              <dt>Designation</dt>
              <dd>{profile.designation?.name ?? "—"}</dd>
              <dt>Reporting manager</dt>
              <dd>{profile.manager?.full_name ?? "—"}</dd>
              <dt>Joined</dt>
              <dd>{profile.joined_on ? formatIST(profile.joined_on) : "—"}</dd>
              <dt>Roles</dt>
              <dd>{roles.length ? roles.join(", ") : "Company User"}</dd>
            </dl>
          </section>
          <section className="panel p-4">
            <div className="profile-section-heading compact"><span className="profile-section-icon"><i className="ri-settings-3-line" /></span><div><h2>Preferences</h2><p>Your workspace and communication choices.</p></div></div>
            <dl>
              <dt>Language</dt><dd>{language}</dd>
              <dt>Timezone</dt><dd>{timezone}</dd>
              <dt>Workspace background</dt><dd className="text-capitalize">{selectedBackground}</dd>
              <dt>Notifications</dt><dd>{[preferences.in_app !== false && "In-app", preferences.email !== false && "Email", preferences.push !== false && "Push"].filter(Boolean).join(", ") || "Disabled"}</dd>
            </dl>
          </section>
        </div>
        <section className="panel p-4 profile-security-card" id="security">
          <div className="profile-section-heading">
            <span className="profile-section-icon"><i className="ri-shield-keyhole-line" /></span>
            <div><h2>Account security</h2><p>Choose a strong password with at least 12 characters.</p></div>
          </div>
          <form action={changeOwnPassword} className="profile-password-form">
            <div><label className="form-label">New password</label><PasswordInput name="password" minLength={12} autoComplete="new-password" required /></div>
            <div><label className="form-label">Confirm password</label><PasswordInput name="confirm" minLength={12} autoComplete="new-password" required /></div>
            <FormSubmitButton pendingLabel="Updating password…">Update password</FormSubmitButton>
          </form>
        </section>
        </>
      )}
    </main>
  );
}
