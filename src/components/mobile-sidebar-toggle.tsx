"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
export function MobileSidebarToggle() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = pathname !== null && openPath === pathname;

  return (
    <>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => pathname && setOpenPath(open ? null : pathname)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="primary-sidebar"
      >
        <i className="ri-menu-2-line" />
      </button>
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpenPath(null)}
        />
      )}
      <style>{open ? ".sidebar{transform:translateX(0)!important}" : ""}</style>
    </>
  );
}
