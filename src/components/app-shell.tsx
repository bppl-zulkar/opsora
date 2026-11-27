import Link from "next/link";
import { Logo } from "./logo";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { MobileSidebarToggle } from "./mobile-sidebar-toggle";
import { ThemeControls } from "./theme-controls";
import { AccountMenu } from "./account-menu";
import { PushSubscriptionSync } from "./push-subscription-sync";
import { WorkspaceNavigation } from "./workspace-navigation";
import { GlobalSearch } from "./global-search";
import { VoiceTaskAssistantLoader } from "./voice-task-assistant-loader";
const primaryNav = [
  ["/dashboard", "ri-dashboard-2-line", "Dashboard"],
  ["/tasks", "ri-task-line", "Tasks"],
  ["/board", "ri-layout-grid-line", "Board"],
  ["/calendar", "ri-calendar-line", "Calendar"],
] as const;
const managementNav = [
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
    .select("full_name,employee_id,organization_id,is_platform_admin,notification_preferences")
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
    sidebarLogo: string | undefined;
  if (p?.organization_id) {
    const [{ data: org }, { data: b }] = await Promise.all([
      admin
        .from("organizations")
        .select("name")
        .eq("id", p.organization_id)
        .single(),
      admin
        .from("organization_branding")
        .select("assets")
        .eq("organization_id", p.organization_id)
        .maybeSingle(),
    ]);
    companyName = org?.name ?? companyName;
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
  const preferences = (p?.notification_preferences ?? {}) as Record<
    string,
    unknown
  >;
  const background = [
    "none",
    "aurora",
    "wave",
    "mist",
    "mesh",
    "dawn",
    "midnight",
  ].includes(String(preferences.background_theme))
    ? String(preferences.background_theme)
    : "aurora";
  return (
    <div className={`shell workspace-bg-${background}`}>
      <PushSubscriptionSync />
      <VoiceTaskAssistantLoader userName={p?.full_name ?? user.email ?? "there"} />
      <aside className="sidebar" id="primary-sidebar">
        <div className="sidebar-brand">
          <Logo src={sidebarLogo} name={companyName} />
        </div>
        <WorkspaceNavigation
          primary={primaryNav}
          management={managementNav.filter(
            ([href]) => href !== "/admin" || isAdmin,
          )}
        />
        <div className="sidebar-support">
          <span className="sidebar-support-icon">
            <i className="ri-question-line" />
          </span>
          <span>
            <strong>Need help?</strong>
            <small>Workspace assistance</small>
          </span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <MobileSidebarToggle />
          <GlobalSearch />
          <div className="topbar-actions">
            <ThemeControls />
            <Link
              className="topbar-notification"
              href="/notifications"
              aria-label="Notifications"
            >
              <i className="ri-notification-3-line fs-5" />
            </Link>
            <AccountMenu
              name={p?.full_name ?? user.email ?? "User"}
              employeeId={p?.employee_id ?? "Member"}
              role={p?.employee_id ?? "Member"}
            />
          </div>
        </header>
        <div className="workspace-content">{children}</div>
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
