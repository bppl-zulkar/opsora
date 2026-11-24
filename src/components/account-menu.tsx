"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function AccountMenu({
  name,
  employeeId,
  role,
}: {
  name: string;
  employeeId: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="account-menu" ref={ref}>
      <button
        className="account-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="account-avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span className="account-copy">
          <strong>{name}</strong>
          <small>{role || employeeId}</small>
        </span>
        <i className="ri-arrow-down-s-line" />
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-summary">
            <strong>{name}</strong>
            <small>{employeeId}</small>
          </div>
          <Link href="/profile" onClick={() => setOpen(false)}>
            <i className="ri-user-line" /> View profile
          </Link>
          <Link href="/profile?edit=1" onClick={() => setOpen(false)}>
            <i className="ri-edit-line" /> Edit profile
          </Link>
          <Link href="/notifications" onClick={() => setOpen(false)}>
            <i className="ri-notification-3-line" /> Notifications
          </Link>
          <button type="button" className="logout" onClick={logout}>
            <i className="ri-logout-box-r-line" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
