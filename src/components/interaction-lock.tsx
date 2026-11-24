"use client";

import { useEffect, useState, type ReactNode } from "react";

type PendingDetail = { id: string; pending: boolean };
type PendingEvent = CustomEvent<PendingDetail>;

export function announcePending(id: string, pending: boolean) {
  window.dispatchEvent(
    new CustomEvent<PendingDetail>("opsora:pending", {
      detail: { id, pending },
    }),
  );
}

export function InteractionLock({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const update = (event: Event) => {
      const { id, pending: isPending } = (event as PendingEvent).detail;
      setPending((current) => {
        const next = new Set(current);
        if (isPending) next.add(id);
        else next.delete(id);
        return next;
      });
    };
    window.addEventListener("opsora:pending", update);
    return () => window.removeEventListener("opsora:pending", update);
  }, []);

  const isPending = pending.size > 0;
  return (
    <>
      <div inert={isPending || undefined}>{children}</div>
      {isPending && (
        <div
          className="interaction-lock"
          role="status"
          aria-live="assertive"
        >
          <span className="interaction-lock-spinner" aria-hidden="true" />
          <span>Working… please wait</span>
        </div>
      )}
    </>
  );
}
