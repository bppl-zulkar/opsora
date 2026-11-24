import Link from "next/link";
import { requireOrganizationAdmin } from "@/lib/admin-context";
const modules = [
  ["Company users & admins", "ri-team-line", "/admin/users"],
  ["Departments", "ri-building-line", "/admin/departments"],
  ["Roles & permissions", "ri-shield-user-line", "/admin/roles"],
  ["Branding", "ri-palette-line", "/admin/branding"],
  ["SLA policies", "ri-timer-line", "/admin/sla"],
  ["Email & push configuration", "ri-broadcast-line", "/admin/configuration"],
  ["Audit logs", "ri-file-shield-line", "/admin/audit-logs"],
];
export default async function Admin() {
  await requireOrganizationAdmin();
  return (
    <main className="page">
      <h1 className="h3 fw-bold">Administration</h1>
      <p className="text-secondary">
        Configure your organization without source-code changes.
      </p>
      <div className="row g-3">
        {modules.map((m) => (
          <div className="col-md-6 col-xl-4" key={m[0]}>
            <Link href={m[2]} className="panel p-4 d-block text-dark h-100">
              <i className={`${m[1]} fs-2 text-primary`} />
              <h2 className="h5 mt-3">{m[0]}</h2>
              <span className="text-secondary">Manage settings and access</span>
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
