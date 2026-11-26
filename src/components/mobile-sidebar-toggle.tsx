"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

function SidebarBackdrop({ onClose }: { onClose: () => void }) {
  return createPortal(
    <button
      type="button"
      className="sidebar-backdrop"
      aria-label="Close navigation"
      onClick={onClose}
    />,
    document.body,
  );
}

export function MobileSidebarToggle() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = pathname !== null && openPath === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.classList.toggle("sidebar-mobile-open", open);
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("sidebar-mobile-open");
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="mobile-menu-button"
        onClick={() => pathname && setOpenPath(open ? null : pathname)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="primary-sidebar"
      >
        <i className={open ? "ri-close-line" : "ri-menu-2-line"} />
      </button>
      {open && <SidebarBackdrop onClose={() => setOpenPath(null)} />}
    </>
  );
}
