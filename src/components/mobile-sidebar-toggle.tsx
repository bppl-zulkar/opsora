"use client";
import { useState } from "react";
export function MobileSidebarToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <i className="ri-menu-2-line" />
      </button>
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <style>{open ? ".sidebar{transform:translateX(0)!important}" : ""}</style>
    </>
  );
}
