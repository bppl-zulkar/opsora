"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { announcePending } from "./interaction-lock";

export function FormSubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "btn btn-primary",
  confirmMessage,
  name,
  value,
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pendingId = useId();

  useEffect(() => {
    const form = buttonRef.current?.form;
    announcePending(pendingId, pending);
    if (form) {
      form.inert = pending;
      form.setAttribute("aria-busy", String(pending));
      if (pending) form.dataset.pending = "true";
      else delete form.dataset.pending;
    }
    return () => {
      announcePending(pendingId, false);
      if (form) {
        form.inert = false;
        form.removeAttribute("aria-busy");
        delete form.dataset.pending;
      }
    };
  }, [pending, pendingId]);

  return (
    <button
      ref={buttonRef}
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
      name={name}
      value={value}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending && <span className="submit-spinner" aria-hidden="true" />}
      <span aria-live="polite">{pending ? pendingLabel : children}</span>
    </button>
  );
}
