"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = readonly [href: string, icon: string, label: string];

export function WorkspaceNavigation({
  primary,
  management,
}: {
  primary: readonly NavigationItem[];
  management: readonly NavigationItem[];
}) {
  const pathname = usePathname();

  const renderItem = ([href, icon, label]: NavigationItem) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);

    return (
      <Link
        className={`side-link${active ? " active" : ""}`}
        href={href}
        key={href}
        aria-current={active ? "page" : undefined}
      >
        <i className={icon} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav className="workspace-navigation" aria-label="Workspace navigation">
      <div className="nav-section">Workspace</div>
      {primary.map(renderItem)}
      {management.length > 0 && (
        <>
          <div className="nav-section">Management</div>
          {management.map(renderItem)}
        </>
      )}
    </nav>
  );
}
