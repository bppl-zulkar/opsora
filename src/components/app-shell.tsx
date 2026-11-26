import Link from "next/link";
import { Logo } from "./logo";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { MobileSidebarToggle } from "./mobile-sidebar-toggle";
import { ThemeControls } from "./theme-controls";
import { AccountMenu } from "./account-menu";
import { PushSubscriptionSync } from "./push-subscription-sync";
const nav = [
  ["/dashboard", "ri-dashboard-2-line", "Dashboard"],
  ["/tasks", "ri-task-line", "Tasks"],
  ["/board", "ri-layout-grid-line", "Board"],
  ["/calendar", "ri-calendar-line", "Calendar"],
  ["/activity-logs", "ri-time-line", "Activity logs"],
  ["/notifications", "ri-notification-3-line", "Notifications"],
  ["/reports", "ri-bar-chart-box-line", "Reports"],
  ["/admin", "ri-settings-4-line", "Administration"],
] as const;
export async function AppShell({ children }: { children: React.ReactNode }) {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await s
    .from("profiles")
    .select("full_name,employee_id,organization_id,is_platform_admin")
    .eq("id", user.id)
    .single();
  const admin = createAdminClient();
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("roles!inner(system_key)")
    .eq("user_id", user.id);
  const isAdmin = Boolean(
    p?.is_platform_admin ||
    roleRows?.some((entry) => {
      const role = entry.roles as unknown as { system_key?: string };
      return (
        role.system_key === "company_admin" ||
        role.system_key === "platform_super_admin"
      );
    }),
  );
  let companyName = "Company",
    sidebarLogo: string | undefined,
    branding: {
      primary_color?: string;
      secondary_color?: string;
      sidebar_color?: string;
    } | null = null;
  if (p?.organization_id) {
    const [{ data: org }, { data: b }] = await Promise.all([
      admin
        .from("organizations")
        .select("name")
        .eq("id", p.organization_id)
        .single(),
      admin
        .from("organization_branding")
        .select("primary_color,secondary_color,sidebar_color,assets")
        .eq("organization_id", p.organization_id)
        .maybeSingle(),
    ]);
    companyName = org?.name ?? companyName;
    branding = b;
    if (b?.assets) {
      const assets = b.assets as Record<string, string>;
      const path = assets.main_logo;
      if (path) {
        const { data } = await admin.storage
          .from("branding-assets")
          .createSignedUrl(path, 3600);
        sidebarLogo = data?.signedUrl;
      }
    }
  }
  const style = {
    "--brand": branding?.primary_color ?? "#ff5c73",
    "--brand2": branding?.secondary_color ?? "#6c5ce7",
    "--sidebar": branding?.sidebar_color ?? "#181a2b",
  } as React.CSSProperties;
  return (
    <div className="shell" style={style}>
      <PushSubscriptionSync />
      <aside className="sidebar" id="primary-sidebar">
        <Logo src={sidebarLogo} name={companyName} />
        <div className="nav-section">Workspace</div>
        <nav aria-label="Workspace navigation">
          {nav
            .filter(([href]) => href !== "/admin" || isAdmin)
            .map(([href, icon, label]) => (
              <Link className="side-link" href={href} key={href}>
                <i className={icon} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <MobileSidebarToggle />
          <div className="global-search">
            <i className="ri-search-line me-2" />
            <span>Search tasks, company users and reports</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <ThemeControls />
            <Link href="/notifications" aria-label="Notifications">
              <i className="ri-notification-3-line fs-5" />
            </Link>
            <AccountMenu
              name={p?.full_name ?? user.email ?? "User"}
              employeeId={p?.employee_id ?? "Member"}
              role={p?.employee_id ?? "Member"}
            />
          </div>
        </header>
        {children}
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          <Link href="/dashboard">
            <i className="ri-dashboard-2-line" />
            <span>Home</span>
          </Link>
          <Link href="/tasks">
            <i className="ri-task-line" />
            <span>Tasks</span>
          </Link>
          <Link href="/tasks/new" className="mobile-create">
            <i className="ri-add-line" />
            <span>Create</span>
          </Link>
          <Link href="/notifications">
            <i className="ri-notification-3-line" />
            <span>Alerts</span>
          </Link>
          <Link href="/profile">
            <i className="ri-user-line" />
            <span>Profile</span>
          </Link>
        </nav>
        <footer className="footer">
          Opsora · Assign. Execute. Verify. Track.
        </footer>
      </div>
    </div>
  );
}
